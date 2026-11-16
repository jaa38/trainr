import { supabase } from "@/lib/supabase";
import {
    type AppNotification,
    getNotifications,
    getUnreadNotificationCount,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    markNotificationAsReadByOutboxId,
} from "../notifications/notification-history";

jest.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    },
}));

const mockedGetUser = jest.mocked(supabase.auth.getUser);
const mockedFrom = jest.mocked(supabase.from);

const mockUser = {
    id: "user-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
};

const mockNotification: AppNotification = {
    id: "notification-123",
    outbox_id: "outbox-123",
    user_id: "user-123",
    event_type: "booking_confirmed",
    title: "Booking confirmed",
    body: "Your training session has been confirmed.",
    entity_type: "booking",
    entity_id: "booking-123",
    is_read: false,
    read_at: null,
    created_at: "2026-11-15T08:00:00.000Z",
};

function mockListQuery(response: { data: unknown; error: unknown }) {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        range: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue(response);

    mockedFrom.mockReturnValueOnce(query as never);

    return query;
}

function mockCountQuery(response: { count: number | null; error: unknown }) {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValueOnce(query);
    query.eq.mockResolvedValue(response);

    mockedFrom.mockReturnValueOnce(query as never);

    return query;
}

function mockSingleUpdateQuery(response: {
    data: unknown;
    error: unknown;
}) {
    const query = {
        update: jest.fn(),
        eq: jest.fn(),
        select: jest.fn(),
        maybeSingle: jest.fn(),
    };

    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue(response);

    mockedFrom.mockReturnValueOnce(query as never);

    return query;
}

function mockBulkUpdateQuery(response: { error: unknown }) {
    const query = {
        update: jest.fn(),
        eq: jest.fn(),
    };

    query.update.mockReturnValue(query);
    query.eq.mockReturnValueOnce(query);
    query.eq.mockResolvedValue(response);

    mockedFrom.mockReturnValueOnce(query as never);

    return query;
}

