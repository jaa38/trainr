import { supabase } from '@/lib/supabase';

const DEFAULT_TIMEZONE = 'Africa/Lagos';

const UPCOMING_SESSION_LIMIT = 3;
const RECENT_ACTIVITY_LIMIT = 5;

export type TrainerDashboardSession = {
  id: string;
  gym_goer_id: string;
  client_name: string;
  scheduled_start: string;
  scheduled_end: string;
  status: 'confirmed';
};

export type TrainerDashboardWorkout = {
  id: string;
  gym_goer_id: string;
  client_name: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  day_name: string | null;
  day_number: number | null;
};

export type TrainerDashboardProgress = {
  id: string;
  user_id: string;
  client_name: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
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
  recentWorkouts: TrainerDashboardWorkout[];
  recentProgress: TrainerDashboardProgress[];
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

type WorkoutAssignmentRow = {
  id: string;
  gym_goer_id: string;
};

type WorkoutLogRow = {
  id: string;
  assigned_workout_plan_id: string;
  gym_goer_id: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  exercise_logs: {
    day_name?: string;
    day_number?: number;
  }[] | null;
};

type FitnessProgressRow = {
  id: string;
  user_id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
};

function getClientName(profile?: ProfileRow): string {
  const name = [
    profile?.first_name?.trim(),
    profile?.last_name?.trim(),
  ]
    .filter(Boolean)
    .join(' ');

  return name || 'TRAINR client';
}

async function getAuthenticatedTrainer() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Trainer Dashboard] Unable to verify trainer:', error);
    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
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
        .from('trainer_bookings')
        .select('id, gym_goer_id, scheduled_start, scheduled_end, status')
        .eq('trainer_id', trainer.id)
        .order('scheduled_start', { ascending: true }),

      supabase
        .from('trainer_profiles')
        .select('timezone')
        .eq('user_id', trainer.id)
        .maybeSingle(),
    ]);

    if (bookingsError) throw bookingsError;
    if (trainerProfileError) throw trainerProfileError;

    const bookings = (bookingRows ?? []) as BookingRow[];
    const confirmedBookings = bookings.filter(
      (booking) => booking.status === 'confirmed',
    );
    const pendingBookings = bookings.filter(
      (booking) => booking.status === 'pending',
    );
    const completedBookings = bookings.filter(
      (booking) => booking.status === 'completed',
    );

    const activeClientIds = [
      ...new Set(confirmedBookings.map((booking) => booking.gym_goer_id)),
    ];

    const clientIds = [
      ...new Set(bookings.map((booking) => booking.gym_goer_id)),
    ];

    const upcomingBookings = confirmedBookings
      .filter((booking) => booking.scheduled_start > now)
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime(),
      );

    if (clientIds.length === 0) {
      return {
        metrics: {
          activeClients: 0,
          pendingRequests: 0,
          upcomingSessions: 0,
          completedSessions: completedBookings.length,
        },
        timezone: trainerProfile?.timezone || DEFAULT_TIMEZONE,
        upcomingSessions: [],
        recentWorkouts: [],
        recentProgress: [],
      };
    }

    const [
      { data: profileRows, error: profilesError },
      { data: assignmentRows, error: assignmentsError },
      { data: progressRows, error: progressError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', clientIds),

      supabase
        .from('assigned_workout_plans')
        .select('id, gym_goer_id')
        .eq('trainer_id', trainer.id),

      activeClientIds.length > 0
        ? supabase
            .from('fitness_progress')
            .select('id, user_id, metric_type, value, unit, recorded_at')
            .in('user_id', activeClientIds)
            .order('recorded_at', { ascending: false })
            .limit(RECENT_ACTIVITY_LIMIT)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesError) throw profilesError;
    if (assignmentsError) throw assignmentsError;
    if (progressError) throw progressError;

    const profiles = (profileRows ?? []) as ProfileRow[];
    const assignments = (assignmentRows ?? []) as WorkoutAssignmentRow[];
    const progress = (progressRows ?? []) as FitnessProgressRow[];

    const profilesById = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    const assignmentIds = assignments.map((assignment) => assignment.id);

    let workoutLogs: WorkoutLogRow[] = [];

    if (assignmentIds.length > 0) {
      const { data: workoutRows, error: workoutsError } = await supabase
        .from('workout_logs')
        .select(
          'id, assigned_workout_plan_id, gym_goer_id, started_at, completed_at, duration_minutes, exercise_logs',
        )
        .in('assigned_workout_plan_id', assignmentIds)
        .order('started_at', { ascending: false })
        .limit(RECENT_ACTIVITY_LIMIT);

      if (workoutsError) throw workoutsError;

      workoutLogs = (workoutRows ?? []) as WorkoutLogRow[];
    }

    const recentWorkouts = workoutLogs.map((workout) => {
      const firstExercise = workout.exercise_logs?.[0];

      return {
        id: workout.id,
        gym_goer_id: workout.gym_goer_id,
        client_name: getClientName(profilesById.get(workout.gym_goer_id)),
        started_at: workout.started_at,
        completed_at: workout.completed_at,
        duration_minutes: workout.duration_minutes,
        day_name: firstExercise?.day_name ?? null,
        day_number: firstExercise?.day_number ?? null,
      };
    });

    const recentProgress = progress.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      client_name: getClientName(profilesById.get(item.user_id)),
      metric_type: item.metric_type,
      value: item.value,
      unit: item.unit,
      recorded_at: item.recorded_at,
    }));

    const upcomingSessions = upcomingBookings
      .slice(0, UPCOMING_SESSION_LIMIT)
      .map((booking) => ({
        id: booking.id,
        gym_goer_id: booking.gym_goer_id,
        client_name: getClientName(profilesById.get(booking.gym_goer_id)),
        scheduled_start: booking.scheduled_start,
        scheduled_end: booking.scheduled_end,
        status: 'confirmed' as const,
      }));

    return {
      metrics: {
        activeClients: activeClientIds.length,
        pendingRequests: pendingBookings.length,
        upcomingSessions: upcomingBookings.length,
        completedSessions: completedBookings.length,
      },
      timezone: trainerProfile?.timezone || DEFAULT_TIMEZONE,
      upcomingSessions,
      recentWorkouts,
      recentProgress,
    };
  } catch (error) {
    console.error('[Trainer Dashboard] Failed to load dashboard:', error);
    throw new Error('Unable to load your trainer dashboard. Please try again.');
  }
}
