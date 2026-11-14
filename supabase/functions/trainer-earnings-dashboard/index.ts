
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * TRAINR — Trainer Earnings Dashboard
 *
 * Reads verified trainer earnings from the immutable earnings ledger.
 *
 * Security:
 * - Requires an authenticated Supabase user.
 * - Verifies the user's trainer role.
 * - Derives trainer identity from the verified access token.
 * - Uses the service-role client exclusively server-side.
 * - Does not expose direct database access to the mobile client.
 *
 * Financial integrity:
 * - Only recognised ledger entries contribute to total earnings.
 * - Recent earnings are read exclusively from recognised ledger entries.
 * - Completed bookings with successful, non-superseded payments
 *   missing from the ledger are checked against the earnings
 *   workflow rollout boundary.
 * - Historical completed bookings before the rollout boundary
 *   are excluded from this active workflow check.
 * - Does not automatically recognise or reconcile historical payments.
 *
 * Payout allocation and payout execution are not implemented here.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const LEDGER_PAGE_SIZE = 500;
const BOOKING_PAGE_SIZE = 500;
const PAYMENT_BOOKING_BATCH_SIZE = 100;
const RECENT_EARNINGS_LIMIT = 10;

type LedgerEntry = {
  payment_id: string;
  trainer_net_amount: string | number;
  currency_code: string;
};

type RecentLedgerEntry = {
  booking_id: string;
  payment_id: string;
  completed_at: string;
  gross_amount: string | number;
  commission_amount: string | number;
  trainer_net_amount: string | number;
  currency_code: string;
};

type RecentEarning = {
  bookingId: string;
  paymentId: string;
  completedAt: string;
  grossAmount: number;
  commissionAmount: number;
  trainerNetAmount: number;
  currencyCode: string;
};

type CompletedBooking = {
  id: string;
};

type SuccessfulPayment = {
  id: string;
  booking_id: string;
};

type MarketAssignment = {
  market_id: string;
  valid_from: string;
};

type TrainerMarket = {
  id: string;
  market_code: string;
  country_code: string;
  currency_code: string;
  timezone_name: string;
  is_active: boolean;
};

type TrainerEarningsDashboard = {
  totalEarnings: number | null;
  nextPayoutAmount: number | null;
  nextPayoutDate: string | null;
  currencyCode: string | null;
  financialStatus: "available" | "no_earnings" | "unavailable";
  nextPayoutStatus: "scheduled" | "not_available" | "unavailable";
  updatedAt: string;
  recentEarnings: RecentEarning[];
};

type DashboardResponse = {
  dashboard: TrainerEarningsDashboard;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

/**
 * Converts a valid monetary amount into integer minor units.
 *
 * This implementation currently assumes a two-decimal currency,
 * matching the existing earnings aggregation implementation.
 */
function toMinorUnits(value: string | number): number {
  const amount = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Invalid monetary amount in earnings ledger.");
  }

  const [whole, decimal = ""] = amount.split(".");
  const minorUnits = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));

  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new Error("Earnings amount is outside the supported range.");
  }

  return minorUnits;
}

function fromMinorUnits(value: number): number {
  return value / 100;
}

function isValidCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function unavailableDashboard(
  currencyCode: string | null = null,
): DashboardResponse {
  return {
    dashboard: {
      totalEarnings: null,
      nextPayoutAmount: null,
      nextPayoutDate: null,
      currencyCode,
      financialStatus: "unavailable",
      nextPayoutStatus: "unavailable",
      updatedAt: new Date().toISOString(),
      recentEarnings: [],
    },
  };
}

/**
 * Checks for completed bookings with successful,
 * non-superseded payments that have not been recognised
 * in the earnings ledger.
 *
 * Only bookings updated on or after the supplied workflow
 * rollout boundary are considered.
 *
 * IMPORTANT:
 * updated_at is being used as a proxy for the completion
 * transition timestamp. This assumes completed bookings are
 * not subsequently updated for unrelated reasons.
 *
 * This function is read-only.
 */
