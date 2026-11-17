type NotificationEvent =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_reschedule_requested"
  | "payment_succeeded"
  | "payment_failed"
  | "session_reminder"
  | "session_completed"
  | "workout_assigned"
  | "trainer_feedback_created"
  | "post_session_followup";

type NotificationPreference =
  | "booking_updates"
  | "session_reminders"
  | "workout_updates"
  | "feedback_updates"
  | "post_session_followups";

type NotificationRow = {
  id: string;
  event_type: NotificationEvent;
  recipient_id: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  locked_by: string;
};

type PushToken = {
  id: string;
  expo_push_token: string;
};

type NotificationCopy = {
  title: string;
  body: string;
};

type WorkerDependencies = {
  getExpectedSecret: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
  getServiceRoleKey: () => string | undefined;
  createClient: (url: string, key: string) => any;
  randomUUID: () => string;
  fetchImpl?: typeof fetch;
  logError: (message: string, detail?: unknown) => void;
};

const BATCH_SIZE = 25;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

class NotificationLockRenewalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationLockRenewalError";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notification-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const preferenceByEvent: Record<NotificationEvent, NotificationPreference> = {
  booking_requested: "booking_updates",
  booking_confirmed: "booking_updates",
  booking_declined: "booking_updates",
  booking_cancelled: "booking_updates",
  booking_reschedule_requested: "booking_updates",
  payment_succeeded: "booking_updates",
  payment_failed: "booking_updates",
  session_reminder: "session_reminders",
  session_completed: "workout_updates",
  workout_assigned: "workout_updates",
  trainer_feedback_created: "feedback_updates",
  post_session_followup: "post_session_followups",
};

const permanentExpoErrors = new Set([
  "MessageTooBig",
]);

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getNotificationCopy(
  eventType: NotificationEvent,
  payload: Record<string, unknown>,
): NotificationCopy {
  switch (eventType) {
    case "booking_requested":
      return {
        title: "New booking request",
        body: "You have received a new training session request.",
      };

    case "booking_confirmed":
      return {
        title: "Booking confirmed",
        body: "Your training session has been confirmed.",
      };

    case "booking_declined":
      return {
        title: "Booking update",
        body: "Your training session request was declined.",
      };

    case "booking_cancelled":
      return {
        title: "Booking cancelled",
        body: "A training session has been cancelled.",
      };

    case "booking_reschedule_requested":
      return {
        title: "Reschedule requested",
        body: "A new training session time has been requested.",
      };

    case "payment_succeeded":
      return {
        title: "Payment successful",
        body: "Your training session payment was successful.",
      };

    case "payment_failed":
      return {
        title: "Payment unsuccessful",
        body: "Your training session payment could not be completed.",
      };

    case "session_reminder": {
      const interval = payload.reminder_interval === "24h"
        ? "24 hours"
        : payload.reminder_interval === "1h"
        ? "1 hour"
        : "soon";

      return {
        title: "Training session reminder",
        body: `Your training session starts in ${interval}.`,
      };
    }

    case "session_completed":
      return {
        title: "Session completed",
        body: "Your training session has been marked as completed.",
      };

    case "workout_assigned":
      return {
        title: "New workout assigned",
        body: "Your trainer has assigned you a new workout plan.",
      };

    case "trainer_feedback_created":
      return {
        title: "New trainer feedback",
        body: "Your trainer has shared feedback on your progress.",
      };

    case "post_session_followup":
      return {
        title: "Time to review your workout",
        body: "Take a moment to reflect on your completed workout.",
      };
  }
}

async function completeAttempt(
  client: any,
  notification: NotificationRow,
  workerId: string,
  outcome: "accepted" | "retryable_failure" | "permanent_failure",
  ticketId?: string,
  error?: string,
): Promise<void> {
  const { error: rpcError } = await client.rpc(
    "complete_notification_attempt",
    {
      p_notification_id: notification.id,
      p_worker_id: workerId,
      p_outcome: outcome,
      p_expo_ticket_id: ticketId ?? null,
      p_error: error ?? null,
    },
  );

  if (rpcError) {
    throw new Error(
      `Could not complete notification ${notification.id}: ${rpcError.message}`,
    );
  }
}

async function deactivateInvalidToken(
  client: any,
  token: PushToken,
): Promise<void> {
  const { error } = await client
    .from("device_push_tokens")
    .update({
      is_active: false,
      last_error: "Expo reported DeviceNotRegistered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", token.id)
    .eq("is_active", true);

  if (error) {
    throw new Error(
      `Could not deactivate invalid push token: ${error.message}`,
    );
  }
}

async function cancelNotification(
  client: any,
  notification: NotificationRow,
  workerId: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "cancelled",
      locked_at: null,
      locked_by: null,
    })
    .eq("id", notification.id)
    .eq("status", "processing")
    .eq("locked_by", workerId);

  if (error) {
    throw new Error(
      `Could not cancel ${reason} notification: ${error.message}`,
    );
  }
}

