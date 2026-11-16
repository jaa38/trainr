import { supabase } from "@/lib/supabase";

export type AppNotification = {
    id: string;
    outbox_id: string | null;
    user_id: string;
    event_type: string;
    title: string;
    body: string;
    entity_type: string;
    entity_id: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
};

export type NotificationPage = {
    notifications: AppNotification[];
    hasMore: boolean;
    nextPage: number | null;
};

const NOTIFICATION_COLUMNS = `
  id,
  outbox_id,
  user_id,
  event_type,
  title,
  body,
  entity_type,
  entity_id,
  is_read,
  read_at,
  created_at
`;

const DEFAULT_PAGE_SIZE = 20;

async function getAuthenticatedUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        console.error("[Notification History] Unable to verify user:", error);
        throw new Error("Unable to verify your account. Please try again.");
    }

    if (!user) {
        throw new Error("Please sign in to view your notifications.");
    }

    return user;
}

function validatePagination(page: number, pageSize: number) {
    if (!Number.isInteger(page) || page < 0) {
        throw new Error("Invalid notification page.");
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error("Notification page size must be between 1 and 100.");
    }
}

/**
 * Retrieves the authenticated user's notification history.
 * Page numbering starts at zero.
 */
export async function getNotifications(
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
): Promise<NotificationPage> {
    validatePagination(page, pageSize);

    const user = await getAuthenticatedUser();

    const from = page * pageSize;
    const to = from + pageSize;

    const { data, error } = await supabase
        .from("notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to - 1);

    if (error) {
        console.error(
            "[Notification History] Unable to load notifications:",
            error,
        );
        throw new Error("Unable to load notifications. Please try again.");
    }

    const notifications = (data ?? []) as unknown as AppNotification[];
    const hasMore = notifications.length === pageSize;

    return {
        notifications,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
    };
}

/**
 * Retrieves the total unread notification count.
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const user = await getAuthenticatedUser();

    const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {
        console.error(
            "[Notification History] Unable to load unread count:",
            error,
        );
        throw new Error(
            "Unable to load unread notifications. Please try again.",
        );
    }

    return count ?? 0;
}

/**
 * Marks one notification as read.
 * RLS independently enforces ownership.
 */
export async function markNotificationAsRead(
    notificationId: string,
): Promise<void> {
    if (!notificationId?.trim()) {
        throw new Error("A valid notification ID is required.");
    }

    const user = await getAuthenticatedUser();

    const { data, error } = await supabase
        .from("notifications")
        .update({
            is_read: true,
            read_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("user_id", user.id)
        .eq("is_read", false)
        .select("id")
        .maybeSingle();

    if (error) {
        console.error(
            "[Notification History] Unable to mark notification as read:",
            error,
        );
        throw new Error(
            "Unable to update this notification. Please try again.",
        );
    }

    if (!data) {
        // The notification may already be read or may no longer exist.
        // Avoid treating an idempotent update as an error.
        return;
    }
}

/**
 * Marks all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
    const user = await getAuthenticatedUser();

    const { error } = await supabase
        .from("notifications")
        .update({
            is_read: true,
            read_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {
        console.error(
            "[Notification History] Unable to mark all notifications as read:",
            error,
        );
        throw new Error(
            "Unable to update your notifications. Please try again.",
        );
    }
}

/**
 * Marks a notification as read using its notification_outbox ID.
 * Used when a user opens a push notification.
 */
export async function markNotificationAsReadByOutboxId(
    outboxId: string,
): Promise<void> {
    if (!outboxId?.trim()) {
        throw new Error("A valid notification ID is required.");
    }

    const user = await getAuthenticatedUser();

    const { data, error } = await supabase
        .from("notifications")
        .update({
            is_read: true,
            read_at: new Date().toISOString(),
        })
        .eq("outbox_id", outboxId)
        .eq("user_id", user.id)
        .eq("is_read", false)
        .select("id")
        .maybeSingle();

    if (error) {
        console.error(
            "[Notification History] Unable to mark push notification as read:",
            error,
        );
        throw new Error(
            "Unable to update this notification. Please try again.",
        );
    }

    if (!data) {
        // Already read or no matching history record; do not fail navigation.
        return;
    }
}