async function hasUnresolvedEarnings(
  adminClient: ReturnType<typeof createClient>,
  trainerId: string,
  recognisedPaymentIds: Set<string>,
  workflowStartAt: string,
): Promise<boolean> {
  const completedBookingIds: string[] = [];

  // 1. Retrieve completed bookings for this trainer
  // within the active earnings workflow period.
  for (let offset = 0; ; offset += BOOKING_PAGE_SIZE) {
    const { data, error } = await adminClient
      .from("trainer_bookings")
      .select("id")
      .eq("trainer_id", trainerId)
      .eq("status", "completed")
      .gte("updated_at", workflowStartAt)
      .order("id", { ascending: true })
      .range(offset, offset + BOOKING_PAGE_SIZE - 1);

    if (error) {
      console.error(
        "Completed booking verification failed:",
        error.message,
      );
      throw new Error("Unable to verify completed bookings.");
    }

    const page = (data ?? []) as CompletedBooking[];
    completedBookingIds.push(...page.map((booking) => booking.id));

    if (page.length < BOOKING_PAGE_SIZE) {
      break;
    }
  }

  if (completedBookingIds.length === 0) {
    return false;
  }

  // 2. Check successful, non-superseded payments
  // for those completed bookings.
  for (
    let index = 0;
    index < completedBookingIds.length;
    index += PAYMENT_BOOKING_BATCH_SIZE
  ) {
    const bookingBatch = completedBookingIds.slice(
      index,
      index + PAYMENT_BOOKING_BATCH_SIZE,
    );

    const { data, error } = await adminClient
      .from("booking_payments")
      .select("id, booking_id")
      .in("booking_id", bookingBatch)
      .eq("status", "successful")
      .is("superseded_by", null);

    if (error) {
      console.error(
        "Successful payment verification failed:",
        error.message,
      );
      throw new Error("Unable to verify successful payments.");
    }

    const payments = (data ?? []) as SuccessfulPayment[];

    // 3. An unrecognised successful payment means
    // earnings processing or reconciliation is outstanding.
    if (payments.some((payment) => !recognisedPaymentIds.has(payment.id))) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves the latest recognised earnings entries.
 *
 * This query intentionally reads only the immutable earnings ledger.
 * It does not use booking payments as a substitute for recognised earnings.
 */
async function getRecentEarnings(
  adminClient: ReturnType<typeof createClient>,
  trainerId: string,
  currencyCode: string,
): Promise<RecentEarning[]> {
  const { data, error } = await adminClient
    .from("trainer_earnings_ledger")
    .select(
      [
        "booking_id",
        "payment_id",
        "completed_at",
        "gross_amount",
        "commission_amount",
        "trainer_net_amount",
        "currency_code",
      ].join(", "),
    )
    .eq("trainer_id", trainerId)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_EARNINGS_LIMIT);

  if (error) {
    console.error("Recent earnings lookup failed:", error.message);
    throw new Error("Unable to retrieve recent earnings.");
  }

  const entries = (data ?? []) as RecentLedgerEntry[];

  return entries.map((entry) => {
    if (entry.currency_code !== currencyCode) {
      throw new Error(
        "Recent earnings currency does not match the trainer's current market.",
      );
    }

    const completedAt = new Date(entry.completed_at);

    if (Number.isNaN(completedAt.getTime())) {
      throw new Error("Invalid completion timestamp in earnings ledger.");
    }

    return {
      bookingId: entry.booking_id,
      paymentId: entry.payment_id,
      completedAt: completedAt.toISOString(),
      grossAmount: fromMinorUnits(toMinorUnits(entry.gross_amount)),
      commissionAmount: fromMinorUnits(toMinorUnits(entry.commission_amount)),
      trainerNetAmount: fromMinorUnits(toMinorUnits(entry.trainer_net_amount)),
      currencyCode: entry.currency_code,
    };
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    // 1. Authenticate the request.
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    // 2. Load server-side environment variables.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("Required Supabase environment variables are missing.");
      return jsonResponse(
        { error: "Earnings service is currently unavailable." },
        500,
      );
    }

    // 3. Create separate authentication and administrative clients.
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 4. Verify the access token with Supabase Auth.
    const {
      data: authData,
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired session." }, 401);
    }

    // Never accept a trainer ID supplied by the mobile client.
    const trainerId = authData.user.id;

    // 5. Verify that the authenticated user is a trainer.
    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", trainerId)
      .maybeSingle();

    if (profileError) {
      console.error("Trainer profile lookup failed:", profileError.message);
      return jsonResponse(
        { error: "Unable to verify trainer account." },
        500,
      );
    }

    if (!profile || profile.role !== "trainer") {
      return jsonResponse({ error: "Trainer access required." }, 403);
    }

    // 6. Retrieve the trainer's current market assignment.
    const now = new Date().toISOString();

    const {
      data: assignments,
      error: assignmentError,
    } = await adminClient
      .from("trainer_market_assignments")
      .select("market_id, valid_from")
      .eq("trainer_id", trainerId)
      .lte("valid_from", now)
      .or(`valid_to.is.null,valid_to.gt.${now}`)
      .order("valid_from", { ascending: false })
      .limit(2);

    if (assignmentError) {
      console.error(
        "Trainer market assignment lookup failed:",
        assignmentError.message,
      );
      return jsonResponse(
        { error: "Unable to retrieve trainer market." },
        500,
      );
    }

    // Exactly one current assignment is required.
    if (!assignments || assignments.length !== 1) {
      return jsonResponse(unavailableDashboard(), 200);
    }

    const assignment = assignments[0] as MarketAssignment;
    const workflowStartAt = new Date(assignment.valid_from);

    if (
      !assignment.valid_from ||
      Number.isNaN(workflowStartAt.getTime())
    ) {
      console.error(
        "Trainer market assignment has an invalid rollout timestamp.",
      );
      return jsonResponse(unavailableDashboard(), 200);
    }

    // 7. Retrieve the assigned market configuration.
    const {
      data: market,
      error: marketError,
    } = await adminClient
      .from("trainer_markets")
      .select(
        "id, market_code, country_code, currency_code, timezone_name, is_active",
      )
      .eq("id", assignment.market_id)
      .maybeSingle();

    if (marketError) {
      console.error("Trainer market lookup failed:", marketError.message);
      return jsonResponse(
        { error: "Unable to retrieve trainer market." },
        500,
      );
    }

    if (!market) {
      return jsonResponse(unavailableDashboard(), 200);
    }

    const trainerMarket = market as TrainerMarket;

    if (
      !trainerMarket.is_active ||
      !isValidCurrencyCode(trainerMarket.currency_code)
    ) {
      return jsonResponse(unavailableDashboard(), 200);
    }

    // 8. Retrieve and aggregate verified earnings ledger entries.
    let totalMinorUnits = 0;
    let entryCount = 0;

    const recognisedPaymentIds = new Set<string>();

    for (let offset = 0; ; offset += LEDGER_PAGE_SIZE) {
      const {
        data: ledgerPage,
        error: ledgerError,
      } = await adminClient
        .from("trainer_earnings_ledger")
        .select("payment_id, trainer_net_amount, currency_code")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + LEDGER_PAGE_SIZE - 1);

      if (ledgerError) {
        console.error("Earnings ledger lookup failed:", ledgerError.message);
        return jsonResponse(
          { error: "Unable to retrieve earnings information." },
          500,
        );
      }

      const page = (ledgerPage ?? []) as LedgerEntry[];

      for (const entry of page) {
        if (entry.currency_code !== trainerMarket.currency_code) {
          console.error(
            "Earnings ledger currency does not match the trainer's current market.",
          );
          return jsonResponse(
            unavailableDashboard(trainerMarket.currency_code),
            200,
          );
        }

        const amountMinorUnits = toMinorUnits(entry.trainer_net_amount);
        totalMinorUnits += amountMinorUnits;

        if (!Number.isSafeInteger(totalMinorUnits)) {
          throw new Error("Total earnings exceed the supported range.");
        }

        recognisedPaymentIds.add(entry.payment_id);
        entryCount += 1;
      }

      if (page.length < LEDGER_PAGE_SIZE) {
        break;
      }
    }

    // 9. Check for unresolved earnings within the active
    // earnings workflow period.
    const unresolvedEarnings = await hasUnresolvedEarnings(
      adminClient,
      trainerId,
      recognisedPaymentIds,
      assignment.valid_from,
    );

    if (unresolvedEarnings) {
      console.warn(
        "Dashboard withheld because completed successful payments require earnings reconciliation.",
      );
      return jsonResponse(
        unavailableDashboard(trainerMarket.currency_code),
        200,
      );
    }

    // 10. Retrieve the latest recognised ledger entries.
    const recentEarnings = await getRecentEarnings(
      adminClient,
      trainerId,
      trainerMarket.currency_code,
    );

    // 11. Return the dashboard response.
    //
    // Ledger amounts are already net of TRAINR commission.
    // Payout allocation and execution have not been implemented.
    const dashboard: TrainerEarningsDashboard = {
      totalEarnings: fromMinorUnits(totalMinorUnits),
      nextPayoutAmount: null,
      nextPayoutDate: null,
      currencyCode: trainerMarket.currency_code,
      financialStatus: entryCount > 0 ? "available" : "no_earnings",
      nextPayoutStatus: "not_available",
      updatedAt: new Date().toISOString(),
      recentEarnings,
    };

    return jsonResponse({ dashboard }, 200);
  } catch (error) {
    console.error(
      "Trainer earnings dashboard error:",
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: "Earnings information is currently unavailable." },
      500,
    );
  }
});
