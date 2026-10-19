
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed." },
        405,
      );
    }

    let body: {
      bookingId?: unknown;
      idempotencyKey?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Request body must be valid JSON." },
        400,
      );
    }

    if (
      !isUuid(body.bookingId) ||
      !isUuid(body.idempotencyKey)
    ) {
      return jsonResponse(
        {
          error:
            "Valid bookingId and idempotencyKey UUIDs are required.",
        },
        400,
      );
    }

    const userId = ctx.userClaims?.id;
    const email = ctx.userClaims?.email;

    if (!userId || typeof email !== "string" || !email) {
      return jsonResponse(
        { error: "A signed-in user with an email address is required." },
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

    // Validate ownership and booking status using the user's RLS-scoped client.
    const { data: booking, error: bookingError } = await ctx.supabase
      .from("trainer_bookings")
      .select("id, gym_goer_id, status, session_rate, currency")
      .eq("id", body.bookingId)
      .eq("gym_goer_id", userId)
      .maybeSingle();

    if (bookingError) {
      console.error("Booking lookup failed:", bookingError.message);

      return jsonResponse(
        { error: "Unable to validate booking." },
        500,
      );
    }

    if (!booking) {
      return jsonResponse(
        { error: "Booking not found or not accessible." },
        404,
      );
    }

    if (booking.status !== "confirmed") {
      return jsonResponse(
        {
          error: "Only confirmed bookings can be paid for.",
          bookingStatus: booking.status,
        },
        409,
      );
    }

    if (booking.currency !== "NGN") {
      return jsonResponse(
        {
          error:
            "Only NGN payments are currently supported.",
        },
        409,
      );
    }

    const amountInNaira = Number(booking.session_rate);
    const amountInKobo = Math.round(amountInNaira * 100);

    if (
      !Number.isFinite(amountInNaira) ||
      amountInNaira <= 0 ||
      !Number.isSafeInteger(amountInKobo) ||
      Math.abs(amountInNaira * 100 - amountInKobo) > 0.000001
    ) {
      return jsonResponse(
        { error: "Booking has an invalid payment amount." },
        409,
      );
    }

    // Privileged database access is used only after ownership validation.
    const admin = ctx.supabaseAdmin;

    // Reuse an existing attempt when the client retries with the same key.
    const { data: keyedPayment, error: keyedPaymentError } = await admin
      .from("booking_payments")
      .select(
        "id, booking_id, provider_reference, status, authorization_url",
      )
      .eq("gym_goer_id", userId)
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle();

    if (keyedPaymentError) {
      console.error(
        "Idempotency lookup failed:",
        keyedPaymentError.message,
      );

      return jsonResponse(
        { error: "Unable to check the existing payment attempt." },
        500,
      );
    }

    if (keyedPayment) {
      if (keyedPayment.booking_id !== booking.id) {
        return jsonResponse(
          { error: "This idempotency key belongs to another booking." },
          409,
        );
      }

      if (keyedPayment.status === "successful") {
        return jsonResponse(
          { error: "This booking already has a successful payment." },
          409,
        );
      }

      if (
        keyedPayment.status === "pending" &&
        keyedPayment.authorization_url &&
        keyedPayment.provider_reference
      ) {
        return jsonResponse({
          paymentId: keyedPayment.id,
          reference: keyedPayment.provider_reference,
          authorizationUrl: keyedPayment.authorization_url,
          status: "pending",
        });
      }

      return jsonResponse(
        {
          error:
            "This payment attempt cannot be restarted automatically. Reconciliation is required.",
        },
        409,
      );
    }

    // Do not create a second attempt while another one is unresolved.
    const { data: pendingPayment, error: pendingPaymentError } =
      await admin
        .from("booking_payments")
        .select("id, provider_reference, authorization_url")
        .eq("booking_id", booking.id)
        .eq("status", "pending")
        .maybeSingle();

    if (pendingPaymentError) {
      console.error(
        "Pending payment lookup failed:",
        pendingPaymentError.message,
      );

      return jsonResponse(
        { error: "Unable to check pending payments." },
        500,
      );
    }

    if (pendingPayment) {
      if (
        pendingPayment.authorization_url &&
        pendingPayment.provider_reference
      ) {
        return jsonResponse({
          paymentId: pendingPayment.id,
          reference: pendingPayment.provider_reference,
          authorizationUrl: pendingPayment.authorization_url,
          status: "pending",
        });
      }

      return jsonResponse(
        {
          error:
            "A payment attempt is already being processed. Please try again later.",
        },
        409,
      );
    }

    const paymentId = crypto.randomUUID();
    const reference = `trainr_${crypto.randomUUID().replaceAll("-", "")}`;

    // Create the pending record before contacting Paystack.
    const { error: insertError } = await admin
      .from("booking_payments")
      .insert({
        id: paymentId,
        booking_id: booking.id,
        gym_goer_id: userId,
        amount: amountInNaira,
        currency: "NGN",
        provider: "paystack",
        provider_reference: reference,
        status: "pending",
        idempotency_key: body.idempotencyKey,
      });

    if (insertError) {
      // A concurrent request may have won the unique-index race.
      const { data: existingPayment } = await admin
        .from("booking_payments")
        .select("id, provider_reference, authorization_url")
        .eq("booking_id", booking.id)
        .eq("status", "pending")
        .maybeSingle();

      if (
        existingPayment?.authorization_url &&
        existingPayment.provider_reference
      ) {
        return jsonResponse({
          paymentId: existingPayment.id,
          reference: existingPayment.provider_reference,
          authorizationUrl: existingPayment.authorization_url,
          status: "pending",
        });
      }

      console.error("Payment record creation failed:", insertError.message);

      return jsonResponse(
        {
          error:
            "Unable to create a payment attempt. Check for an existing attempt before retrying.",
        },
        409,
      );
    }

    let paystackResponse: Response;

    try {
      paystackResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount: String(amountInKobo),
            currency: "NGN",
            reference,
            metadata: {
              booking_id: booking.id,
              payment_id: paymentId,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch (error) {
      // The provider may have received the request even if we timed out.
      // Keep the attempt pending so a retry cannot create another charge.
      console.error(
        "Paystack request outcome is uncertain:",
        error instanceof Error ? error.message : "Unknown network error",
      );

      return jsonResponse(
        {
          error:
            "Payment initialization could not be confirmed. Do not start another attempt; reconciliation is required.",
          paymentId,
          reference,
        },
        503,
      );
    }

    let result: {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        reference?: string;
      };
    };

    try {
      result = await paystackResponse.json();
    } catch {
      console.error("Paystack returned an unreadable response.");

      return jsonResponse(
        {
          error:
            "Paystack returned an unreadable response. Reconciliation is required.",
          paymentId,
          reference,
        },
        502,
      );
    }

    if (
      !paystackResponse.ok ||
      result.status !== true ||
      !result.data?.authorization_url ||
      result.data.reference !== reference
    ) {
      console.error(
        "Paystack initialization was not confirmed:",
        result.message ?? `HTTP ${paystackResponse.status}`,
      );

      return jsonResponse(
        {
          error:
            "Paystack did not confirm checkout initialization. Reconciliation is required before retrying.",
          paymentId,
          reference,
        },
        502,
      );
    }

    const { error: updateError } = await admin
      .from("booking_payments")
      .update({
        authorization_url: result.data.authorization_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("status", "pending");

    if (updateError) {
      // The provider may already have created a checkout session.
      // Keep the reference for later reconciliation.
      console.error(
        "Unable to save Paystack checkout URL:",
        updateError.message,
      );

      return jsonResponse(
        {
          error:
            "Checkout was initialized, but its details could not be saved. Reconciliation is required.",
          paymentId,
          reference,
        },
        502,
      );
    }

    return jsonResponse({
      paymentId,
      reference,
      authorizationUrl: result.data.authorization_url,
      status: "pending",
    });
  }),
};
