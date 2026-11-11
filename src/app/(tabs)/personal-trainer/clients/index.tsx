
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

type ClientStatus = 'Active' | 'Pending';

type Client = {
  id: string;
  name: string;
  goal: string;
  status: ClientStatus;
  sessions: number;
  initials: string;
};

type Filter = 'All' | 'Active' | 'Pending';

type BookingRow = {
  id: string;
  gym_goer_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type FitnessGoalRow = {
  user_id: string;
  goal: string;
};

const filters: Filter[] = ['All', 'Active', 'Pending'];

const fitnessGoalLabels: Record<string, string> = {
  build_muscle: 'Build muscle',
  lose_weight: 'Lose weight',
  improve_fitness: 'Improve fitness',
  increase_strength: 'Increase strength',
  improve_endurance: 'Improve endurance',
  improve_health: 'Improve general health',
  sports_performance: 'Sports performance',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getGoalLabel(goals: string[]) {
  if (goals.length === 0) {
    return 'No fitness goals added';
  }

  return goals
    .map((goal) => fitnessGoalLabels[goal] ?? goal)
    .join(' · ');
}

export default function ClientsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadClients() {
      if (!user) {
        setClients([]);
        setIsLoading(false);
        setErrorMessage('Your session could not be found. Please sign in again.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data: bookingRows, error: bookingsError } = await supabase
          .from('trainer_bookings')
          .select('id, gym_goer_id, status')
          .eq('trainer_id', user.id);

        if (bookingsError) throw bookingsError;

        const bookings = (bookingRows ?? []) as BookingRow[];
        const clientIds = [
          ...new Set(bookings.map((booking) => booking.gym_goer_id)),
        ];

        if (clientIds.length === 0) {
          if (isActive) {
            setClients([]);
            setIsLoading(false);
          }
          return;
        }

        const [
          { data: profileRows, error: profilesError },
          { data: goalRows, error: goalsError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', clientIds),

          supabase
            .from('gym_goer_fitness_goals')
            .select('user_id, goal')
            .in('user_id', clientIds),
        ]);

        if (profilesError) throw profilesError;
        if (goalsError) throw goalsError;

        const profiles = (profileRows ?? []) as ProfileRow[];
        const goals = (goalRows ?? []) as FitnessGoalRow[];

        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile]),
        );

        const goalsByUserId = new Map<string, string[]>();

        goals.forEach((item) => {
          const current = goalsByUserId.get(item.user_id) ?? [];
          current.push(item.goal);
          goalsByUserId.set(item.user_id, current);
        });

        const clientsById = new Map<string, Client>();

        clientIds.forEach((clientId) => {
          const profile = profilesById.get(clientId);
          const firstName = profile?.first_name?.trim() ?? '';
          const lastName = profile?.last_name?.trim() ?? '';
          const name = [firstName, lastName].filter(Boolean).join(' ') || 'TRAINR client';

          const clientBookings = bookings.filter(
            (booking) => booking.gym_goer_id === clientId,
          );

          const hasActiveBooking = clientBookings.some(
            (booking) =>
              booking.status === 'confirmed' ||
              booking.status === 'completed',
          );

          const completedSessions = clientBookings.filter(
            (booking) => booking.status === 'completed',
          ).length;

          clientsById.set(clientId, {
            id: clientId,
            name,
            goal: getGoalLabel(goalsByUserId.get(clientId) ?? []),
            status: hasActiveBooking ? 'Active' : 'Pending',
            sessions: completedSessions,
            initials: getInitials(name) || 'TC',
          });
        });

        if (isActive) {
          setClients(Array.from(clientsById.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ));
        }
      } catch (error) {
        console.error('[Trainer Clients] Failed to load clients:', error);

        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load your clients. Please try again.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadClients();

    return () => {
      isActive = false;
    };
  }, [user, reloadKey]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(query) ||
        client.goal.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' || client.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [clients, search, activeFilter]);

  const activeCount = clients.filter(
    (client) => client.status === 'Active',
  ).length;

  const pendingCount = clients.filter(
    (client) => client.status === 'Pending',
  ).length;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText
              variant="caption"
              color={colors.brand.red}
              style={{ letterSpacing: 1.5 }}
            >
              TRAINER WORKSPACE
            </AppText>

            <AppText variant="displayLarge" color={colors.text.primary}>
              CLIENTS.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Your people. Their progress.
            </AppText>
          </View>

          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand.red,
            }}
          >
            <AppText variant="h3" color="#FFFFFF">
              {clients.length}
            </AppText>
          </View>
        </View>

        {/* Search */}
        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <AppText variant="body" color={colors.text.tertiary}>
            Search
          </AppText>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Name or fitness goal"
            placeholderTextColor={colors.text.tertiary}
            accessibilityLabel="Search clients by name or fitness goal"
            returnKeyType="search"
            autoCapitalize="none"
            style={{
              flex: 1,
              marginLeft: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text.primary,
              fontSize: 16,
            }}
          />

          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear client search"
              onPress={() => setSearch('')}
              hitSlop={8}
            >
              <AppText variant="button" color={colors.brand.red}>
                Clear
              </AppText>
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="h3" color={colors.text.primary}>
            YOUR CLIENTS
          </AppText>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {filters.map((filter) => {
              const selected = activeFilter === filter;

              return (
                <Pressable
                  key={filter}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveFilter(filter)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.brand.red
                      : colors.border.default,
                    backgroundColor: selected
                      ? colors.brand.red
                      : colors.background.primary,
                  }}
                >
                  <AppText
                    variant="button"
                    color={selected ? '#FFFFFF' : colors.text.secondary}
                  >
                    {filter}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Loading */}
        {isLoading && (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              gap: spacing.md,
            }}
          >
            <ActivityIndicator color={colors.brand.red} />
            <AppText variant="body" color={colors.text.secondary}>
              Loading your clients...
            </AppText>
          </View>
        )}

        {/* Error */}
        {!isLoading && errorMessage && (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              gap: spacing.md,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              UNABLE TO LOAD CLIENTS.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center' }}
            >
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadKey((current) => current + 1)}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Try again
              </AppText>
            </Pressable>
          </View>
        )}

        {/* Client list */}
        {!isLoading && !errorMessage && filteredClients.length > 0 && (
          <View style={{ gap: spacing.md }}>
            {filteredClients.map((client) => {
              const isActive = client.status === 'Active';

              return (
                <Pressable
                  key={client.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${client.name}, ${client.status} client`}
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/personal-trainer/clients/[clientId]',
                      params: { clientId: client.id },
                    });
                  }}
                  style={({ pressed }) => ({
                    padding: spacing.md,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.md,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.brand.red,
                      }}
                    >
                      <AppText variant="h3" color="#FFFFFF">
                        {client.initials}
                      </AppText>
                    </View>

                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="h3" color={colors.text.primary}>
                        {client.name}
                      </AppText>

                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {client.goal}
                      </AppText>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: 8,
                        backgroundColor: isActive
                          ? colors.brand.redLight
                          : colors.background.primary,
                        borderWidth: 1,
                        borderColor: isActive
                          ? colors.brand.red
                          : colors.border.default,
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={
                          isActive ? colors.brand.red : colors.text.secondary
                        }
                      >
                        {client.status}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border.default,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.text.tertiary}>
                        COMPLETED SESSIONS
                      </AppText>

                      <AppText variant="h3" color={colors.text.primary}>
                        {client.sessions}
                      </AppText>
                    </View>

                    <AppText variant="button" color={colors.brand.red}>
                      View client →
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Empty state */}
        {!isLoading && !errorMessage && filteredClients.length === 0 && (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              gap: spacing.md,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {clients.length === 0 ? 'NO CLIENTS YET.' : 'NO CLIENTS FOUND.'}
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center' }}
            >
              {clients.length === 0
                ? 'Clients will appear here when they have a booking with you.'
                : 'Try another search term or select a different status filter.'}
            </AppText>

            {clients.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSearch('');
                  setActiveFilter('All');
                }}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: 12,
                  backgroundColor: colors.brand.red,
                }}
              >
                <AppText variant="button" color="#FFFFFF">
                  Clear filters
                </AppText>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
