import {
  isUuid,
  matchesVerifiedTransaction,
  toKobo,
} from "../_shared/payment-validation.ts";

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

type RetryContext = {
  userClaims?: { id?: string } | null;
  supabaseAdmin: any;
};

type RetryDependencies = {
  getSecretKey: () => string | undefined;
  fetch: typeof fetch;
};

const defaultDependencies: RetryDependencies = {
  getSecretKey: () => Deno.env.get("PAYSTACK_SECRET_KEY"),
  fetch: (input, init) => fetch(input, init),
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
};

export async function handleRetryPayment(
  req: Request,
  ctx: RetryContext,
  dependencies: RetryDependencies = defaultDependencies,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: { paymentId?: unknown; idempotencyKey?: unknown };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (!isUuid(body.paymentId) || !isUuid(body.idempotencyKey)) {
    return jsonResponse(
      {
        error: "Valid paymentId and idempotencyKey UUIDs are required.",
      },
      400,
    );
  }

  const userId = ctx.userClaims?.id;

  if (!userId) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const secretKey = dependencies.getSecretKey();

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");
    return jsonResponse({ error: "Payment service is not configured." }, 500);
  }

  const admin = ctx.supabaseAdmin;

  const { data: payment, error: paymentError } = await admin
    .from("booking_payments")
    .select(
      "id, booking_id, gym_goer_id, amount, currency, provider, provider_reference, status, superseded_by",
    )
    .eq("id", body.paymentId)
    .eq("gym_goer_id", userId)
    .maybeSingle();

  if (paymentError) {
    console.error("Retry payment lookup failed:", paymentError.message);
    return jsonResponse({ error: "Unable to retrieve payment." }, 500);
  }

  if (!payment) {
    return jsonResponse(
      { error: "Payment not found or not accessible." },
      404,
    );
  }

  // A superseded attempt must never initiate another retry.
  // The replacement attempt must be handled separately.
  if (payment.superseded_by) {
    return jsonResponse(
      {
        error: "This payment attempt has already been superseded.",
        paymentId: payment.id,
        supersededBy: payment.superseded_by,
      },
      409,
    );
  }

  if (
    payment.provider !== "paystack" ||
    !payment.provider_reference ||
    payment.currency !== "NGN"
  ) {
    return jsonResponse(
      { error: "Payment is not eligible for retry." },
      409,
    );
  }

  const amountInNaira = Number(payment.amount);
  const expectedAmountInKobo = toKobo(amountInNaira);

  if (expectedAmountInKobo === null) {
    return jsonResponse({ error: "Stored payment amount is invalid." }, 409);
  }

  let providerResponse: Response;

  try {
    providerResponse = await dependencies.fetch(
      `https://api.paystack.co/transaction/verify/${
        encodeURIComponent(payment.provider_reference)
      }`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (error) {
    console.error(
      "Paystack retry verification request failed:",
      error instanceof Error ? error.message : "Unknown network error",
    );

    return jsonResponse(
      {
        error: "Paystack verification is temporarily unavailable.",
        paymentId: payment.id,
      },
      503,
    );
  }

  let result: PaystackVerifyResponse;

  try {
    result = await providerResponse.json();
  } catch {
    return jsonResponse(
      { error: "Paystack returned an unreadable verification response." },
      502,
    );
  }

  if (!providerResponse.ok || result.status !== true || !result.data) {
    console.error(
      "Paystack retry verification was not confirmed:",
      result.message ?? `HTTP ${providerResponse.status}`,
    );

    return jsonResponse(
      {
        error:
          "Paystack could not verify this transaction. No retry was created.",
        paymentId: payment.id,
      },
      502,
    );
  }

  const transaction = result.data;

  if (
    !matchesVerifiedTransaction(
      transaction,
      payment.provider_reference,
      expectedAmountInKobo,
      payment.currency,
    )
  ) {
    return jsonResponse(
      {
        error:
          "Verified transaction details do not match. No retry was created.",
        paymentId: payment.id,
      },
      409,
    );
  }

  // Only an exact provider status of "failed" can proceed.
  // "abandoned", "pending", "success" and unknown statuses never create
  // a replacement through this endpoint.
  if (transaction.status !== "failed") {
    return jsonResponse(
      {
        error: transaction.status === "success"
          ? "Paystack reports a successful transaction. Do not retry this payment."
          : "Paystack has not confirmed a failed transaction. No retry was created.",
        paymentId: payment.id,
        providerStatus: transaction.status ?? "unknown",
        status: payment.status,
      },
      409,
    );
  }

  const { data: retryResult, error: retryError } = await admin.rpc(
    "retry_failed_booking_payment",
    {
      p_old_payment_id: payment.id,
      p_gym_goer_id: userId,
      p_expected_reference: payment.provider_reference,
      p_expected_amount: amountInNaira,
      p_expected_currency: payment.currency,
      p_verified_provider_status: transaction.status,
      p_new_idempotency_key: body.idempotencyKey,
    },
  );

  if (retryError) {
    // Avoid logging payment references, user identifiers or secrets.
    console.error("Atomic payment retry failed:", retryError.message);

    return jsonResponse(
      {
        error:
          "TRAINR could not safely create or retrieve the replacement payment. Please try again or contact support.",
        paymentId: payment.id,
      },
      409,
    );
  }

  const replacement = Array.isArray(retryResult) ? retryResult[0] : retryResult;

  if (
    !replacement ||
    !isUuid(replacement.payment_id) ||
    replacement.booking_id !== payment.booking_id ||
    typeof replacement.provider_reference !== "string" ||
    !replacement.provider_reference ||
    !["pending", "successful", "failed"].includes(
      replacement.payment_status,
    )
  ) {
    console.error("Atomic retry RPC returned an invalid response.");

    return jsonResponse(
      {
        error:
          "TRAINR returned an invalid retry result. Reconciliation is required.",
        paymentId: payment.id,
      },
      500,
    );
  }

  // Do not initialize checkout here. The client must use the existing
  // initiate-payment flow with the replacement payment's idempotency key.
  return jsonResponse({
    paymentId: replacement.payment_id,
    bookingId: replacement.booking_id,
    reference: replacement.provider_reference,
    status: replacement.payment_status,
    wasCreated: replacement.was_created === true,
    message: replacement.payment_status === "successful"
      ? "This booking is already paid."
      : replacement.payment_status === "pending"
      ? "The replacement payment is ready for the existing initialization flow."
      : "The replacement attempt is not ready for checkout. Reconciliation is required.",
  });
}
