type PayoutManagementContext = {
  userClaims?: { id?: string } | null;
  supabaseAdmin: any;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export async function handleTrainerPayoutManagement(
  req: Request,
  ctx: PayoutManagementContext,
): Promise<Response> {
  // 1. Validate HTTP method.
  if (req.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
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
      "Trainer payout management admin client is unavailable.",
    );

    return jsonResponse(
      { error: "Payout management is not configured." },
      500,
    );
  }

  try {
    // 3. Verify that the authenticated user is a trainer.
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
        "Trainer payout profile verification failed:",
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

    // 4. Retrieve payout accounts belonging to this trainer.
    const {
      data: accounts,
      error: accountError,
    } = await admin
      .from("trainer_payout_accounts")
      .select(`
                id,
                market_id,
                country_code,
                currency_code,
                destination_type,
                masked_account_label,
                verification_status,
                is_default,
                created_at,
                updated_at
            `)
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });

    if (accountError) {
      console.error(
        "Trainer payout account lookup failed:",
        accountError.message,
      );

      return jsonResponse(
        {
          error: "Unable to retrieve payout account information.",
        },
        500,
      );
    }

    // 5. Retrieve payout history belonging to this trainer.
    const {
      data: payouts,
      error: payoutError,
    } = await admin
      .from("trainer_payouts")
      .select(`
                id,
                market_id,
                currency_code,
                amount,
                eligible_for_date,
                status,
                approved_at,
                rejected_at,
                processed_at,
                paid_at,
                failure_code,
                failure_message,
                created_at,
                updated_at
            `)
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    if (payoutError) {
      console.error(
        "Trainer payout history lookup failed:",
        payoutError.message,
      );

      return jsonResponse(
        { error: "Unable to retrieve payout history." },
        500,
      );
    }

    // 6. Map database records to the restricted API response.
    // Provider recipient references and transfer references
    // are intentionally excluded.
    const payoutAccounts = (accounts ?? []).map(
      (account: any) => ({
        id: account.id,
        marketId: account.market_id,
        countryCode: account.country_code,
        currencyCode: account.currency_code,
        destinationType: account.destination_type,
        maskedAccountLabel: account.masked_account_label,
        verificationStatus: account.verification_status,
        isDefault: account.is_default,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      }),
    );

    const payoutHistory = (payouts ?? []).map(
      (payout: any) => ({
        id: payout.id,
        marketId: payout.market_id,
        currencyCode: payout.currency_code,
        amount: payout.amount,
        eligibleForDate: payout.eligible_for_date,
        status: payout.status,
        approvedAt: payout.approved_at,
        rejectedAt: payout.rejected_at,
        processedAt: payout.processed_at,
        paidAt: payout.paid_at,
        failureCode: null,
        failureMessage: payout.status === "failed" && payout.failure_message
          ? "Your payout could not be completed. Please contact support."
          : null,
        createdAt: payout.created_at,
        updatedAt: payout.updated_at,
      }),
    );

    // 7. Payout execution is not enabled.
    // Do not imply that a transfer can currently be requested
    // or scheduled.
    return jsonResponse({
      payoutAccounts,
      payoutHistory,
      payoutAvailability: {
        status: "unavailable",
        payoutsEnabled: false,
        availableBalance: null,
        currencyCode: null,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected trainer payout management error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      {
        error: "Unable to retrieve payout management information.",
      },
      500,
    );
  }
}
