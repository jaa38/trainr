import { supabase } from "@/lib/supabase";

import { ensureNotificationPreferences } from "../notifications/notification-preferences";
import {
    registerDevicePushToken,
    type RegisterDevicePushTokenInput,
} from "../notifications/notification-registration";

jest.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    },
}));

jest.mock("../notifications/notification-preferences", () => ({
    ensureNotificationPreferences: jest.fn(),
}));

const mockedFrom = jest.mocked(supabase.from);
const mockedGetUser = jest.mocked(supabase.auth.getUser);
const mockedEnsurePreferences = jest.mocked(ensureNotificationPreferences);

const userId = "user-123";
const otherUserId = "user-456";
const expoPushToken = "ExponentPushToken[test-token]";

const input: RegisterDevicePushTokenInput = {
    expectedUserId: userId,
    expoPushToken,
    platform: "ios",
    deviceId: "device-123",
    deviceName: "Test iPhone",
    timezone: "Africa/Lagos",
};

const existingToken = {
    id: "token-123",
    user_id: userId,
    expo_push_token: expoPushToken,
    platform: "ios",
    device_id: "old-device-id",
    device_name: "Old iPhone",
    timezone: "UTC",
    is_active: true,
    last_seen_at: "2026-11-15T09:00:00.000Z",
    created_at: "2026-11-10T09:00:00.000Z",
    updated_at: "2026-11-15T09:00:00.000Z",
};

const registeredToken = {
    ...existingToken,
    device_id: input.deviceId,
    device_name: input.deviceName,
    timezone: input.timezone,
};

function mockAuthenticatedUser(authenticatedUserId = userId) {
    mockedGetUser.mockResolvedValue({
        data: {
            user: { id: authenticatedUserId },
        },
        error: null,
    } as never);
}

function createLookupQuery(data: unknown = null, error: unknown = null) {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        maybeSingle: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data, error });

    return query;
}

function createUpdateQuery(data: unknown, error: unknown = null) {
    const query = {
        update: jest.fn(),
        eq: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
    };

    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({ data, error });

    return query;
}

function createInsertQuery(data: unknown, error: unknown = null) {
    const query = {
        insert: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
    };

    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({ data, error });

    return query;
}