async function processNotification(
  client: any,
  notification: NotificationRow,
  workerId: string,
  fetchImpl: typeof fetch,
): Promise<"sent" | "failed" | "skipped"> {
  const { data: lockRenewed, error: lockRenewalError } = await client.rpc(
    "renew_notification_lock",
    {
      p_notification_id: notification.id,
      p_worker_id: workerId,
    },
  );

  if (lockRenewalError) {
    throw new NotificationLockRenewalError(
      `Could not renew notification lock: ${lockRenewalError.message}`,
    );
  }

  if (lockRenewed !== true) {
    return "skipped";
  }

  let completionAttempted = false;

  const completeOnce = async (
    outcome: "accepted" | "retryable_failure" | "permanent_failure",
    ticketId?: string,
    error?: string,
  ): Promise<void> => {
    completionAttempted = true;
    return completeAttempt(
      client,
      notification,
      workerId,
      outcome,
      ticketId,
      error,
    );
  };

  try {
    const preference = preferenceByEvent[notification.event_type];

    if (!preference) {
      await completeOnce(
        "permanent_failure",
        undefined,
        `Unsupported notification event: ${notification.event_type}`,
      );
      return "failed";
    }

    // Validate delayed payment failures before creating history or sending push.
    if (notification.event_type === "payment_failed") {
      const paymentId = notification.payload?.payment_id;
      const isValidPaymentId = typeof paymentId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(paymentId);

      if (!isValidPaymentId) {
        await cancelNotification(
          client,
          notification,
          workerId,
          "invalid payment",
        );
        return "skipped";
      }

      const { data: payment, error: paymentError } = await client
        .from("booking_payments")
        .select("status, superseded_by")
        .eq("id", paymentId)
        .eq("gym_goer_id", notification.recipient_id)
        .maybeSingle();

      if (paymentError) {
        throw new Error(
          `Could not validate payment failure notification: ${paymentError.message}`,
        );
      }

      if (
        !payment ||
        payment.status !== "failed" ||
        payment.superseded_by !== null
      ) {
        await cancelNotification(
          client,
          notification,
          workerId,
          "obsolete payment failure",
        );
        return "skipped";
      }
    }

    // Generate the notification copy once for both history and push.
    const copy = getNotificationCopy(
      notification.event_type,
      notification.payload ?? {},
    );

    // Create user-facing notification history independently of push delivery.
    // The unique outbox_id prevents duplicate history entries during retries.
    const { error: historyError } = await client
      .from("notifications")
      .upsert(
        {
          outbox_id: notification.id,
          user_id: notification.recipient_id,
          event_type: notification.event_type,
          title: copy.title,
          body: copy.body,
          entity_type: notification.entity_type,
          entity_id: notification.entity_id,
        },
        {
          onConflict: "outbox_id",
          ignoreDuplicates: true,
        },
      );

    if (historyError) {
      throw new Error(
        `Could not create notification history: ${historyError.message}`,
      );
    }

    // Push preferences control push delivery, not in-app notification history.
    const { data: preferences, error: preferenceError } = await client
      .from("notification_preferences")
      .select(preference)
      .eq("user_id", notification.recipient_id)
      .maybeSingle();

    if (preferenceError) {
      throw new Error(
        `Could not read notification preferences: ${preferenceError.message}`,
      );
    }

    // Missing preference rows use the database's default-enabled behaviour.
    if (preferences && preferences[preference] === false) {
      await cancelNotification(
        client,
        notification,
        workerId,
        "opted-out",
      );
      return "skipped";
    }

    const { data: tokens, error: tokenError } = await client
      .from("device_push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", notification.recipient_id)
      .eq("is_active", true);

    if (tokenError) {
      throw new Error(
        `Could not retrieve device tokens: ${tokenError.message}`,
      );
    }

    if (!tokens?.length) {
      await completeOnce(
        "retryable_failure",
        undefined,
        "No active push tokens are registered for this recipient.",
      );
      return "failed";
    }

    let acceptedTicketId: string | undefined;
    let permanentError: string | undefined;
    let retryableError: string | undefined;
    let invalidTokenCount = 0;

    const tokenList = tokens as PushToken[];

    // Expo accepts a maximum of 100 messages per request.
    for (let offset = 0; offset < tokenList.length; offset += 100) {
      const tokenBatch = tokenList.slice(offset, offset + 100);

      const messages = tokenBatch.map((token) => ({
        to: token.expo_push_token,
        sound: "default",
        title: copy.title,
        body: copy.body,
        data: {
          notificationId: notification.id,
          eventType: notification.event_type,
          entityType: notification.entity_type,
          entityId: notification.entity_id,
          payload: notification.payload ?? {},
        },
      }));

      const response = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const responseText = await response.text();

        retryableError ??= `Expo API returned HTTP ${response.status}: ${
          responseText.slice(0, 500)
        }`;

        continue;
      }

      const result = await response.json();
      const tickets = Array.isArray(result?.data)
        ? result.data
        : result?.data
        ? [result.data]
        : [];

      if (tickets.length !== messages.length) {
        retryableError ??=
          "Expo returned an unexpected number of push tickets.";
        continue;
      }

      // Expo tickets correspond to messages in the same batch and order.
      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        const token = tokenBatch[index];

        if (ticket?.status === "ok" && typeof ticket.id === "string") {
          acceptedTicketId ??= ticket.id;
          continue;
        }

        const expoError = ticket?.details?.error ?? ticket?.message ??
          "Unknown Expo error";

        if (expoError === "DeviceNotRegistered") {
          await deactivateInvalidToken(client, token);
          invalidTokenCount += 1;
          continue;
        }

        if (permanentExpoErrors.has(expoError)) {
          permanentError ??= String(expoError);
        } else {
          retryableError ??= String(expoError);
        }
      }
    }

    if (acceptedTicketId && !retryableError) {
      await completeOnce(
        "accepted",
        acceptedTicketId,
      );
      return "sent";
    }

    if (!acceptedTicketId && invalidTokenCount === tokens.length) {
      await completeOnce(
        "permanent_failure",
        undefined,
        "All registered push tokens were reported as unregistered by Expo.",
      );
      return "failed";
    }

    if (permanentError && !retryableError && !acceptedTicketId) {
      await completeOnce(
        "permanent_failure",
        undefined,
        permanentError,
      );
      return "failed";
    }

    await completeOnce(
      "retryable_failure",
      undefined,
      retryableError ?? permanentError ??
        "Expo did not accept any push messages.",
    );

    return "failed";
  } catch (error) {
    if (completionAttempted) {
      throw error;
    }

    const message = error instanceof Error
      ? error.message
      : "Unknown notification error";

    await completeOnce(
      "retryable_failure",
      undefined,
      message,
    );

    return "failed";
  }
}

