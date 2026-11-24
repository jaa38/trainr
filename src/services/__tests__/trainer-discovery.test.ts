
import { supabase } from "@/lib/supabase";
import { getProfileImageUrl } from "@/services/profile-images";
import { discoverPublishedTrainers } from "../trainer-discovery";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock("@/services/profile-images", () => ({
  getProfileImageUrl: jest.fn(),
}));

const mockedRpc = jest.mocked(supabase.rpc);
const mockedGetProfileImageUrl = jest.mocked(getProfileImageUrl);

describe("discoverPublishedTrainers", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetProfileImageUrl.mockImplementation(async (url) => url);
  });

  it("returns published trainers with all session rates and default-rate compatibility fields", async () => {
    const trainers = [
      {
        trainer_id: "trainer-123",
        first_name: "Alex",
        last_name: "Morgan",
        avatar_url: "avatar-path",
        professional_bio: "Certified personal trainer",
        qualifications: ["Personal Training"],
        specialities: ["Strength training"],
        years_experience: 5,
        location: "Lagos",
        coaching_approach: "Personalised coaching",
        certifications: ["Fitness Certification"],
        availability: {
          days: ["Monday", "Wednesday"],
          schedule: {
            Monday: { start: "09:00", end: "17:00" },
          },
        },
        timezone: "Africa/Lagos",
        session_rates: [
          {
            id: "rate-1",
            session_type: "one_to_one",
            session_duration_minutes: 60,
            session_rate: 50000,
            currency: "NGN",
            training_format: "in_person",
            is_default: true,
            sort_order: 0,
          },
          {
            id: "rate-2",
            session_type: "online_training",
            session_duration_minutes: 45,
            session_rate: 30000,
            currency: "NGN",
            training_format: "online",
            is_default: false,
            sort_order: 1,
          },
        ],
      },
    ];

    mockedRpc.mockResolvedValueOnce({
      data: trainers,
      error: null,
    } as never);

    mockedGetProfileImageUrl.mockResolvedValueOnce(
      "https://example.com/avatar.jpg",
    );

    await expect(discoverPublishedTrainers()).resolves.toEqual([
      {
        ...trainers[0],
        avatar_url: "https://example.com/avatar.jpg",
        session_rate: 50000,
        currency: "NGN",
        session_duration_minutes: 60,
      },
    ]);

    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc).toHaveBeenCalledWith(
      "discover_published_trainers_v3",
    );
    expect(mockedGetProfileImageUrl).toHaveBeenCalledWith("avatar-path");
  });

  it("keeps legacy pricing fields null when no rate is marked as default", async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [
        {
          trainer_id: "trainer-123",
          avatar_url: null,
          session_rates: [
            {
              id: "rate-1",
              session_type: "one_to_one",
              session_duration_minutes: 30,
              session_rate: 20000,
              currency: "NGN",
              training_format: "in_person",
              is_default: false,
              sort_order: 1,
            },
          ],
        },
      ],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([
      expect.objectContaining({
        trainer_id: "trainer-123",
        session_rate: null,
        currency: null,
        session_duration_minutes: null,
        session_rates: [
          expect.objectContaining({
            id: "rate-1",
            session_rate: 20000,
            currency: "NGN",
            session_duration_minutes: 30,
            is_default: false,
          }),
        ],
      }),
    ]);
  });

  it("returns an empty array when no trainers are published", async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([]);

    expect(mockedRpc).toHaveBeenCalledWith(
      "discover_published_trainers_v3",
    );
    expect(mockedGetProfileImageUrl).not.toHaveBeenCalled();
  });

  it("throws an error when the discovery RPC fails", async () => {
    mockedRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Database unavailable" },
    } as never);

    await expect(discoverPublishedTrainers()).rejects.toThrow(
      "Unable to discover trainers: Database unavailable",
    );

    expect(mockedGetProfileImageUrl).not.toHaveBeenCalled();
  });

  it("returns a trainer even when profile image loading fails", async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [
        {
          trainer_id: "trainer-123",
          avatar_url: "invalid-avatar-path",
          session_rates: [],
        },
      ],
      error: null,
    } as never);

    mockedGetProfileImageUrl.mockRejectedValueOnce(
      new Error("Image unavailable"),
    );

    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    try {
      await expect(discoverPublishedTrainers()).resolves.toEqual([
        expect.objectContaining({
          trainer_id: "trainer-123",
          avatar_url: null,
          session_rates: [],
          session_rate: null,
          currency: null,
          session_duration_minutes: null,
        }),
      ]);

      expect(consoleWarnSpy).toHaveBeenCalled();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("does not treat a non-default rate as the default rate", async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [
        {
          trainer_id: "trainer-123",
          avatar_url: null,
          session_rates: [
            {
              id: "rate-1",
              session_type: "one_to_one",
              session_duration_minutes: 60,
              session_rate: 50000,
              currency: "NGN",
              training_format: "in_person",
              is_default: false,
              sort_order: 0,
            },
            {
              id: "rate-2",
              session_type: "online_training",
              session_duration_minutes: 45,
              session_rate: 30000,
              currency: "NGN",
              training_format: "online",
              is_default: false,
              sort_order: 1,
            },
          ],
        },
      ],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([
      expect.objectContaining({
        trainer_id: "trainer-123",
        session_rate: null,
        currency: null,
        session_duration_minutes: null,
        session_rates: expect.arrayContaining([
          expect.objectContaining({ id: "rate-1" }),
          expect.objectContaining({ id: "rate-2" }),
        ]),
      }),
    ]);
  });
});
