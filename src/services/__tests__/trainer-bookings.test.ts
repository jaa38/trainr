import { supabase } from "@/lib/supabase";

import { updateTrainerBookingStatus } from "../trainer-bookings";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockedFrom = jest.mocked(supabase.from);

const bookingId = "booking-123";
const trainerId = "trainer-123";

function mockUpdateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe("Trainer booking service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("confirms a pending booking", async () => {
    const query = mockUpdateQuery({
      data: [{ id: bookingId }],
      error: null,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "pending",
        "confirmed",
      ),
    ).resolves.toBe(bookingId);

    expect(mockedFrom).toHaveBeenCalledWith("trainer_bookings");
    expect(query.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", bookingId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "trainer_id", trainerId);
    expect(query.eq).toHaveBeenNthCalledWith(3, "status", "pending");
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("declines a pending booking", async () => {
    mockUpdateQuery({
      data: [{ id: bookingId }],
      error: null,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "pending",
        "declined",
      ),
    ).resolves.toBe(bookingId);
  });

  it("returns null when no booking matches the update conditions", async () => {
    mockUpdateQuery({
      data: [],
      error: null,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "pending",
        "confirmed",
      ),
    ).resolves.toBeNull();
  });

  it("throws when the database update fails", async () => {
    const databaseError = new Error("Permission denied");

    mockUpdateQuery({
      data: null,
      error: databaseError,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "pending",
        "confirmed",
      ),
    ).rejects.toThrow("Permission denied");
  });

  it("supports completing a confirmed booking", async () => {
    mockUpdateQuery({
      data: [{ id: bookingId }],
      error: null,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "confirmed",
        "completed",
      ),
    ).resolves.toBe(bookingId);
  });

  it("cancels a confirmed booking", async () => {
    const query = mockUpdateQuery({
      data: [{ id: bookingId }],
      error: null,
    });

    await expect(
      updateTrainerBookingStatus(
        bookingId,
        trainerId,
        "confirmed",
        "cancelled",
      ),
    ).resolves.toBe(bookingId);

    expect(query.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", bookingId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "trainer_id", trainerId);
    expect(query.eq).toHaveBeenNthCalledWith(3, "status", "confirmed");
  });
});
