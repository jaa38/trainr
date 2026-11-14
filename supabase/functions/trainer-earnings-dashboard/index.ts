import { createClient } from "npm:@supabase/supabase-js@2";

/**

 * TRAINR — Trainer Earnings Dashboard

 *

 * Financial source of truth: trainer_earnings_ledger.

 *

 * Analytics use local_completion_date from the immutable ledger,

 * based on the trainer's assigned market timezone.

 *

 * Security:

 * - Requires an authenticated Supabase user.

 * - Verifies the user's trainer role.

 * - Derives trainer identity from the verified access token.

 * - Uses the service-role client exclusively server-side.

 * - Does not expose direct database access to the mobile client.

 *

 * Financial integrity:

 * - Only recognised ledger entries contribute to earnings.

 * - Gross, commission and net are read from the ledger.

 * - Completed bookings with successful, non-superseded payments

 *   missing from the ledger are checked against the workflow boundary.

 * - Historical completed bookings before the rollout boundary

 *   are excluded from this active workflow check.

 * - Does not automatically recognise or reconcile historical payments.

 *

 * Payout allocation and payout execution are not implemented.

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

type EarningsPeriod =
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year";

type LedgerEntry = {
  payment_id: string;

  trainer_net_amount: string | number;

  currency_code: string;
};

type AnalyticsLedgerEntry = {
  id: string;

  payment_id: string;

  local_completion_date: string;

  gross_amount: string | number;

  commission_amount: string | number;

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

type TrendPoint = {
  date: string;

  grossRevenue: number;

  commissionAmount: number;

  netEarnings: number;
};

type TrainerEarningsAnalytics = {
  period: EarningsPeriod;

  startDate: string;

  endDate: string;

  grossRevenue: number;

  commissionAmount: number;

  netEarnings: number;

  completedSessions: number;

  currencyCode: string;

  trend: TrendPoint[];
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

  analytics: TrainerEarningsAnalytics | null;
};

type DashboardResponse = {
  dashboard: TrainerEarningsDashboard;
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

type CompletedBooking = {
  id: string;
};

type SuccessfulPayment = {
  id: string;

  booking_id: string;
};

type DateRange = {
  startDate: string;

  endDate: string;

  bucket: "day" | "month";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function isEarningsPeriod(value: unknown): value is EarningsPeriod {
  return (
    typeof value === "string" &&
    [
      "this_week",

      "this_month",

      "last_month",

      "last_3_months",

      "this_year",
    ].includes(value)
  );
}

/**

 * Converts a valid monetary amount into integer minor units.

 *

 * Retains the existing two-decimal currency assumption.

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

      analytics: null,
    },
  };
}

/**

 * Returns the current date in the assigned market timezone.

 * Result format: YYYY-MM-DD.

 */

function getMarketLocalDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const year = values.year;

  const month = values.month;

  const day = values.day;

  if (!year || !month || !day) {
    throw new Error("Unable to determine market-local date.");
  }

  return `${year}-${month}-${day}`;
}

/**

 * Date-only arithmetic uses UTC to avoid daylight-saving

 * transitions affecting calendar date calculations.

 */

function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid reporting date.");
  }

  parsed.setUTCDate(parsed.getUTCDate() + amount);

  return parsed.toISOString().slice(0, 10);
}

function addMonths(date: string, amount: number): string {
  const [year, month] = date.split("-").map(Number);

  const parsed = new Date(
    Date.UTC(year, month - 1 + amount, 1),
  );

  return parsed.toISOString().slice(0, 10);
}

/**

 * Reporting periods:

 *

 * this_week: Monday through today.

 * this_month: First day of current month through today.

 * last_month: Previous calendar month.

 * last_3_months: Current month and previous two calendar months.

 * this_year: January 1 through today.

 */