describe("Notification history service", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockedGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        } as never);
    });

    describe("getNotifications", () => {
        it("retrieves the first page of notifications", async () => {
            const query = mockListQuery({
                data: [mockNotification],
                error: null,
            });

            await expect(getNotifications()).resolves.toEqual({
                notifications: [mockNotification],
                hasMore: false,
                nextPage: null,
            });

            expect(mockedFrom).toHaveBeenCalledWith("notifications");
            expect(query.eq).toHaveBeenCalledWith("user_id", "user-123");
            expect(query.order).toHaveBeenCalledWith("created_at", {
                ascending: false,
            });
            expect(query.range).toHaveBeenCalledWith(0, 19);
        });

        it("supports pagination when another page may exist", async () => {
            const notifications = Array.from({ length: 10 }, (_, index) => ({
                ...mockNotification,
                id: `notification-${index}`,
            }));

            const query = mockListQuery({
                data: notifications,
                error: null,
            });

            await expect(getNotifications(2, 10)).resolves.toEqual({
                notifications,
                hasMore: true,
                nextPage: 3,
            });

            expect(query.range).toHaveBeenCalledWith(20, 29);
        });

        it("returns an empty page when no notifications exist", async () => {
            mockListQuery({ data: null, error: null });

            await expect(getNotifications()).resolves.toEqual({
                notifications: [],
                hasMore: false,
                nextPage: null,
            });
        });

        it("rejects invalid page numbers", async () => {
            await expect(getNotifications(-1)).rejects.toThrow(
                "Invalid notification page.",
            );

            expect(mockedGetUser).not.toHaveBeenCalled();
        });

        it("rejects invalid page sizes", async () => {
            await expect(getNotifications(0, 101)).rejects.toThrow(
                "Notification page size must be between 1 and 100.",
            );

            expect(mockedGetUser).not.toHaveBeenCalled();
        });

        it("throws when the database query fails", async () => {
            mockListQuery({
                data: null,
                error: { message: "Permission denied" },
            });

            await expect(getNotifications()).rejects.toThrow(
                "Unable to load notifications. Please try again.",
            );
        });
    });

    describe("getUnreadNotificationCount", () => {
        it("retrieves the authenticated user unread count", async () => {
            const query = mockCountQuery({
                count: 5,
                error: null,
            });

            await expect(getUnreadNotificationCount()).resolves.toBe(5);

            expect(mockedFrom).toHaveBeenCalledWith("notifications");
            expect(query.select).toHaveBeenCalledWith("id", {
                count: "exact",
                head: true,
            });
            expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", "user-123");
            expect(query.eq).toHaveBeenNthCalledWith(2, "is_read", false);
        });

        it("returns zero when the count is null", async () => {
            mockCountQuery({ count: null, error: null });

            await expect(getUnreadNotificationCount()).resolves.toBe(0);
        });

        it("throws when the count query fails", async () => {
            mockCountQuery({
                count: null,
                error: { message: "Query failed" },
            });

            await expect(getUnreadNotificationCount()).rejects.toThrow(
                "Unable to load unread notifications. Please try again.",
            );
        });
    });

    describe("markNotificationAsRead", () => {
        it("marks an unread notification as read", async () => {
            const query = mockSingleUpdateQuery({
                data: { id: mockNotification.id },
                error: null,
            });

            await expect(
                markNotificationAsRead(mockNotification.id),
            ).resolves.toBeUndefined();

            expect(mockedFrom).toHaveBeenCalledWith("notifications");
            expect(query.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    is_read: true,
                    read_at: expect.any(String),
                }),
            );
            expect(query.eq).toHaveBeenNthCalledWith(
                1,
                "id",
                "notification-123",
            );
            expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
            expect(query.eq).toHaveBeenNthCalledWith(3, "is_read", false);
        });

        it("rejects an empty notification ID", async () => {
            await expect(markNotificationAsRead("")).rejects.toThrow(
                "A valid notification ID is required.",
            );

            expect(mockedGetUser).not.toHaveBeenCalled();
        });

        it("does not fail when the notification is already read or missing", async () => {
            mockSingleUpdateQuery({ data: null, error: null });

            await expect(
                markNotificationAsRead("notification-123"),
            ).resolves.toBeUndefined();
        });

        it("throws when the update fails", async () => {
            mockSingleUpdateQuery({
                data: null,
                error: { message: "Update failed" },
            });

            await expect(
                markNotificationAsRead("notification-123"),
            ).rejects.toThrow(
                "Unable to update this notification. Please try again.",
            );
        });
    });

    describe("markNotificationAsReadByOutboxId", () => {
        it("marks a push notification as read using its outbox ID", async () => {
            const query = mockSingleUpdateQuery({
                data: { id: mockNotification.id },
                error: null,
            });

            await expect(
                markNotificationAsReadByOutboxId("outbox-123"),
            ).resolves.toBeUndefined();

            expect(mockedFrom).toHaveBeenCalledWith("notifications");
            expect(query.eq).toHaveBeenNthCalledWith(1, "outbox_id", "outbox-123");
            expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
            expect(query.eq).toHaveBeenNthCalledWith(3, "is_read", false);
            expect(query.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    is_read: true,
                    read_at: expect.any(String),
                }),
            );
        });

        it("rejects an empty outbox ID", async () => {
            await expect(
                markNotificationAsReadByOutboxId(" "),
            ).rejects.toThrow("A valid notification ID is required.");

            expect(mockedGetUser).not.toHaveBeenCalled();
        });

        it("does not fail when the history record is already read or missing", async () => {
            mockSingleUpdateQuery({ data: null, error: null });

            await expect(
                markNotificationAsReadByOutboxId("outbox-123"),
            ).resolves.toBeUndefined();
        });

        it("throws when the outbox notification update fails", async () => {
            mockSingleUpdateQuery({
                data: null,
                error: { message: "Update failed" },
            });

            await expect(
                markNotificationAsReadByOutboxId("outbox-123"),
            ).rejects.toThrow(
                "Unable to update this notification. Please try again.",
            );
        });
    });

    describe("markAllNotificationsAsRead", () => {
        it("marks all unread notifications as read for the user", async () => {
            const query = mockBulkUpdateQuery({ error: null });

            await expect(markAllNotificationsAsRead()).resolves.toBeUndefined();

            expect(mockedFrom).toHaveBeenCalledWith("notifications");
            expect(query.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    is_read: true,
                    read_at: expect.any(String),
                }),
            );
            expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", "user-123");
            expect(query.eq).toHaveBeenNthCalledWith(2, "is_read", false);
        });

        it("throws when the bulk update fails", async () => {
            mockBulkUpdateQuery({
                error: { message: "Update failed" },
            });

            await expect(markAllNotificationsAsRead()).rejects.toThrow(
                "Unable to update your notifications. Please try again.",
            );
        });
    });

    describe("authentication", () => {
        it("rejects requests when no user is authenticated", async () => {
            mockedGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            } as never);

            await expect(getNotifications()).rejects.toThrow(
                "Please sign in to view your notifications.",
            );

            expect(mockedFrom).not.toHaveBeenCalled();
        });

        it("throws when authentication verification fails", async () => {
            mockedGetUser.mockResolvedValue({
                data: { user: null },
                error: { message: "Auth unavailable" },
            } as never);

            await expect(getNotifications()).rejects.toThrow(
                "Unable to verify your account. Please try again.",
            );

            expect(mockedFrom).not.toHaveBeenCalled();
        });
    });
});
