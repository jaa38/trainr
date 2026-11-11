import { supabase } from '@/lib/supabase';
import {
  getClientFitnessProgress,
  type FitnessProgress,
} from '../fitness-progress';

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

const mockMeasurements: FitnessProgress[] = [
  {
    id: 'measurement-1',
    user_id: 'client-123',
    metric_type: 'body_weight',
    value: 80,
    unit: 'kg',
    recorded_at: '2026-11-10T08:00:00.000Z',
    notes: null,
    created_at: '2026-11-10T08:00:00.000Z',
  },
];

function mockFitnessProgressQuery(
  response: { data: FitnessProgress[] | null; error: unknown },
) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  query.order
    .mockImplementationOnce(() => query)
    .mockImplementationOnce(() => Promise.resolve(response));

  mockedFrom.mockReturnValue(query as never);
}

describe('getClientFitnessProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('retrieves a client’s fitness measurements', async () => {
    mockFitnessProgressQuery({
      data: mockMeasurements,
      error: null,
    });

    await expect(
      getClientFitnessProgress('client-123'),
    ).resolves.toEqual(mockMeasurements);

    expect(mockedFrom).toHaveBeenCalledWith('fitness_progress');
  });

  it('returns an empty array when no measurements exist', async () => {
    mockFitnessProgressQuery({
      data: [],
      error: null,
    });

    await expect(
      getClientFitnessProgress('client-123'),
    ).resolves.toEqual([]);
  });

  it('rejects an empty client ID', async () => {
    await expect(getClientFitnessProgress('')).rejects.toThrow(
      'A valid client is required.',
    );

    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws an error when the database query fails', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: { message: 'Permission denied' },
    });

    await expect(
      getClientFitnessProgress('client-123'),
    ).rejects.toThrow(
      'Unable to load this client’s fitness progress. Please try again.',
    );
  });
});
