import { supabase } from "@/lib/supabase";
import { removeCurrentDevicePushToken } from "../notifications/notification-cleanup";
import { getNotificationDeviceId } from "../notifications/notification-permissions";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock("../notifications/notification-permissions", () => ({
  getNotificationDeviceId: jest.fn(),
}));

const mockedGetUser = jest.mocked(supabase.auth.getUser);
const mockedFrom = jest.mocked(supabase.from);
const mockedGetNotificationDeviceId = jest.mocked(
  getNotificationDeviceId,
);

const expectedUserId = "user-123";
const deviceId = "device-456";

function mockAuthenticatedUser(userId: string) {
  mockedGetUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
    error: null,
  } as never);
}

function mockDeleteQuery(response: { error: unknown }) {
  const query = {
    delete: jest.fn(),
    eq: jest.fn(),
  };

  query.delete.mockReturnValue(query);

  query.eq
    .mockImplementationOnce(() => query)
    .mockImplementationOnce(() => Promise.resolve(response));

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe("removeCurrentDevicePushToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetNotificationDeviceId.mockResolvedValue(deviceId);
    mockAuthenticatedUser(expectedUserId);
  });

  it("deletes only the authenticated user’s current device registration", async () => {
    const query = mockDeleteQuery({ error: null });

    await expect(
      removeCurrentDevicePushToken(expectedUserId),
    ).resolves.toBeUndefined();

    expect(mockedFrom).toHaveBeenCalledWith("device_push_tokens");
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenNthCalledWith(
      1,
      "user_id",
      expectedUserId,
    );
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      "device_id",
      deviceId,
    );
  });

  it("skips deletion when the device identifier is unavailable", async () => {
    mockedGetNotificationDeviceId.mockResolvedValue(null);

    await expect(
      removeCurrentDevicePushToken(expectedUserId),
    ).resolves.toBeUndefined();

    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it("aborts cleanup when the authenticated user does not match", async () => {
    mockAuthenticatedUser("different-user");

    await expect(
      removeCurrentDevicePushToken(expectedUserId),
    ).rejects.toThrow(
      "Authenticated user does not match the expected user. Token cleanup aborted.",
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it("propagates Supabase deletion errors", async () => {
    const deletionError = new Error("Permission denied");

    mockDeleteQuery({ error: deletionError });

    await expect(
      removeCurrentDevicePushToken(expectedUserId),
    ).rejects.toThrow("Permission denied");
  });

  it("propagates authentication errors and skips deletion", async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Authentication unavailable"),
    } as never);

    await expect(
      removeCurrentDevicePushToken(expectedUserId),
    ).rejects.toThrow("Authentication unavailable");

    expect(mockedFrom).not.toHaveBeenCalled();
  });
});
