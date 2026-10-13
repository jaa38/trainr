import { supabase } from '@/lib/supabase';
import { discoverPublishedTrainers } from '../trainer-discovery';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockedRpc = jest.mocked(supabase.rpc);

describe('discoverPublishedTrainers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    await expect(discoverPublishedTrainers()).resolves.toEqual(trainers);
    expect(mockedRpc).toHaveBeenCalledWith('discover_published_trainers');
  });

  it('returns an empty array when no trainers are published', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([]);
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
});