describe("notification-registration service", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockAuthenticatedUser();

        mockedEnsurePreferences.mockResolvedValue(undefined);
    });

    it("rejects an empty Expo push token", async () => {
        await expect(
            registerDevicePushToken({
                ...input,
                expoPushToken: " ",
            }),
        ).rejects.toThrow("A valid Expo push token is required.");

        expect(mockedGetUser).not.toHaveBeenCalled();
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it("rejects an unsupported platform", async () => {
        await expect(
            registerDevicePushToken({
                ...input,
                platform: "web" as never,
            }),
        ).rejects.toThrow(
            "Push notifications are only supported on iOS and Android.",
        );

        expect(mockedGetUser).not.toHaveBeenCalled();
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it("rejects an empty expected user ID", async () => {
        await expect(
            registerDevicePushToken({
                ...input,
                expectedUserId: " ",
            }),
        ).rejects.toThrow("A valid user ID is required.");

        expect(mockedGetUser).not.toHaveBeenCalled();
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it("rejects registration when no authenticated user is available", async () => {
        mockedGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        } as never);

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow("Please sign in to register this device.");

        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it("rejects registration when the authenticated user does not match", async () => {
        mockAuthenticatedUser(otherUserId);

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow(
            "Your account changed during device registration. Please try again.",
        );

        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it("refreshes an existing token belonging to the same user", async () => {
        const lookupQuery = createLookupQuery(existingToken);
        const updateQuery = createUpdateQuery(registeredToken);

        mockedFrom
            .mockReturnValueOnce(lookupQuery as never)
            .mockReturnValueOnce(updateQuery as never);

        await expect(
            registerDevicePushToken(input),
        ).resolves.toEqual(registeredToken);

        expect(mockedFrom).toHaveBeenNthCalledWith(
            1,
            "device_push_tokens",
        );

        expect(lookupQuery.select).toHaveBeenCalledWith(
            "id,user_id,expo_push_token,platform,device_id,device_name,timezone,is_active,last_seen_at,created_at,updated_at",
        );

        expect(lookupQuery.eq).toHaveBeenNthCalledWith(
            1,
            "expo_push_token",
            expoPushToken,
        );

        expect(lookupQuery.eq).toHaveBeenNthCalledWith(
            2,
            "user_id",
            userId,
        );

        expect(updateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                platform: input.platform,
                device_id: input.deviceId,
                device_name: input.deviceName,
                timezone: input.timezone,
                is_active: true,
            }),
        );

        expect(updateQuery.eq).toHaveBeenNthCalledWith(
            1,
            "id",
            existingToken.id,
        );

        expect(updateQuery.eq).toHaveBeenNthCalledWith(
            2,
            "user_id",
            userId,
        );

        expect(mockedEnsurePreferences).toHaveBeenCalledWith(userId);
    });

    it("inserts a new token when no existing token belongs to the user", async () => {
        const lookupQuery = createLookupQuery(null);
        const insertQuery = createInsertQuery(registeredToken);

        mockedFrom
            .mockReturnValueOnce(lookupQuery as never)
            .mockReturnValueOnce(insertQuery as never);

        await expect(
            registerDevicePushToken(input),
        ).resolves.toEqual(registeredToken);

        expect(insertQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: userId,
                expo_push_token: expoPushToken,
                platform: input.platform,
                device_id: input.deviceId,
                device_name: input.deviceName,
                timezone: input.timezone,
                is_active: true,
            }),
        );

        expect(mockedEnsurePreferences).toHaveBeenCalledWith(userId);
    });

    it("does not reassign a token already owned by another account", async () => {
        const lookupQuery = createLookupQuery(null);
        const insertQuery = createInsertQuery(null, {
            code: "23505",
        });

        mockedFrom
            .mockReturnValueOnce(lookupQuery as never)
            .mockReturnValueOnce(insertQuery as never);

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow(
            "This device is already registered to another account. Please contact support if you need help.",
        );

        expect(insertQuery.insert).toHaveBeenCalled();
        expect(mockedEnsurePreferences).not.toHaveBeenCalled();
    });

    it("returns a user-friendly error when the existing-token lookup fails", async () => {
        const lookupQuery = createLookupQuery(
            null,
            new Error("Database unavailable"),
        );

        mockedFrom.mockReturnValueOnce(lookupQuery as never);

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow(
            "Unable to check device registration. Please try again.",
        );

        expect(mockedEnsurePreferences).not.toHaveBeenCalled();
    });

    it("returns a user-friendly error when inserting a token fails", async () => {
        const lookupQuery = createLookupQuery(null);
        const insertQuery = createInsertQuery(null, {
            message: "Database unavailable",
            code: "500",
        });

        mockedFrom
            .mockReturnValueOnce(lookupQuery as never)
            .mockReturnValueOnce(insertQuery as never);

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow(
            "Unable to register this device. Please try again.",
        );

        expect(mockedEnsurePreferences).not.toHaveBeenCalled();
    });

    it("does not report successful registration when preference initialisation fails", async () => {
        const lookupQuery = createLookupQuery(null);
        const insertQuery = createInsertQuery(registeredToken);

        mockedFrom
            .mockReturnValueOnce(lookupQuery as never)
            .mockReturnValueOnce(insertQuery as never);

        mockedEnsurePreferences.mockRejectedValue(
            new Error("Unable to initialise notification preferences."),
        );

        await expect(
            registerDevicePushToken(input),
        ).rejects.toThrow(
            "Unable to initialise notification preferences.",
        );
    });
});
