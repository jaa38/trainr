import { supabase } from '@/lib/supabase';
import {
  deleteFitnessProgress,
  getFitnessProgress,
  updateBodyWeight,
  updateFitnessProgress,
  type CreateFitnessProgressInput,
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
    user_id: 'trainer-123',
    metric_type: 'body_weight',
    value: 80,
    unit: 'kg',
    recorded_at: '2026-11-10T08:00:00.000Z',
    notes: null,
    created_at: '2026-11-10T08:00:00.000Z',
  },
];

const validUpdateInput: CreateFitnessProgressInput = {
  metricType: 'body_weight',
  value: 78,
  unit: 'kg',
  recordedAt: '2026-11-15T08:00:00.000Z',
  notes: 'Updated measurement',
};

function mockFitnessProgressQuery(response: { data: unknown; error: unknown }) {
  const query: Record<string, any> = {};
  const chain = jest.fn(() => query);

  query.select = chain;
  query.eq = chain;
  query.order = chain;
  query.limit = chain;
  query.update = chain;
  query.delete = chain;
  query.insert = chain;

  query.single = jest.fn(() => Promise.resolve(response));
  query.maybeSingle = jest.fn(() => Promise.resolve(response));

  query.then = (
    resolve: (value: typeof response) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe('getFitnessProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('retrieves the authenticated user’s own fitness measurements', async () => {
    const query = mockFitnessProgressQuery({
      data: mockMeasurements,
      error: null,
    });

    await expect(getFitnessProgress()).resolves.toEqual(mockMeasurements);

    expect(mockedFrom).toHaveBeenCalledWith('fitness_progress');
    expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    expect(query.order).toHaveBeenCalledWith('recorded_at', {
      ascending: false,
    });
  });

  it('returns an empty array when no personal measurements exist', async () => {
    mockFitnessProgressQuery({
      data: [],
      error: null,
    });

    await expect(getFitnessProgress()).resolves.toEqual([]);
  });

  it('rejects unauthenticated users', async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    await expect(getFitnessProgress()).rejects.toThrow('Please sign in to continue.');

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws a useful error when the database query fails', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: { message: 'Permission denied' },
    });

    await expect(getFitnessProgress()).rejects.toThrow(
      'Unable to load your fitness progress. Please try again.',
    );
  });
});

describe('updateFitnessProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('updates a measurement belonging to the authenticated user', async () => {
    const updatedMeasurement: FitnessProgress = {
      ...mockMeasurements[0],
      value: 78,
      recorded_at: '2026-11-15T08:00:00.000Z',
      notes: 'Updated measurement',
    };

    const query = mockFitnessProgressQuery({
      data: updatedMeasurement,
      error: null,
    });

    await expect(
      updateFitnessProgress('measurement-1', validUpdateInput),
    ).resolves.toEqual(updatedMeasurement);

    expect(mockedFrom).toHaveBeenCalledWith('fitness_progress');
    expect(query.update).toHaveBeenCalledWith({
      metric_type: 'body_weight',
      value: 78,
      unit: 'kg',
      recorded_at: '2026-11-15T08:00:00.000Z',
      notes: 'Updated measurement',
    });
    expect(query.eq).toHaveBeenCalledWith('id', 'measurement-1');
    expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('supports updating a non-weight measurement', async () => {
    const input: CreateFitnessProgressInput = {
      metricType: 'body_fat',
      value: 18,
      unit: '%',
      recordedAt: '2026-11-15T08:00:00.000Z',
    };

    const updatedMeasurement = {
      ...mockMeasurements[0],
      metric_type: 'body_fat',
      value: 18,
      unit: '%',
      notes: null,
    };

    mockFitnessProgressQuery({
      data: updatedMeasurement,
      error: null,
    });

    await expect(updateFitnessProgress('measurement-1', input)).resolves.toEqual(
      updatedMeasurement,
    );
  });

  it('rejects an empty measurement ID', async () => {
    await expect(updateFitnessProgress(' ', validUpdateInput)).rejects.toThrow(
      'A valid fitness measurement is required.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('rejects incompatible measurement units', async () => {
    const invalidInput = {
      ...validUpdateInput,
      unit: 'cm',
    } as CreateFitnessProgressInput;

    await expect(updateFitnessProgress('measurement-1', invalidInput)).rejects.toThrow(
      'Body weight must use kg or lb.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('rejects a measurement date in the future', async () => {
    const invalidInput: CreateFitnessProgressInput = {
      ...validUpdateInput,
      recordedAt: '2099-01-01T00:00:00.000Z',
    };

    await expect(updateFitnessProgress('measurement-1', invalidInput)).rejects.toThrow(
      'Measurement date cannot be in the future.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated users', async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    await expect(
      updateFitnessProgress('measurement-1', validUpdateInput),
    ).rejects.toThrow('Please sign in to continue.');

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws when the measurement does not exist or belong to the user', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: null,
    });

    await expect(
      updateFitnessProgress('measurement-1', validUpdateInput),
    ).rejects.toThrow('Fitness measurement not found.');
  });

  it('throws a useful error when the database update fails', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: { message: 'Database error' },
    });

    await expect(
      updateFitnessProgress('measurement-1', validUpdateInput),
    ).rejects.toThrow('Unable to update your measurement. Please try again.');
  });
});

describe('updateBodyWeight', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('preserves the existing body-weight update interface', async () => {
    const updatedMeasurement: FitnessProgress = {
      ...mockMeasurements[0],
      value: 79,
    };

    const query = mockFitnessProgressQuery({
      data: updatedMeasurement,
      error: null,
    });

    await expect(
      updateBodyWeight('measurement-1', {
        value: 79,
        unit: 'kg',
        recordedAt: '2026-11-15T08:00:00.000Z',
      }),
    ).resolves.toEqual(updatedMeasurement);

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metric_type: 'body_weight',
        value: 79,
        unit: 'kg',
      }),
    );
  });
});

describe('deleteFitnessProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  it('deletes a measurement belonging to the authenticated user', async () => {
    const query = mockFitnessProgressQuery({
      data: { id: 'measurement-1' },
      error: null,
    });

    await expect(deleteFitnessProgress('measurement-1')).resolves.toBeUndefined();

    expect(mockedFrom).toHaveBeenCalledWith('fitness_progress');
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', 'measurement-1');
    expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    expect(query.select).toHaveBeenCalledWith('id');
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('rejects an empty measurement ID', async () => {
    await expect(deleteFitnessProgress('')).rejects.toThrow(
      'A valid fitness measurement is required.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated users', async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    await expect(deleteFitnessProgress('measurement-1')).rejects.toThrow(
      'Please sign in to continue.',
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws when the measurement does not exist or belong to the user', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: null,
    });

    await expect(deleteFitnessProgress('measurement-1')).rejects.toThrow(
      'Fitness measurement not found.',
    );
  });

  it('throws a useful error when the database delete fails', async () => {
    mockFitnessProgressQuery({
      data: null,
      error: { message: 'Database error' },
    });

    await expect(deleteFitnessProgress('measurement-1')).rejects.toThrow(
      'Unable to delete your measurement. Please try again.',
    );
  });
});