function getDateRange(
  period: EarningsPeriod,
  today: string,
): DateRange {
  const [year, month, day] = today.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid market-local date.");
  }

  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

  switch (period) {
    case "this_week": {
      const weekday = new Date(
        `${today}T00:00:00.000Z`,
      ).getUTCDay();

      // Monday = 0, Sunday = 6.

      const daysSinceMonday = (weekday + 6) % 7;

      return {
        startDate: addDays(today, -daysSinceMonday),

        endDate: today,

        bucket: "day",
      };
    }

    case "this_month":
      return {
        startDate: firstOfMonth,

        endDate: today,

        bucket: "day",
      };

    case "last_month": {
      const previousMonth = addMonths(firstOfMonth, -1);

      return {
        startDate: previousMonth,

        endDate: addDays(firstOfMonth, -1),

        bucket: "day",
      };
    }

    case "last_3_months":
      return {
        startDate: addMonths(firstOfMonth, -2),

        endDate: today,

        bucket: "month",
      };

    case "this_year":
      return {
        startDate: `${year}-01-01`,

        endDate: today,

        bucket: "month",
      };
  }
}

/**

 * Creates zero-filled trend buckets.

 *

 * Daily buckets are used for weekly and monthly views.

 * Monthly buckets are used for three-month and yearly views.

 */

function buildTrendDates(range: DateRange): TrendPoint[] {
  const dates: string[] = [];

  if (range.bucket === "day") {
    for (
      let date = range.startDate;
      date <= range.endDate;
      date = addDays(date, 1)
    ) {
      dates.push(date);
    }
  } else {
    const startMonth = `${range.startDate.slice(0, 7)}-01`;

    const endMonth = `${range.endDate.slice(0, 7)}-01`;

    for (
      let date = startMonth;
      date <= endMonth;
      date = addMonths(date, 1)
    ) {
      dates.push(date.slice(0, 7));
    }
  }

  return dates.map((date) => ({
    date,

    grossRevenue: 0,

    commissionAmount: 0,

    netEarnings: 0,
  }));
}

/**

 * Checks for completed bookings with successful,

 * non-superseded payments that have not been recognised

 * in the earnings ledger.

 *

 * Only bookings updated on or after the supplied workflow

 * rollout boundary are considered.

 *

 * updated_at is used as a proxy for the completion transition

 * timestamp. This assumes completed bookings are not subsequently

 * updated for unrelated reasons.

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

  for (let offset = 0;; offset += BOOKING_PAGE_SIZE) {
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

    completedBookingIds.push(
      ...page.map((booking) => booking.id),
    );

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

    if (
      payments.some(
        (payment) => !recognisedPaymentIds.has(payment.id),
      )
    ) {
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

      grossAmount: fromMinorUnits(
        toMinorUnits(entry.gross_amount),
      ),

      commissionAmount: fromMinorUnits(
        toMinorUnits(entry.commission_amount),
      ),

      trainerNetAmount: fromMinorUnits(
        toMinorUnits(entry.trainer_net_amount),
      ),

      currencyCode: entry.currency_code,
    };
  });
}

/**

 * Aggregates period analytics from recognised ledger entries.

 *

 * Uses local_completion_date for filtering and grouping.

 * No device timezone or payment timestamp is used.

 *

 * All monetary aggregation is performed in integer minor units

 * to avoid floating-point precision errors.

 */

