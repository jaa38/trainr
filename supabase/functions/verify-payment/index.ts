import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
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

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed." },
        405,
      );
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

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY is not configured.");

      return jsonResponse(
        { error: "Payment service is not configured." },
        500,
      );
    }

    const admin = ctx.supabaseAdmin;

    // Only the gym-goer who owns this payment can request verification.
    const { data: payment, error: paymentError } = await admin
      .from("booking_payments")
      .select(
        "id, booking_id, gym_goer_id, amount, currency, provider, provider_reference, status",
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

    if (
      payment.provider !== "paystack" ||
      !payment.provider_reference ||
      payment.currency !== "NGN"
    ) {
      return jsonResponse(
        { error: "Payment details are not eligible for verification." },
        409,
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
        "Paystack verification request failed:",
        error instanceof Error ? error.message : "Unknown network error",
      );

      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
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
      return jsonResponse(
        { error: "Paystack returned an unreadable verification response." },
        502,
      );
    }

    if (!providerResponse.ok || result.status !== true || !result.data) {
      console.error(
        "Paystack verification was not confirmed:",
        result.message ?? `HTTP ${providerResponse.status}`,
      );

      return jsonResponse(
        {
          paymentId: payment.id,
          status: "pending",
          message:
            "Paystack could not confirm the transaction. Please retry later.",
        },
        502,
      );
    }

    const transaction = result.data;

    // Match the verified transaction against the stored payment.
    if (
      !matchesVerifiedTransaction(
        transaction,
        payment.provider_reference,
        expectedAmountInKobo,
        payment.currency,
      )
    ) {
      console.error(
        "Paystack transaction details did not match the payment record.",
      );

      return jsonResponse(
        {
          error: "Verified transaction details do not match this payment.",
        },
        409,
      );
    }

    if (transaction.status !== "success") {
      // Only mark a transaction failed when Paystack explicitly reports failed.
      // Other states remain pending for later verification or reconciliation.
      if (transaction.status === "failed") {
        const { data: failedPayment, error: failedUpdateError } = await admin
          .from("booking_payments")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (failedUpdateError) {
          console.error(
            "Unable to update failed payment:",
            failedUpdateError.message,
          );

          return jsonResponse(
            { error: "Unable to save the verified payment status." },
            500,
          );
        }

        if (!failedPayment) {
          const { data: latestPayment, error: latestError } = await admin
            .from("booking_payments")
            .select("status")
            .eq("id", payment.id)
            .maybeSingle();

          if (latestError) {
            return jsonResponse(
              { error: "Unable to confirm the current payment status." },
              500,
            );
          }

          if (latestPayment?.status === "successful") {
            return jsonResponse({
              paymentId: payment.id,
              status: "successful",
            });
          }

          if (latestPayment?.status !== "failed") {
            return jsonResponse(
              {
                error:
                  "Payment status changed during verification. Reconciliation is required.",
              },
              409,
            );
          }
        }

        return jsonResponse({
          paymentId: payment.id,
          status: "failed",
          message: "Paystack reports that this transaction failed.",
        });
      }

      return jsonResponse({
        paymentId: payment.id,
        status: "pending",
        providerStatus: transaction.status ?? "unknown",
        message: "Payment has not been confirmed as successful.",
      });
    }

    // Final status transition is handled atomically in PostgreSQL.
    const { data: confirmation, error: confirmationError } = await admin.rpc(
      "confirm_booking_payment",
      {
        p_payment_id: payment.id,
        p_expected_reference: payment.provider_reference,
        p_expected_amount: amountInNaira,
        p_expected_currency: payment.currency,
      },
    );

    if (confirmationError) {
      console.error(
        "Atomic payment confirmation failed:",
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
          error: "TRAINR could not confirm the payment status.",
          paymentId: payment.id,
        },
        409,
      );
    }

    return jsonResponse({
      paymentId: payment.id,
      status: "successful",
      message: "Payment verified successfully.",
    });
  }),
};
