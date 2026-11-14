const PAYMENT_STATUSES = [
    "pending",
    "successful",
    "failed",
    "cancelled",
] as const;

type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

type TransactionHistoryContext = {
    userClaims?: { id?: string } | null;
    supabaseAdmin: any;
};

type RequestBody = {
    page?: unknown;
    pageSize?: unknown;
    status?: unknown;
};

const jsonResponse = (
    body: Record<string, unknown>,
    status = 200,
) => Response.json(body, {
    status,
    headers: {
        "Cache-Control": "no-store",
    },
});

function isPositiveInteger(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0
    );
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
    return (
        typeof value === "string" &&
        PAYMENT_STATUSES.includes(value as PaymentStatus)
    );
}

export async function handleTrainerTransactionHistory(
    req: Request,
    ctx: TransactionHistoryContext,
): Promise<Response> {
    // 1. Validate HTTP method.
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    // 2. Resolve authenticated trainer identity.
    const trainerId = ctx.userClaims?.id;

    if (!trainerId) {
        return jsonResponse(
            { error: "Authentication required." },
            401,
        );
    }

    const admin = ctx.supabaseAdmin;

    if (!admin) {
        console.error(
            "Trainer transaction history admin client is unavailable.",
        );

        return jsonResponse(
            { error: "Transaction history is not configured." },
            500,
        );
    }

    try {
        // 3. Validate request body.
        let body: RequestBody;

        try {
            const parsed = await req.json();

            if (
                parsed === null ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return jsonResponse(
                    { error: "Request body must be a JSON object." },
                    400,
                );
            }

            body = parsed as RequestBody;
        } catch {
            return jsonResponse(
                { error: "Request body must be valid JSON." },
                400,
            );
        }

        // 4. Validate pagination and status filter.
        const page = body.page ?? 1;
        const pageSize = body.pageSize ?? 20;
        const status = body.status;

        if (!isPositiveInteger(page)) {
            return jsonResponse(
                { error: "page must be a positive integer." },
                400,
            );
        }

        if (!isPositiveInteger(pageSize) || pageSize > 50) {
            return jsonResponse(
                { error: "pageSize must be between 1 and 50." },
                400,
            );
        }

        if (
            status !== undefined &&
            status !== null &&
            !isPaymentStatus(status)
        ) {
            return jsonResponse(
                { error: "Invalid payment status filter." },
                400,
            );
        }

        const offset = (page - 1) * pageSize;

        if (!Number.isSafeInteger(offset)) {
            return jsonResponse(
                { error: "Requested page is out of range." },
                400,
            );
        }

        // 5. Explicitly verify that the authenticated user is a trainer.
        const {
            data: profile,
            error: profileError,
        } = await admin
            .from("profiles")
            .select("id, role")
            .eq("id", trainerId)
            .maybeSingle();

        if (profileError) {
            console.error(
                "Trainer profile verification failed:",
                profileError.message,
            );

            return jsonResponse(
                { error: "Unable to verify trainer account." },
                500,
            );
        }

        if (!profile || profile.role !== "trainer") {
            return jsonResponse(
                { error: "Trainer account required." },
                403,
            );
        }

        // 6. Retrieve transactions belonging to this trainer.
        //
        // The trainer ID comes exclusively from the authenticated
        // Supabase user context.
        //
        // Superseded payment attempts are excluded to avoid presenting
        // replaced attempts as current transaction records.
        let query = admin
            .from("booking_payments")
            .select(
                `
          id,
          booking_id,
          amount,
          currency,
          provider,
          status,
          paid_at,
          created_at,
          updated_at,
          booking:trainer_bookings!booking_payments_booking_id_fkey!inner (
            id,
            scheduled_start,
            scheduled_end,
            status
          )
        `,
                { count: "exact" },
            )
            .eq("booking.trainer_id", trainerId)
            .is("superseded_by", null)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false });

        if (status) {
            query = query.eq("status", status);
        }

        const {
            data: payments,
            error: paymentError,
            count,
        } = await query.range(offset, offset + pageSize - 1);

        if (paymentError) {
            console.error(
                "Trainer transaction history lookup failed:",
                paymentError.message,
            );

            return jsonResponse(
                { error: "Unable to retrieve transaction history." },
                500,
            );
        }

        // 7. Map the database response to a restricted API response.
        const transactions = (payments ?? []).map((payment: any) => {
            const booking = Array.isArray(payment.booking)
                ? payment.booking[0]
                : payment.booking;

            return {
                id: payment.id,
                bookingId: payment.booking_id,
                amount: payment.amount,
                currency: payment.currency,
                provider: payment.provider,
                status: payment.status,
                paidAt: payment.paid_at,
                createdAt: payment.created_at,
                updatedAt: payment.updated_at,
                booking: booking
                    ? {
                        id: booking.id,
                        scheduledStart: booking.scheduled_start,
                        scheduledEnd: booking.scheduled_end,
                        status: booking.status,
                    }
                    : null,
            };
        });

        // 8. Calculate pagination metadata.
        const total = count ?? 0;
        const totalPages = Math.ceil(total / pageSize);

        return jsonResponse({
            transactions,
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1 && totalPages > 0,
            },
            filters: {
                status: status ?? null,
            },
        });
    } catch (error) {
        console.error(
            "Unexpected trainer transaction history error:",
            error instanceof Error ? error.message : "Unknown error",
        );

        return jsonResponse(
            { error: "Unable to retrieve transaction history." },
            500,
        );
    }
}
