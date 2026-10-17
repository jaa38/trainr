import { supabase } from '@/lib/supabase';
import { discoverPublishedTrainers } from '../trainer-discovery';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

jest.mock('@/services/profile-images', () => ({
  getProfileImageUrl: jest.fn(async (url: string | null) => url),
}));

const mockedRpc = jest.mocked(supabase.rpc);
const mockedFrom = jest.mocked(supabase.from);

describe('discoverPublishedTrainers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    } as never);
  });

  it('returns published trainers from the discovery RPC', async () => {
    const trainers = [
      {
        trainer_id: 'trainer-123',
        first_name: 'Alex',
        last_name: 'Morgan',
        location: 'Lagos',
        session_rate: 100,
        currency: 'EUR',
      },
    ];

    mockedRpc.mockResolvedValueOnce({
      data: trainers,
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([
      {
        ...trainers[0],
        availability: null,
        timezone: null,
      },
    ]);

    expect(mockedRpc).toHaveBeenCalledWith('discover_published_trainers');
    expect(mockedFrom).toHaveBeenCalledWith('trainer_profiles');
  });

  it('returns an empty array when no trainers are published', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([]);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('throws an error when the discovery RPC fails', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database unavailable' },
    } as never);

    await expect(discoverPublishedTrainers()).rejects.toThrow(
      'Unable to discover trainers: Database unavailable',
    );
  });

  it('throws an error when trainer availability cannot be loaded', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [{ trainer_id: 'trainer-123' }],
      error: null,
    } as never);

    mockedFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Permission denied' },
        }),
      }),
    } as never);

    await expect(discoverPublishedTrainers()).rejects.toThrow(
      'Unable to load trainer availability: Permission denied',
    );
  });
});
