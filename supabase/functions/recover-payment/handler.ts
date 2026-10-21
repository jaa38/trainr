import {
  markReconciliationRequired,
  type ReconciliationUpdateResult,
} from "../_shared/payment-reconciliation.ts";
import {
  getRecoveryOutcome,
  type PaymentInitializationStatus,
  type PaymentStatus,
  type RecoveryFailureReason,
} from "../_shared/payment-recovery.ts";
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

const getReconciliationErrorResponse = (paymentId: string) =>
  jsonResponse(
    {
      error:
        "Unable to confirm the payment recovery state. Please try again later or contact support.",
      paymentId,
    },
    500,
  );

const getRecoveryResponse = (
  paymentId: string,
  paymentStatus: PaymentStatus,
  initializationStatus: PaymentInitializationStatus,
  failureReason: RecoveryFailureReason,
  message: string,
  httpStatus = 200,
) =>
  jsonResponse(
    {
      paymentId,
      status: paymentStatus,
      initializationStatus,
      recovery: getRecoveryOutcome(
        paymentStatus,
        initializationStatus,
        failureReason,
      ),
      message,
    },
    httpStatus,
  );

const handleReconciliationResult = (
  paymentId: string,
  result: ReconciliationUpdateResult,
) =>
  result === "error" || result === "state_changed"
    ? getReconciliationErrorResponse(paymentId)
    : null;

type RecoveryContext = {
  userClaims?: { id?: string } | null;
  supabaseAdmin: any;
};

type RecoveryDependencies = {
  getSecretKey: () => string | undefined;
  fetch: typeof fetch;
};

const defaultRecoveryDependencies: RecoveryDependencies = {
  getSecretKey: () => Deno.env.get("PAYSTACK_SECRET_KEY"),
  fetch: (input, init) => fetch(input, init),
};

