const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
): Promise<boolean> {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );

  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  let difference = 0;
  const normalizedSignature = signature.toLowerCase();

  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^
      normalizedSignature.charCodeAt(i);
  }

  return difference === 0;
}

type WebhookEvent = {
  event?: unknown;
  data?: {
    id?: unknown;
    reference?: unknown;
    status?: unknown;
    amount?: unknown;
    currency?: unknown;
  };
};

export type WebhookProcessor = (args: {
  eventKey: string;
  eventType: string;
  reference: string | null;
  amountKobo: number | null;
  currency: string | null;
  providerStatus: string | null;
}) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type WebhookDependencies = {
  getSecretKey: () => string | undefined;
  processEvent: WebhookProcessor;
};

export async function handlePaystackWebhook(
  req: Request,
  dependencies: WebhookDependencies,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const secretKey = dependencies.getSecretKey();

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");
    return jsonResponse({ error: "Webhook is not configured." }, 500);
  }

  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch {
    return jsonResponse({ error: "Unable to read request body." }, 400);
  }

  let validSignature: boolean;

  try {
    validSignature = await verifyPaystackSignature(
      rawBody,
      req.headers.get("x-paystack-signature"),
      secretKey,
    );
  } catch {
    return jsonResponse({ error: "Unable to verify webhook signature." }, 500);
  }

  if (!validSignature) {
    return jsonResponse({ error: "Invalid webhook signature." }, 401);
  }

  let event: WebhookEvent;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  if (
    typeof event.event !== "string" ||
    event.event.length === 0 ||
    event.event.length > 100
  ) {
    return jsonResponse({ error: "Invalid event type." }, 400);
  }

  const data = event.data;
  const reference = typeof data?.reference === "string" ? data.reference : null;
  const currency = typeof data?.currency === "string" ? data.currency : null;
  const providerStatus = typeof data?.status === "string" ? data.status : null;

  const amountKobo = typeof data?.amount === "number" &&
      Number.isSafeInteger(data.amount) && data.amount > 0
    ? data.amount
    : null;

  // Paystack transaction IDs provide a stable key across webhook retries.
  // If absent, hash the exact signed payload for deterministic deduplication.
  let eventIdentity: string;

  if (
    (typeof data?.id === "number" && Number.isSafeInteger(data.id)) ||
    (typeof data?.id === "string" && data.id.length > 0)
  ) {
    eventIdentity = String(data.id);
  } else {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawBody),
    );
    eventIdentity = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const eventKey = `${event.event}:${eventIdentity}`;

  try {
    const { data: result, error } = await dependencies.processEvent({
      eventKey,
      eventType: event.event,
      reference,
      amountKobo,
      currency,
      providerStatus,
    });

    if (error) {
      console.error("Paystack webhook processing failed:", error.message);
      return jsonResponse({ error: "Unable to process webhook event." }, 500);
    }

    const row = Array.isArray(result) ? result[0] : result;

    if (!row || typeof row !== "object") {
      return jsonResponse(
        { error: "Unexpected webhook processing result." },
        500,
      );
    }

    const outcome = row as {
      event_status?: string;
      duplicate?: boolean;
      message?: string;
    };

    if (
      outcome.event_status === "received" ||
      outcome.event_status === "processing"
    ) {
      return jsonResponse({ error: "Event processing is incomplete." }, 500);
    }

    return jsonResponse({
      received: true,
      duplicate: outcome.duplicate === true,
      eventStatus: outcome.event_status ?? "unknown",
      message: outcome.message ?? "Event recorded.",
    });
  } catch (error) {
    console.error(
      "Paystack webhook processing threw an error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse({ error: "Unable to process webhook event." }, 500);
  }
}