async function getEarningsAnalytics(
  adminClient: ReturnType<typeof createClient>,
  trainerId: string,
  currencyCode: string,
  period: EarningsPeriod,
  range: DateRange,
): Promise<TrainerEarningsAnalytics> {
  const trend = buildTrendDates(range);

  // Keep trend aggregation in integer minor units.

  const trendMinorUnitsByDate = new Map(
    trend.map((point) => [
      point.date,

      {
        gross: 0,

        commission: 0,

        net: 0,
      },
    ]),
  );

  let grossMinorUnits = 0;

  let commissionMinorUnits = 0;

  let netMinorUnits = 0;

  let completedSessions = 0;

  for (let offset = 0;; offset += LEDGER_PAGE_SIZE) {
    const { data, error } = await adminClient
      .from("trainer_earnings_ledger")
      .select(
        [
          "id",

          "payment_id",

          "local_completion_date",

          "gross_amount",

          "commission_amount",

          "trainer_net_amount",

          "currency_code",
        ].join(", "),
      )
      .eq("trainer_id", trainerId)
      .gte("local_completion_date", range.startDate)
      .lte("local_completion_date", range.endDate)
      .order("local_completion_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + LEDGER_PAGE_SIZE - 1);

    if (error) {
      console.error(
        "Earnings analytics lookup failed:",
        error.message,
      );

      throw new Error("Unable to retrieve earnings analytics.");
    }

    const entries = (data ?? []) as AnalyticsLedgerEntry[];

    for (const entry of entries) {
      if (entry.currency_code !== currencyCode) {
        throw new Error(
          "Analytics currency does not match the trainer's current market.",
        );
      }

      const gross = toMinorUnits(entry.gross_amount);

      const commission = toMinorUnits(entry.commission_amount);

      const net = toMinorUnits(entry.trainer_net_amount);

      // Preserve the ledger's financial integrity invariant.

      if (gross !== commission + net) {
        throw new Error(
          "Earnings ledger contains an inconsistent financial entry.",
        );
      }

      // Aggregate overall period totals.

      grossMinorUnits += gross;

      commissionMinorUnits += commission;

      netMinorUnits += net;

      if (
        !Number.isSafeInteger(grossMinorUnits) ||
        !Number.isSafeInteger(commissionMinorUnits) ||
        !Number.isSafeInteger(netMinorUnits)
      ) {
        throw new Error(
          "Analytics totals exceed the supported range.",
        );
      }

      completedSessions += 1;

      if (!Number.isSafeInteger(completedSessions)) {
        throw new Error(
          "Completed session count exceeds the supported range.",
        );
      }

      // Determine the correct daily or monthly trend bucket.

      const bucketDate = range.bucket === "month"
        ? entry.local_completion_date.slice(0, 7)
        : entry.local_completion_date;

      const bucket = trendMinorUnitsByDate.get(bucketDate);

      if (!bucket) {
        throw new Error(
          "Earnings entry falls outside the requested reporting period.",
        );
      }

      // Aggregate each trend bucket in integer minor units.

      bucket.gross += gross;

      bucket.commission += commission;

      bucket.net += net;

      if (
        !Number.isSafeInteger(bucket.gross) ||
        !Number.isSafeInteger(bucket.commission) ||
        !Number.isSafeInteger(bucket.net)
      ) {
        throw new Error(
          "Trend totals exceed the supported range.",
        );
      }
    }

    if (entries.length < LEDGER_PAGE_SIZE) {
      break;
    }
  }

  // Convert trend values into currency amounts only after aggregation.

  const completedTrend: TrendPoint[] = trend.map((point) => {
    const bucket = trendMinorUnitsByDate.get(point.date);

    if (!bucket) {
      throw new Error("Missing earnings trend bucket.");
    }

    return {
      date: point.date,

      grossRevenue: fromMinorUnits(bucket.gross),

      commissionAmount: fromMinorUnits(bucket.commission),

      netEarnings: fromMinorUnits(bucket.net),
    };
  });

  return {
    period,

    startDate: range.startDate,

    endDate: range.endDate,

    grossRevenue: fromMinorUnits(grossMinorUnits),

    commissionAmount: fromMinorUnits(commissionMinorUnits),

    netEarnings: fromMinorUnits(netMinorUnits),

    completedSessions,

    currencyCode,

    trend: completedTrend,
  };
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
    // 1. Validate the request body and reporting period.

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    if (!isRecord(requestBody)) {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    if (
      requestBody.period !== undefined &&
      !isEarningsPeriod(requestBody.period)
    ) {
      return jsonResponse(
        { error: "Invalid earnings reporting period." },
        400,
      );
    }

    const period: EarningsPeriod = requestBody.period === undefined
      ? "this_month"
      : requestBody.period;

    // 2. Authenticate the request.

    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
      );
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
      );
    }

    // 3. Load server-side environment variables.

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const supabaseServiceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey
    ) {
      console.error(
        "Required Supabase environment variables are missing.",
      );

      return jsonResponse(
        { error: "Earnings service is currently unavailable." },
        500,
      );
    }

    // 4. Create separate authentication and administrative clients.

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,

          autoRefreshToken: false,
        },
      },
    );

    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,

          autoRefreshToken: false,
        },
      },
    );

    // 5. Verify the access token with Supabase Auth.

    const {
      data: authData,

      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return jsonResponse(
        { error: "Invalid or expired session." },
        401,
      );
    }

    // Never accept a trainer ID supplied by the mobile client.

    const trainerId = authData.user.id;

    // 6. Verify that the authenticated user is a trainer.

    const {
      data: profile,

      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", trainerId)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Trainer profile lookup failed:",
        profileError.message,
      );

      return jsonResponse(
        { error: "Unable to verify trainer account." },
        500,
      );
    }

    if (!profile || profile.role !== "trainer") {
      return jsonResponse(
        { error: "Trainer access required." },
        403,
      );
    }

    // 7. Retrieve the trainer's current market assignment.

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

    // 8. Retrieve the assigned market configuration.

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
      console.error(
        "Trainer market lookup failed:",
        marketError.message,
      );

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

    // 9. Calculate reporting dates in the assigned market timezone.

    let today: string;

    let range: DateRange;

    try {
      today = getMarketLocalDate(trainerMarket.timezone_name);

      range = getDateRange(period, today);
    } catch (error) {
      console.error(
        "Market timezone or reporting period is invalid:",
        error instanceof Error ? error.message : error,
      );

      return jsonResponse(
        unavailableDashboard(trainerMarket.currency_code),
        200,
      );
    }

    // 10. Retrieve and aggregate lifetime verified ledger entries.

    let totalMinorUnits = 0;

    let entryCount = 0;

    const recognisedPaymentIds = new Set<string>();

    for (let offset = 0;; offset += LEDGER_PAGE_SIZE) {
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
        console.error(
          "Earnings ledger lookup failed:",
          ledgerError.message,
        );

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

        totalMinorUnits += toMinorUnits(
          entry.trainer_net_amount,
        );

        if (!Number.isSafeInteger(totalMinorUnits)) {
          throw new Error(
            "Total earnings exceed the supported range.",
          );
        }

        recognisedPaymentIds.add(entry.payment_id);

        entryCount += 1;
      }

      if (page.length < LEDGER_PAGE_SIZE) {
        break;
      }
    }

    // 11. Check for unresolved earnings within the active workflow.

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

    // 12. Retrieve recent earnings and selected-period analytics.

    const [recentEarnings, analytics] = await Promise.all([
      getRecentEarnings(
        adminClient,
        trainerId,
        trainerMarket.currency_code,
      ),

      getEarningsAnalytics(
        adminClient,
        trainerId,
        trainerMarket.currency_code,
        period,
        range,
      ),
    ]);

    // 13. Return the dashboard response.

    //

    // Lifetime earnings are net of TRAINR commission.

    // Period analytics include gross, commission and net.

    // Payout allocation and execution remain unimplemented.

    const dashboard: TrainerEarningsDashboard = {
      totalEarnings: fromMinorUnits(totalMinorUnits),

      nextPayoutAmount: null,

      nextPayoutDate: null,

      currencyCode: trainerMarket.currency_code,

      financialStatus: entryCount > 0 ? "available" : "no_earnings",

      nextPayoutStatus: "not_available",

      updatedAt: new Date().toISOString(),

      recentEarnings,

      analytics,
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
