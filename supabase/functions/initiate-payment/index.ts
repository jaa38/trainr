import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { isUuid, toKobo } from "../_shared/payment-validation.ts";

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

type PaymentReservation = {
  payment_id: string;
  booking_id: string;
  provider_reference: string | null;
  authorization_url: string | null;
  payment_status: string;
  was_created: boolean;
  amount: number;
  currency: string;
};

type InitializationClaim = {
  payment_id: string;
  initialization_status: string;
  claimed: boolean;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
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

    if (!isUuid(body.bookingId) || !isUuid(body.idempotencyKey)) {
      return jsonResponse(
        {
          error: "Valid bookingId and idempotencyKey UUIDs are required.",
        },
        400,
      );
    }

    const userId = ctx.userClaims?.id;
    const email = ctx.userClaims?.email;

    if (!userId || !email) {
      return jsonResponse(
        { error: "An authenticated user with an email is required." },
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

    // Read the booking using the authenticated user's Supabase context.
    const { data: booking, error: bookingError } = await ctx.supabase
      .from("trainer_bookings")
      .select("id, gym_goer_id, status, session_rate, currency")
      .eq("id", body.bookingId)
      .eq("gym_goer_id", userId)
      .maybeSingle();

    if (bookingError) {
      console.error("Booking lookup failed:", bookingError.message);

      return jsonResponse(
        { error: "Unable to retrieve the booking." },
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
        { error: "Only confirmed bookings can be paid for." },
        409,
      );
    }

    if (booking.currency !== "NGN") {
      return jsonResponse(
        { error: "This payment currency is not supported yet." },
        409,
      );
    }

    const amountInNaira = Number(booking.session_rate);
    const amountInKobo = toKobo(amountInNaira);

    if (amountInKobo === null) {
      return jsonResponse(
        { error: "Booking has an invalid payment amount." },
        409,
      );
    }

    const admin = ctx.supabaseAdmin;

    // Reserve or reuse a payment attempt atomically in PostgreSQL.
    const {
      data: reservation,
      error: reservationError,
    } = await admin.rpc("reserve_booking_payment_attempt", {
      p_booking_id: booking.id,
      p_gym_goer_id: userId,
      p_idempotency_key: body.idempotencyKey,
    });

    if (reservationError) {
      console.error(
        "Payment reservation failed:",
        reservationError.message,
      );

      return jsonResponse(
        {
          error:
            "Unable to reserve a payment attempt. Please check the payment status before retrying.",
        },
        409,
      );
    }

    const paymentAttempt = (
      Array.isArray(reservation) ? reservation[0] : reservation
    ) as PaymentReservation | null;

    if (!paymentAttempt) {
      return jsonResponse(
        { error: "No payment attempt was returned." },
        500,
      );
    }

    const paymentId = paymentAttempt.payment_id;
    const reference = paymentAttempt.provider_reference;

    if (
      paymentAttempt.booking_id !== booking.id ||
      !paymentId ||
      !isUuid(paymentId)
    ) {
      console.error("Payment reservation returned invalid identifiers.");

      return jsonResponse(
        { error: "The payment reservation could not be validated." },
        500,
      );
    }

    if (paymentAttempt.payment_status === "successful") {
      return jsonResponse({
        paymentId,
        reference,
        status: "successful",
        message: "This booking has already been paid for.",
      });
    }

    if (paymentAttempt.payment_status !== "pending") {
      return jsonResponse(
        {
          error: "The payment attempt requires reconciliation.",
          paymentId,
          reference,
          status: paymentAttempt.payment_status,
        },
        409,
      );
    }

    // Check persisted initialization state before reusing an existing checkout.
    if (!paymentAttempt.was_created) {
      const {
        data: existingPayment,
        error: existingPaymentError,
      } = await admin
        .from("booking_payments")
        .select("initialization_status, authorization_url")
        .eq("id", paymentId)
        .eq("gym_goer_id", userId)
        .maybeSingle();

      if (existingPaymentError || !existingPayment) {
        console.error(
          "Unable to retrieve existing payment initialization state:",
          existingPaymentError?.message ?? "Payment record not found.",
        );

        return jsonResponse(
          {
            error: "Unable to confirm the existing checkout state.",
            paymentId,
          },
          500,
        );
      }

      if (
        existingPayment.initialization_status === "initialized" &&
        existingPayment.authorization_url &&
        paymentAttempt.authorization_url ===
          existingPayment.authorization_url &&
        reference
      ) {
        return jsonResponse({
          paymentId,
          reference,
          authorizationUrl: existingPayment.authorization_url,
          status: "pending",
        });
      }

      return jsonResponse(
        {
          error:
            "The existing payment requires reconciliation before checkout can be reused.",
          paymentId,
          reference,
          status: "pending",
          initializationStatus: existingPayment.initialization_status,
        },
        409,
      );
    }

    if (!reference) {
      return jsonResponse(
        {
          error: "The new payment attempt has no provider reference.",
          paymentId,
        },
        500,
      );
    }

    // Confirm the reserved amount and currency match the booking.
    const reservedAmount = Number(paymentAttempt.amount);
    const reservedAmountInKobo = toKobo(reservedAmount);

    if (
      reservedAmountInKobo === null ||
      reservedAmountInKobo !== amountInKobo ||
      paymentAttempt.currency !== booking.currency
    ) {
      console.error("Reserved payment details do not match the booking.");

      return jsonResponse(
        {
          error: "Reserved payment details do not match the booking.",
          paymentId,
          reference,
        },
        409,
      );
    }

    // Claim initialization atomically before contacting Paystack.
    const {
      data: claimData,
      error: claimError,
    } = await admin.rpc("claim_booking_payment_initialization", {
      p_payment_id: paymentId,
    });

    if (claimError) {
      console.error(
        "Payment initialization claim failed:",
        claimError.message,
      );

      return jsonResponse(
        {
          error: "Unable to claim payment initialization. Please retry later.",
          paymentId,
          reference,
        },
        500,
      );
    }

    const claim = (
      Array.isArray(claimData) ? claimData[0] : claimData
    ) as InitializationClaim | null;

    if (!claim || claim.payment_id !== paymentId) {
      return jsonResponse(
        { error: "Unable to validate the initialization claim.", paymentId },
        500,
      );
    }

    if (!claim.claimed) {
      return jsonResponse(
        {
          error:
            "This payment cannot be initialized again without reconciliation.",
          paymentId,
          reference,
          status: "pending",
          initializationStatus: claim.initialization_status,
        },
        409,
      );
    }

    // Uncertain provider outcomes must not trigger a blind retry.
    const markReconciliationRequired = async () => {
      const { error } = await admin
        .from("booking_payments")
        .update({
          initialization_status: "reconciliation_required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "pending")
        .eq("initialization_status", "initializing");

      if (error) {
        console.error(
          "Unable to mark payment for reconciliation:",
          error.message,
        );
      }
    };

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
      console.error(
        "Paystack initialization outcome is uncertain:",
        error instanceof Error ? error.message : "Unknown network error",
      );

      await markReconciliationRequired();

      return jsonResponse(
        {
          error:
            "Payment initialization could not be confirmed. Reconciliation is required before retrying.",
          paymentId,
          reference,
          status: "pending",
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
      await markReconciliationRequired();

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

      await markReconciliationRequired();

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

    // Persist the checkout URL and initialized state.
    // Any retry below reuses this response; it never initializes a new transaction.
    const checkoutUrl = result.data.authorization_url;

    const saveCheckoutDetails = async () => {
      return await admin
        .from("booking_payments")
        .update({
          authorization_url: checkoutUrl,
          initialization_status: "initialized",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "pending")
        .eq("initialization_status", "initializing")
        .select("id")
        .maybeSingle();
    };

    let { data: savedPayment, error: updateError } =
      await saveCheckoutDetails();

    if (updateError || !savedPayment) {
      console.error(
        "Initial checkout persistence was not confirmed:",
        updateError?.message ?? "No row was updated.",
      );

      // A write may have succeeded even when its response was lost.
      const {
        data: persistedPayment,
        error: persistenceCheckError,
      } = await admin
        .from("booking_payments")
        .select(
          "id, provider_reference, authorization_url, status, initialization_status",
        )
        .eq("id", paymentId)
        .eq("gym_goer_id", userId)
        .maybeSingle();

      const originalWriteSucceeded = !persistenceCheckError &&
        persistedPayment?.id === paymentId &&
        persistedPayment.provider_reference === reference &&
        persistedPayment.authorization_url === checkoutUrl &&
        persistedPayment.status === "pending" &&
        persistedPayment.initialization_status === "initialized";

      if (originalWriteSucceeded) {
        savedPayment = { id: paymentId };
        updateError = null;
      } else {
        // Retry the database write once, with the same provider response.
        const retry = await saveCheckoutDetails();
        savedPayment = retry.data;
        updateError = retry.error;
      }
    }

    if (updateError || !savedPayment) {
      console.error(
        "Unable to persist Paystack checkout details after retry:",
        updateError?.message ??
          "The payment state changed or no row was updated.",
      );

      await markReconciliationRequired();

      return jsonResponse(
        {
          error:
            "Checkout may have been initialized, but TRAINR could not safely persist its details. Reconciliation is required.",
          paymentId,
          reference,
        },
        502,
      );
    }

    return jsonResponse({
      paymentId,
      reference,
      authorizationUrl: checkoutUrl,
      status: "pending",
    });
  }),
};