export async function handleRecoverPayment(
  req: Request,
  ctx: RecoveryContext,
  dependencies: RecoveryDependencies = defaultRecoveryDependencies,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: { paymentId?: unknown };

  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON." },
      400,
    );
  }

  if (!isUuid(body.paymentId)) {
    return jsonResponse(
      { error: "A valid paymentId UUID is required." },
      400,
    );
  }

  const userId = ctx.userClaims?.id;

  if (!userId) {
    return jsonResponse(
      { error: "Authentication required." },
      401,
    );
  }

  const admin = ctx.supabaseAdmin;

  const { data: payment, error: paymentError } = await admin
    .from("booking_payments")
    .select(
      "id, booking_id, gym_goer_id, amount, currency, provider, provider_reference, authorization_url, status, initialization_status",
    )
    .eq("id", body.paymentId)
    .eq("gym_goer_id", userId)
    .maybeSingle();

  if (paymentError) {
    console.error("Payment lookup failed:", paymentError.message);

    return jsonResponse(
      { error: "Unable to retrieve payment." },
      500,
    );
  }

  if (!payment) {
    return jsonResponse(
      { error: "Payment not found or not accessible." },
      404,
    );
  }

  if (payment.status === "successful") {
    return jsonResponse({
      paymentId: payment.id,
      status: "successful",
      message: "This payment has already been verified.",
    });
  }

  if (payment.status !== "pending") {
    return jsonResponse({
      paymentId: payment.id,
      status: payment.status,
      message: "This payment is not pending. No new transaction was created.",
    });
  }

  if (
    payment.provider !== "paystack" ||
    payment.currency !== "NGN"
  ) {
    return jsonResponse(
      { error: "Payment details are not eligible for recovery." },
      409,
    );
  }

  if (!payment.provider_reference) {
    const result = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "missing_provider_reference",
    );

    const errorResponse = handleReconciliationResult(
      payment.id,
      result,
    );
    if (errorResponse) return errorResponse;

    return jsonResponse(
      {
        paymentId: payment.id,
        status: payment.status,
        recovery: "manual_reconciliation_required",
        initializationStatus:
          result === "updated" || result === "already_flagged"
            ? "reconciliation_required"
            : payment.initialization_status,
        message:
          "No provider reference exists. No new transaction was created.",
      },
      409,
    );
  }

  const secretKey = dependencies.getSecretKey();

  // Preserve checkout resumption when verification cannot be attempted.
  // When a key is available, verify even an initialized checkout so a
  // previously completed payment can be reconciled with the database.
  if (
    !secretKey &&
    payment.initialization_status === "initialized" &&
    payment.authorization_url &&
    payment.provider_reference
  ) {
    return jsonResponse({
      paymentId: payment.id,
      reference: payment.provider_reference,
      authorizationUrl: payment.authorization_url,
      status: "pending",
      initializationStatus: "initialized",
    });
  }

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");

    return jsonResponse(
      { error: "Payment service is not configured." },
      500,
    );
  }

  const amountInNaira = Number(payment.amount);
  const expectedAmountInKobo = toKobo(amountInNaira);

  if (expectedAmountInKobo === null) {
    return jsonResponse(
      { error: "Stored payment amount is invalid." },
      409,
    );
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
      "Paystack recovery verification failed:",
      error instanceof Error ? error.message : "Unknown network error",
    );

    // Keep the existing checkout available when provider verification
    // cannot be completed temporarily.
    if (
      payment.initialization_status === "initialized" &&
      payment.authorization_url
    ) {
      return jsonResponse({
        paymentId: payment.id,
        reference: payment.provider_reference,
        authorizationUrl: payment.authorization_url,
        status: "pending",
        initializationStatus: "initialized",
        message:
          "Verification is temporarily unavailable. You can resume checkout and retry later.",
      });
    }

    const result = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "verification_unavailable",
    );

    const errorResponse = handleReconciliationResult(
      payment.id,
      result,
    );
    if (errorResponse) return errorResponse;

    return getRecoveryResponse(
      payment.id,
      payment.status,
      result === "updated" || result === "already_flagged"
        ? "reconciliation_required"
        : payment.initialization_status,
      "verification_unavailable",
      "Verification is temporarily unavailable. Please retry later.",
      503,
    );
  }

  let result: {
    status?: boolean;
    message?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
    };
  };

  try {
    result = await providerResponse.json();
  } catch {
    const reconciliationResult = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "verification_unavailable",
    );

    const errorResponse = handleReconciliationResult(
      payment.id,
      reconciliationResult,
    );
    if (errorResponse) return errorResponse;

    return getRecoveryResponse(
      payment.id,
      payment.status,
      reconciliationResult === "updated" ||
        reconciliationResult === "already_flagged"
        ? "reconciliation_required"
        : payment.initialization_status,
      "verification_unavailable",
      "Paystack returned an unreadable verification response.",
      502,
    );
  }

  if (!providerResponse.ok || result.status !== true || !result.data) {
    console.error(
      "Paystack recovery was not confirmed:",
      result.message ?? `HTTP ${providerResponse.status}`,
    );

    // A temporary provider response should not strand an existing checkout.
    if (
      payment.initialization_status === "initialized" &&
      payment.authorization_url
    ) {
      return jsonResponse({
        paymentId: payment.id,
        reference: payment.provider_reference,
        authorizationUrl: payment.authorization_url,
        status: "pending",
        initializationStatus: "initialized",
        message:
          "Paystack could not verify the payment right now. You can resume checkout and retry later.",
      });
    }

    const reconciliationResult = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "verification_unavailable",
    );

    const errorResponse = handleReconciliationResult(
      payment.id,
      reconciliationResult,
    );
    if (errorResponse) return errorResponse;

    return getRecoveryResponse(
      payment.id,
      payment.status,
      reconciliationResult === "updated" ||
        reconciliationResult === "already_flagged"
        ? "reconciliation_required"
        : payment.initialization_status,
      "verification_unavailable",
      "Paystack could not confirm the transaction. No new transaction was created.",
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
    console.error(
      "Paystack recovery details did not match the stored payment.",
    );

    return jsonResponse(
      { error: "Verified transaction details do not match this payment." },
      409,
    );
  }

  if (transaction.status !== "success") {
    const reconciliationResult = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "transaction_not_successful",
      { force: true },
    );

    const errorResponse = handleReconciliationResult(
      payment.id,
      reconciliationResult,
    );
    if (errorResponse) return errorResponse;

    const initializationStatus: PaymentInitializationStatus =
      reconciliationResult === "updated" ||
        reconciliationResult === "already_flagged"
        ? "reconciliation_required"
        : payment.initialization_status;

    return jsonResponse({
      paymentId: payment.id,
      status: payment.status,
      providerStatus: transaction.status ?? "unknown",
      initializationStatus,
      recovery: getRecoveryOutcome(
        payment.status,
        initializationStatus,
        "transaction_not_successful",
      ),
      message:
        "Payment has not been confirmed as successful. No new transaction was created.",
    });
  }

  const {
    data: confirmation,
    error: confirmationError,
  } = await admin.rpc("confirm_booking_payment", {
    p_payment_id: payment.id,
    p_expected_reference: payment.provider_reference,
    p_expected_amount: amountInNaira,
    p_expected_currency: payment.currency,
  });

  if (confirmationError) {
    console.error(
      "Atomic recovery confirmation failed:",
      confirmationError.message,
    );

    const reconciliationResult = await markReconciliationRequired(
      admin,
      payment.id,
      payment.status,
      payment.initialization_status,
      "transaction_not_successful",
      { force: true },
    );

    const reconciliationError = handleReconciliationResult(
      payment.id,
      reconciliationResult,
    );

    if (reconciliationError) {
      console.error(
        "Payment confirmation failed and reconciliation could not be confirmed.",
      );
      return reconciliationError;
    }

    return jsonResponse(
      {
        error:
          "Paystack verified the transaction, but TRAINR could not confirm it in the database. Reconciliation is required.",
        paymentId: payment.id,
        initializationStatus: reconciliationResult === "updated" ||
            reconciliationResult === "already_flagged"
          ? "reconciliation_required"
          : payment.initialization_status,
      },
      500,
    );
  }

  const confirmedPayment = Array.isArray(confirmation)
    ? confirmation[0]
    : confirmation;

  if (
    !confirmedPayment ||
    confirmedPayment.payment_id !== payment.id ||
    confirmedPayment.payment_status !== "successful"
  ) {
    return jsonResponse(
      {
        error:
          "TRAINR could not confirm the recovered payment. Please retry recovery later or contact support if the issue persists.",
        paymentId: payment.id,
      },
      409,
    );
  }

  return jsonResponse({
    paymentId: payment.id,
    status: "successful",
    message: "Payment recovered and verified successfully.",
  });
}