export async function handleNotificationWorkerRequest(
  request: Request,
  dependencies: WorkerDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const expectedSecret = dependencies.getExpectedSecret();
  const providedSecret = request.headers.get("x-notification-worker-secret");

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = dependencies.getSupabaseUrl();
  const serviceRoleKey = dependencies.getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Worker configuration is incomplete." }, 500);
  }

  try {
    const client = dependencies.createClient(supabaseUrl, serviceRoleKey);
    const workerId = dependencies.randomUUID();
    const fetchImpl = dependencies.fetchImpl ?? fetch;

    const { error: recoveryError } = await client.rpc(
      "recover_stale_notification_locks",
      { p_batch_size: 100 },
    );

    if (recoveryError) {
      throw new Error(
        `Could not recover stale notification locks: ${recoveryError.message}`,
      );
    }

    const { data: notifications, error: claimError } = await client.rpc(
      "claim_notification_batch",
      {
        p_worker_id: workerId,
        p_batch_size: BATCH_SIZE,
      },
    );

    if (claimError) {
      throw new Error(
        `Could not claim notification batch: ${claimError.message}`,
      );
    }

    if (!Array.isArray(notifications)) {
      throw new Error("Notification claim RPC returned an invalid response.");
    }

    const summary = {
      claimed: notifications.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const notification of notifications as NotificationRow[]) {
      try {
        const outcome = await processNotification(
          client,
          notification,
          workerId,
          fetchImpl,
        );

        summary[outcome] += 1;
      } catch (error) {
        if (!(error instanceof NotificationLockRenewalError)) {
          throw error;
        }

        summary.failed += 1;
        dependencies.logError(
          `Could not renew lock for notification ${notification.id}.`,
          error,
        );
      }
    }

    return jsonResponse({ success: true, workerId, ...summary });
  } catch (error) {
    dependencies.logError("Notification worker failed.", error);

    return jsonResponse(
      {
        error: "Notification processing failed.",
      },
      500,
    );
  }
}
