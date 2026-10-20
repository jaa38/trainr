import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  isUuid,
  matchesVerifiedTransaction,
  toKobo,
} from "../_shared/payment-validation.ts";

const markReconciliationRequired = async (
  admin: {
    from: (table: "booking_payments") => any;
  },
  paymentId: string,
) => {
  const { error } = await admin
    .from("booking_payments")
    .update({
      initialization_status: "reconciliation_required",
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .in("initialization_status", ["not_started", "initializing"]);

  if (error) {
    console.error(
      "Unable to mark payment for reconciliation:",
      error.message,
    );
  }
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
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

    // Reuse a saved checkout only when its initialization state agrees.
    if (
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

    if (!payment.provider_reference) {
      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
          recovery: "manual_reconciliation_required",
          initializationStatus: payment.initialization_status,
          message:
            "No provider reference exists. No new transaction was created.",
        },
        409,
      );
    }

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

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
      providerResponse = await fetch(
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

      await markReconciliationRequired(admin, payment.id);

      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
          initializationStatus: payment.initialization_status,
          recovery: "reconciliation_required",
          message:
            "Verification is temporarily unavailable. Please retry later.",
        },
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
      await markReconciliationRequired(admin, payment.id);

      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
          initializationStatus: payment.initialization_status,
          recovery: "reconciliation_required",
          error: "Paystack returned an unreadable verification response.",
        },
        502,
      );
    }

    if (!providerResponse.ok || result.status !== true || !result.data) {
      console.error(
        "Paystack recovery was not confirmed:",
        result.message ?? `HTTP ${providerResponse.status}`,
      );

      await markReconciliationRequired(admin, payment.id);

      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
          initializationStatus: payment.initialization_status,
          recovery: "reconciliation_required",
          message:
            "Paystack could not confirm the transaction. No new transaction was created.",
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
      console.error(
        "Paystack recovery details did not match the stored payment.",
      );

      return jsonResponse(
        { error: "Verified transaction details do not match this payment." },
        409,
      );
    }

    if (transaction.status !== "success") {
      await markReconciliationRequired(admin, payment.id);

      return jsonResponse({
        paymentId: payment.id,
        status: "pending",
        providerStatus: transaction.status ?? "unknown",
        initializationStatus: payment.initialization_status,
        recovery: "reconciliation_required",
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

      return jsonResponse(
        {
          error:
            "Paystack verified the transaction, but TRAINR could not confirm it in the database. Reconciliation is required.",
          paymentId: payment.id,
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
          error: "TRAINR could not confirm the recovered payment.",
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
  }),
};
