import { supabase } from "@/lib/supabase";

const DEFAULT_TIMEZONE = "Africa/Lagos";
const UPCOMING_SESSION_LIMIT = 3;

export type TrainerDashboardSession = {
  id: string;
  gym_goer_id: string;
  client_name: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "confirmed";
};

export type TrainerDashboardData = {
  metrics: {
    activeClients: number;
    pendingRequests: number;
    upcomingSessions: number;
    completedSessions: number;
  };
  timezone: string;
  upcomingSessions: TrainerDashboardSession[];
};

type BookingRow = {
  id: string;
  gym_goer_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function getClientName(profile?: ProfileRow): string {
  const name = [
    profile?.first_name?.trim(),
    profile?.last_name?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return name || "TRAINR client";
}

async function getAuthenticatedTrainer() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "[Trainer Dashboard] Unable to verify trainer:",
      error,
    );

    throw new Error("Unable to verify your account. Please try again.");
  }

  if (!user) {
    throw new Error("Please sign in to continue.");
  }

  return user;
}

export async function getTrainerDashboard(): Promise<TrainerDashboardData> {
  const trainer = await getAuthenticatedTrainer();
  const now = new Date().toISOString();

  try {
    const [
      { data: bookingRows, error: bookingsError },
      { data: trainerProfile, error: trainerProfileError },
    ] = await Promise.all([
      supabase
        .from("trainer_bookings")
        .select(
          "id, gym_goer_id, scheduled_start, scheduled_end, status",
        )
        .eq("trainer_id", trainer.id)
        .order("scheduled_start", { ascending: true }),

      supabase
        .from("trainer_profiles")
        .select("timezone")
        .eq("user_id", trainer.id)
        .maybeSingle(),
    ]);

    if (bookingsError) throw bookingsError;
    if (trainerProfileError) throw trainerProfileError;

    const bookings = (bookingRows ?? []) as BookingRow[];

    const confirmedBookings = bookings.filter(
      (booking) => booking.status === "confirmed",
    );

    const pendingBookings = bookings.filter(
      (booking) => booking.status === "pending",
    );

    const completedBookings = bookings.filter(
      (booking) => booking.status === "completed",
    );

    const activeClientIds = [
      ...new Set(
        confirmedBookings.map((booking) => booking.gym_goer_id),
      ),
    ];

    const upcomingBookings = confirmedBookings
      .filter((booking) => booking.scheduled_start > now)
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime(),
      );

    const timezone = trainerProfile?.timezone || DEFAULT_TIMEZONE;

    if (bookings.length === 0) {
      return {
        metrics: {
          activeClients: 0,
          pendingRequests: 0,
          upcomingSessions: 0,
          completedSessions: 0,
        },
        timezone,
        upcomingSessions: [],
      };
    }

    const clientIds = [
      ...new Set(bookings.map((booking) => booking.gym_goer_id)),
    ];

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", clientIds);

    if (profilesError) throw profilesError;

    const profilesById = new Map(
      ((profileRows ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const upcomingSessions: TrainerDashboardSession[] = upcomingBookings
      .slice(0, UPCOMING_SESSION_LIMIT)
      .map((booking) => ({
        id: booking.id,
        gym_goer_id: booking.gym_goer_id,
        client_name: getClientName(
          profilesById.get(booking.gym_goer_id),
        ),
        scheduled_start: booking.scheduled_start,
        scheduled_end: booking.scheduled_end,
        status: "confirmed",
      }));

    return {
      metrics: {
        activeClients: activeClientIds.length,
        pendingRequests: pendingBookings.length,
        upcomingSessions: upcomingBookings.length,
        completedSessions: completedBookings.length,
      },
      timezone,
      upcomingSessions,
    };
  } catch (error) {
    console.error(
      "[Trainer Dashboard] Failed to load dashboard:",
      error,
    );

    throw new Error(
      "Unable to load your trainer dashboard. Please try again.",
    );
  }
}
