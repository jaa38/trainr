import { supabase } from '@/lib/supabase';
import { getTrainerDashboard } from '../trainer-dashboard';

jest.mock('@/lib/supabase', () => ({
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
  id: 'trainer-123',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, unknown> = {};

  const chain = jest.fn(() => query);

  query.select = chain;
  query.eq = chain;
  query.in = chain;
  query.order = chain;
  query.limit = chain;

  query.maybeSingle = jest.fn(() => Promise.resolve(response));

  query.then = (
    resolve: (value: QueryResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);

  return query;
}

function mockTables(responses: Record<string, QueryResponse>) {
  mockedFrom.mockImplementation(((table: string) => {
    const response = responses[table];

    if (!response) {
      throw new Error(`Unexpected table query: ${table}`);
    }

    return createQuery(response) as never;
  }) as never);
}

const futureDate = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('getTrainerDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('returns dashboard metrics and upcoming sessions', async () => {
    mockTables({
      trainer_bookings: {
        data: [
          {
            id: 'booking-1',
            gym_goer_id: 'client-1',
            scheduled_start: futureDate(1),
            scheduled_end: futureDate(1),
            status: 'confirmed',
          },
          {
            id: 'booking-2',
            gym_goer_id: 'client-1',
            scheduled_start: futureDate(2),
            scheduled_end: futureDate(2),
            status: 'confirmed',
          },
          {
            id: 'booking-3',
            gym_goer_id: 'client-2',
            scheduled_start: futureDate(3),
            scheduled_end: futureDate(3),
            status: 'confirmed',
          },
          {
            id: 'booking-4',
            gym_goer_id: 'client-3',
            scheduled_start: futureDate(4),
            scheduled_end: futureDate(4),
            status: 'pending',
          },
          {
            id: 'booking-5',
            gym_goer_id: 'client-4',
            scheduled_start: futureDate(-2),
            scheduled_end: futureDate(-2),
            status: 'completed',
          },
        ],
        error: null,
      },
      trainer_profiles: {
        data: { timezone: 'Europe/London' },
        error: null,
      },
      profiles: {
        data: [
          {
            id: 'client-1',
            first_name: 'Alex',
            last_name: 'Smith',
          },
          {
            id: 'client-2',
            first_name: 'Jordan',
            last_name: 'Lee',
          },
          {
            id: 'client-3',
            first_name: 'Taylor',
            last_name: 'Brown',
          },
          {
            id: 'client-4',
            first_name: 'Morgan',
            last_name: 'Jones',
          },
        ],
        error: null,
      },
      assigned_workout_plans: {
        data: [
          {
            id: 'assignment-1',
            gym_goer_id: 'client-1',
          },
        ],
        error: null,
      },
      fitness_progress: {
        data: [],
        error: null,
      },
      workout_logs: {
        data: [
          {
            id: 'workout-day-2',
            assigned_workout_plan_id: 'assignment-1',
            gym_goer_id: 'client-1',
            started_at: '2026-11-10T18:04:22.000Z',
            completed_at: null,
            duration_minutes: null,
            exercise_logs: [
              { day_name: 'Day 2', day_number: 2 },
            ],
          },
          {
            id: 'workout-day-1',
            assigned_workout_plan_id: 'assignment-1',
            gym_goer_id: 'client-1',
            started_at: '2026-11-10T18:03:20.000Z',
            completed_at: null,
            duration_minutes: null,
            exercise_logs: [
              { day_name: 'Day 1', day_number: 1 },
            ],
          },
        ],
        error: null,
      },
    });

    const dashboard = await getTrainerDashboard();

    expect(dashboard.metrics).toEqual({
      activeClients: 2,
      pendingRequests: 1,
      upcomingSessions: 3,
      completedSessions: 1,
    });

    expect(dashboard.timezone).toBe('Europe/London');
    expect(dashboard.upcomingSessions).toHaveLength(3);
    expect(dashboard.upcomingSessions[0].client_name).toBe('Alex Smith');
    expect(dashboard.recentWorkouts).toHaveLength(2);
    expect(dashboard.recentWorkouts[0]).toEqual(
      expect.objectContaining({
        client_name: 'Alex Smith',
        day_name: 'Day 2',
        day_number: 2,
        completed_at: null,
      }),
    );
    expect(dashboard.recentWorkouts[1]).toEqual(
      expect.objectContaining({
        client_name: 'Alex Smith',
        day_name: 'Day 1',
        day_number: 1,
        completed_at: null,
      }),
    );
    expect(dashboard.recentProgress).toEqual([]);
  });

  it('returns empty dashboard data when the trainer has no bookings', async () => {
    mockTables({
      trainer_bookings: {
        data: [],
        error: null,
      },
      trainer_profiles: {
        data: null,
        error: null,
      },
    });

    const dashboard = await getTrainerDashboard();

    expect(dashboard.metrics).toEqual({
      activeClients: 0,
      pendingRequests: 0,
      upcomingSessions: 0,
      completedSessions: 0,
    });

    expect(dashboard.timezone).toBe('Africa/Lagos');
    expect(dashboard.upcomingSessions).toEqual([]);
    expect(dashboard.recentWorkouts).toEqual([]);
    expect(dashboard.recentProgress).toEqual([]);
  });

  it('rejects unauthenticated users', async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    await expect(getTrainerDashboard()).rejects.toThrow(
      'Please sign in to continue.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws a useful error when the bookings query fails', async () => {
    mockTables({
      trainer_bookings: {
        data: null,
        error: { message: 'Permission denied' },
      },
      trainer_profiles: {
        data: null,
        error: null,
      },
    });

    await expect(getTrainerDashboard()).rejects.toThrow(
      'Unable to load your trainer dashboard. Please try again.',
    );
  });
});
