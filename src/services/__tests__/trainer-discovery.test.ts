import { supabase } from '@/lib/supabase';
import { getProfileImageUrl } from '@/services/profile-images';
import { discoverPublishedTrainers } from '../trainer-discovery';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@/services/profile-images', () => ({
  getProfileImageUrl: jest.fn(),
}));

const mockedRpc = jest.mocked(supabase.rpc);
const mockedGetProfileImageUrl = jest.mocked(getProfileImageUrl);

describe('discoverPublishedTrainers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetProfileImageUrl.mockImplementation(async (url) => url);
  });

  it('returns published trainers including availability and timezone', async () => {
    const trainers = [
      {
        trainer_id: 'trainer-123',
        first_name: 'Alex',
        last_name: 'Morgan',
        avatar_url: 'avatar-path',
        professional_bio: 'Certified personal trainer',
        qualifications: ['Personal Training'],
        specialities: ['Strength training'],
        years_experience: 5,
        location: 'Lagos',
        coaching_approach: 'Personalised coaching',
        certifications: ['Fitness Certification'],
        session_rate: 100,
        currency: 'NGN',
        session_duration_minutes: 60,
        availability: {
          days: ['Monday', 'Wednesday'],
          schedule: {
            Monday: {
              start: '09:00',
              end: '17:00',
            },
          },
        },
        timezone: 'Africa/Lagos',
      },
    ];

    mockedRpc.mockResolvedValueOnce({
      data: trainers,
      error: null,
    } as never);

    mockedGetProfileImageUrl.mockResolvedValueOnce('https://example.com/avatar.jpg');

    await expect(discoverPublishedTrainers()).resolves.toEqual([
      {
        ...trainers[0],
        avatar_url: 'https://example.com/avatar.jpg',
      },
    ]);

    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc).toHaveBeenCalledWith('discover_published_trainers_v2');

    expect(mockedGetProfileImageUrl).toHaveBeenCalledWith('avatar-path');
  });

  it('returns an empty array when no trainers are published', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    } as never);

    await expect(discoverPublishedTrainers()).resolves.toEqual([]);

    expect(mockedRpc).toHaveBeenCalledWith('discover_published_trainers_v2');

    expect(mockedGetProfileImageUrl).not.toHaveBeenCalled();
  });

  it('throws an error when the discovery RPC fails', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Database unavailable',
      },
    } as never);

    await expect(discoverPublishedTrainers()).rejects.toThrow(
      'Unable to discover trainers: Database unavailable',
    );

    expect(mockedGetProfileImageUrl).not.toHaveBeenCalled();
  });

  it('returns a trainer even when profile image loading fails', async () => {
    const trainers = [
      {
        trainer_id: 'trainer-123',
        first_name: 'Alex',
        last_name: 'Morgan',
        avatar_url: 'invalid-avatar-path',
        availability: {
          days: ['Tuesday'],
        },
        timezone: 'Africa/Lagos',
      },
    ];

    mockedRpc.mockResolvedValueOnce({
      data: trainers,
      error: null,
    } as never);

    mockedGetProfileImageUrl.mockRejectedValueOnce(new Error('Image unavailable'));

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await expect(discoverPublishedTrainers()).resolves.toEqual([
        {
          ...trainers[0],
          avatar_url: null,
        },
      ]);

      expect(consoleWarnSpy).toHaveBeenCalled();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
