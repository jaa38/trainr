import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
    },
  });

const PAYMENT_STATUSES = ['pending', 'successful', 'failed', 'cancelled'] as const;

type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

type RequestBody = {
  page?: unknown;
  pageSize?: unknown;
  status?: unknown;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  // 1. Validate authentication.
  const authorization = req.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  // 2. Validate environment configuration.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Transaction history Supabase configuration is incomplete.');

    return jsonResponse({ error: 'Transaction history is not configured.' }, 500);
  }

  // 3. Resolve the authenticated user.
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  // The trainer identity always comes from the verified JWT.
  const trainerId = user.id;

  // 4. Validate pagination and optional status filter.
  let body: RequestBody = {};

  try {
    const parsed = await req.json();

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ error: 'Request body must be a JSON object.' }, 400);
    }

    body = parsed as RequestBody;
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  const page = body.page ?? 1;
  const pageSize = body.pageSize ?? 20;
  const status = body.status;

  if (!isPositiveInteger(page)) {
    return jsonResponse({ error: 'page must be a positive integer.' }, 400);
  }

  if (!isPositiveInteger(pageSize) || pageSize > 50) {
    return jsonResponse({ error: 'pageSize must be between 1 and 50.' }, 400);
  }

  if (status !== undefined && !isPaymentStatus(status)) {
    return jsonResponse({ error: 'Invalid payment status filter.' }, 400);
  }

  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset)) {
    return jsonResponse({ error: 'Requested page is out of range.' }, 400);
  }

  // 5. Create the privileged client.
  //
  // Service-role access is confined to this function.
  // Every transaction is scoped to the authenticated trainer
  // through its associated trainer booking.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 6. Retrieve the trainer's payment history.
  //
  // Use the explicit booking foreign key because the schema
  // also contains a composite booking-owner foreign key.
  //
  // Superseded payment attempts are excluded so that retries
  // do not appear as additional active transaction records.
  let query = adminClient
    .from('booking_payments')
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
      { count: 'exact' },
    )
    .eq('booking.trainer_id', trainerId)
    .is('superseded_by', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const {
    data: payments,
    error: paymentError,
    count,
  } = await query.range(offset, offset + pageSize - 1);

  if (paymentError) {
    console.error('Trainer transaction history lookup failed:', paymentError.message);

    return jsonResponse({ error: 'Unable to retrieve transaction history.' }, 500);
  }

  // 7. Return a deliberately limited response.
  //
  // No gym-goer personal information, payment authorization
  // URLs, provider references, commission calculations or
  // payout information are exposed.
  const transactions = (payments ?? []).map((payment) => {
    const booking = Array.isArray(payment.booking) ? payment.booking[0] : payment.booking;

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
      hasPreviousPage: page > 1,
    },
    filters: {
      status: status ?? null,
    },
  });
});
