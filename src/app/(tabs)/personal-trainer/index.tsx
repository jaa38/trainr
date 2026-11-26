import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { getFitnessGoals } from '@/services/fitness-goals';
import { getPersonalRecords } from '@/services/personal-records';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import {
  getTrainerDashboard,
  type TrainerDashboardData,
} from '@/services/trainer-dashboard';
import type {
  FitnessGoal,
  PersonalRecord,
  PersonalWorkout,
} from '@/types/personal-workouts';
import { useTrainrTheme } from '@/theme';

const EMPTY_DASHBOARD: TrainerDashboardData = {
  metrics: {
    activeClients: 0,
    pendingRequests: 0,
    upcomingSessions: 0,
    completedSessions: 0,
  },
  timezone: 'Africa/Lagos',
  upcomingSessions: [],
};

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function formatSessionDate(value: string, timezone: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  });
}

function formatSessionTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  });
}

function formatWorkoutDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// -----------------------------------------------------------------------------
// Reusable dashboard components
// These must remain outside PersonalTrainerHomeScreen.
// -----------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const { colors, spacing } = useTrainrTheme();

  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.background.secondary,
        gap: spacing.sm,
      }}
    >
      <AppText variant="caption" color={colors.text.secondary}>
        {label}
      </AppText>

      <AppText variant="h1" color={colors.text.primary}>
        {value}
      </AppText>

      <AppText variant="caption" color={colors.text.tertiary}>
        {description}
      </AppText>
    </View>
  );
}

function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors, spacing } = useTrainrTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
      }}
    >
      <AppText variant="h3" color={colors.text.primary}>
        {title}
      </AppText>

      {action && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
          <AppText variant="caption" color={colors.brand.red}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Personal Trainer Dashboard
// -----------------------------------------------------------------------------

export default function PersonalTrainerHomeScreen() {
  const router = useRouter();
  const { colors, spacing, mode } = useTrainrTheme();

  const [dashboard, setDashboard] = useState<TrainerDashboardData>(EMPTY_DASHBOARD);
  const [activeTab, setActiveTab] = useState<'clients' | 'progress' | 'my-progress'>(
    'clients',
  );

  const [personalWorkouts, setPersonalWorkouts] = useState<PersonalWorkout[]>([]);
  const [fitnessGoals, setFitnessGoals] = useState<FitnessGoal[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [isPersonalProgressLoading, setIsPersonalProgressLoading] = useState(false);
  const [personalProgressError, setPersonalProgressError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appIcon =
    mode === 'dark'
      ? require('../../../../assets/images/icons/darkModeAppIcon.png')
      : require('../../../../assets/images/icons/lightModeAppIcon.png');

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const result = await getTrainerDashboard();
      setDashboard(result);
    } catch (error) {
      console.error('[Trainer Dashboard] Unable to load dashboard:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load your dashboard. Please try again.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadMyProgress = useCallback(async () => {
    setIsPersonalProgressLoading(true);
    setPersonalProgressError(null);

    const [workoutsResult, goalsResult, recordsResult] = await Promise.allSettled([
      getPersonalWorkoutHistory({ limit: 3 }),
      getFitnessGoals({ status: 'active' }),
      getPersonalRecords({ limit: 3 }),
    ]);

    const failedSections: string[] = [];

    if (workoutsResult.status === 'fulfilled') {
      setPersonalWorkouts(workoutsResult.value);
    } else {
      failedSections.push('workout history');
    }

    if (goalsResult.status === 'fulfilled') {
      setFitnessGoals(goalsResult.value);
    } else {
      failedSections.push('fitness goals');
    }

    if (recordsResult.status === 'fulfilled') {
      setPersonalRecords(recordsResult.value);
    } else {
      failedSections.push('personal records');
    }

    if (failedSections.length > 0) {
      setPersonalProgressError(
        `Unable to load ${failedSections.join(', ')}. Pull down to try again.`,
      );
    }

    setIsPersonalProgressLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'my-progress') {
        void loadMyProgress();
      }
    }, [activeTab, loadMyProgress]),
  );

  function selectTab(tab: 'clients' | 'progress' | 'my-progress') {
    setActiveTab(tab);
  }

  function navigateTo(route: string) {
    router.push(route as never);
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void loadDashboard(true);

              if (activeTab === 'my-progress') {
                void loadMyProgress();
              }
            }}
            tintColor={colors.brand.red}
            colors={[colors.brand.red]}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{ letterSpacing: 1.2 }}
            >
              TRAINER WORKSPACE
            </AppText>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <NotificationBell />

            <Image
              source={appIcon}
              accessibilityLabel="TRAINR app icon"
              resizeMode="contain"
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
              }}
            />
          </View>
        </View>

        {/* Welcome */}
        <View style={{ gap: spacing.xs }}>
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{ letterSpacing: 1.4 }}
          >
            YOUR BUSINESS. YOUR IMPACT.
          </AppText>

          <AppText variant="displayMedium" color={colors.text.primary}>
            YOUR DASHBOARD.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Manage your clients, organise your sessions and track training progress from
            one place.
          </AppText>
        </View>

        {/* Dashboard tabs */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: spacing.xs,
            gap: spacing.xs,
            borderRadius: 999,
            backgroundColor: colors.background.secondary,
            zIndex: 20,
            elevation: 20,
          }}
        >
          {[
            { key: 'clients', label: 'Clients' },
            { key: 'progress', label: 'Progress' },
            { key: 'my-progress', label: 'My Progress' },
          ].map((tab) => {
            const selected = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tab.label} tab`}
                onPress={() =>
                  selectTab(tab.key as 'clients' | 'progress' | 'my-progress')
                }
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.surface.default : 'transparent',
                }}
              >
                <AppText
                  variant="label"
                  weight="600"
                  color={selected ? colors.brand.red : colors.text.secondary}
                >
                  {tab.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Error state */}
        {errorMessage && activeTab !== 'my-progress' ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.lg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.brand.red,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="body" color={colors.text.error}>
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => void loadDashboard()}
              style={{
                alignSelf: 'flex-start',
                paddingVertical: spacing.sm,
              }}
            >
              <AppText variant="button" color={colors.brand.red}>
                Try again
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {/* Clients tab */}
        {activeTab === 'clients' ? (
          <>
            <View style={{ gap: spacing.md }}>
              <SectionHeading title="CLIENT OVERVIEW" />

              {isLoading && !isRefreshing ? (
                <View
                  style={{
                    paddingVertical: spacing.xxl,
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <ActivityIndicator size="large" color={colors.brand.red} />

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Loading your clients...
                  </AppText>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.md,
                  }}
                >
                  <MetricCard
                    label="ACTIVE CLIENTS"
                    value={dashboard.metrics.activeClients}
                    description="Clients with confirmed bookings"
                  />

                  <MetricCard
                    label="PENDING REQUESTS"
                    value={dashboard.metrics.pendingRequests}
                    description="Awaiting your response"
                  />
                </View>
              )}
            </View>

            {/* Upcoming sessions */}
            <View>
              <SectionHeading
                title="UPCOMING SESSIONS"
                action="View schedule"
                onPress={() => navigateTo('/(tabs)/personal-trainer/schedule')}
              />

              {dashboard.upcomingSessions.length === 0 ? (
                <View
                  style={{
                    padding: spacing.lg,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.xs,
                  }}
                >
                  <AppText variant="bodyMedium" color={colors.text.primary}>
                    No upcoming sessions
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Confirmed future bookings will appear here.
                  </AppText>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {dashboard.upcomingSessions.map((session) => (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`View schedule for ${session.client_name}`}
                      onPress={() => navigateTo('/(tabs)/personal-trainer/schedule')}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: spacing.lg,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText variant="bodyMedium" color={colors.text.primary}>
                          {session.client_name}
                        </AppText>

                        <AppText variant="caption" color={colors.text.secondary}>
                          {formatSessionDate(session.scheduled_start, dashboard.timezone)}
                        </AppText>
                      </View>

                      <View
                        style={{
                          alignItems: 'flex-end',
                          gap: spacing.xs,
                        }}
                      >
                        <AppText variant="bodyMedium" color={colors.brand.red}>
                          {formatSessionTime(session.scheduled_start, dashboard.timezone)}
                        </AppText>

                        <AppText variant="caption" color={colors.text.tertiary}>
                          {formatSessionTime(session.scheduled_end, dashboard.timezone)}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Quick actions */}
            <View>
              <SectionHeading title="QUICK ACTIONS" />

              <View style={{ gap: spacing.sm }}>
                {[
                  {
                    label: 'MANAGE CLIENTS',
                    description: 'View your client directory and profiles.',
                    route: '/(tabs)/personal-trainer/clients',
                  },
                  {
                    label: 'MANAGE SCHEDULE',
                    description: 'Review bookings and training availability.',
                    route: '/(tabs)/personal-trainer/schedule',
                  },
                  {
                    label: 'WORKOUT PLANS',
                    description: 'Create and manage training programmes.',
                    route: '/(tabs)/personal-trainer/more/workout-plans',
                  },
                ].map((action) => (
                  <Pressable
                    key={action.route}
                    accessibilityRole="button"
                    accessibilityLabel={`Navigate to ${action.label.toLowerCase()}`}
                    onPress={() => navigateTo(action.route)}
                    style={({ pressed }) => ({
                      minHeight: 68,
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing.lg,
                      gap: spacing.md,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      backgroundColor: colors.background.secondary,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="h3" color={colors.text.primary}>
                        {action.label}
                      </AppText>

                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {action.description}
                      </AppText>
                    </View>

                    <ArrowRight size={20} color={colors.text.secondary} />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* Professional progress tab */}
        {activeTab === 'progress' ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="h2" color={colors.text.primary}>
                Your professional performance
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                An overview of your coaching activity, client relationships and training
                sessions.
              </AppText>
            </View>

            {isLoading && !isRefreshing ? (
              <View
                style={{
                  paddingVertical: spacing.xxl,
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <ActivityIndicator size="large" color={colors.brand.red} />

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Loading your performance...
                </AppText>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.md,
                }}
              >
                <MetricCard
                  label="ACTIVE CLIENTS"
                  value={dashboard.metrics.activeClients}
                  description="Clients with confirmed bookings"
                />

                <MetricCard
                  label="PENDING REQUESTS"
                  value={dashboard.metrics.pendingRequests}
                  description="Awaiting your response"
                />

                <MetricCard
                  label="UPCOMING SESSIONS"
                  value={dashboard.metrics.upcomingSessions}
                  description="Confirmed future sessions"
                />

                <MetricCard
                  label="COMPLETED SESSIONS"
                  value={dashboard.metrics.completedSessions}
                  description="Successfully completed"
                />
              </View>
            )}

            <View
              style={{
                padding: spacing.lg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.background.secondary,
                gap: spacing.xs,
              }}
            >
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Keep building your coaching business
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Review client requests, stay on top of your schedule and keep your
                training programmes up to date.
              </AppText>

              <Pressable
                accessibilityRole="button"
                onPress={() => navigateTo('/(tabs)/personal-trainer/schedule')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                }}
              >
                <AppText variant="button" color={colors.brand.red}>
                  View your schedule
                </AppText>

                <ArrowRight size={16} color={colors.brand.red} />
              </Pressable>
            </View>
          </>
        ) : null}

        {/* My Progress tab: signed-in trainer's personal fitness data only */}
        {activeTab === 'my-progress' ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="h2" color={colors.text.primary}>
                Your personal fitness
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                Your workouts, goals and personal records — separate from your clients’
                training data.
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your personal workouts"
              onPress={() => navigateTo('/(tabs)/personal-workout')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.lg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.brand.red,
                backgroundColor: colors.background.secondary,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="bodyMedium" color={colors.text.primary}>
                  Log a workout or view your training
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Manage your personal workout history and fitness tracking.
                </AppText>
              </View>

              <ArrowRight size={20} color={colors.brand.red} />
            </Pressable>

            {isPersonalProgressLoading ? (
              <View
                style={{
                  paddingVertical: spacing.xxl,
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <ActivityIndicator size="large" color={colors.brand.red} />

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Loading your personal progress...
                </AppText>
              </View>
            ) : (
              <>
                {personalProgressError ? (
                  <View
                    accessibilityRole="alert"
                    style={{
                      padding: spacing.lg,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.brand.red,
                      backgroundColor: colors.background.secondary,
                      gap: spacing.sm,
                    }}
                  >
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {personalProgressError}
                    </AppText>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadMyProgress()}
                    >
                      <AppText variant="button" color={colors.brand.red}>
                        Retry loading
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}

                {/* Recent personal workouts */}
                <View>
                  <SectionHeading
                    title="RECENT WORKOUTS"
                    action="View all"
                    onPress={() => navigateTo('/(tabs)/personal-workout')}
                  />

                  {personalWorkouts.length === 0 ? (
                    <View
                      style={{
                        padding: spacing.lg,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                      }}
                    >
                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        No personal workouts recorded yet.
                      </AppText>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {personalWorkouts.map((workout) => (
                        <Pressable
                          key={workout.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${workout.workout_name}`}
                          onPress={() =>
                            navigateTo(`/(tabs)/personal-workout/${workout.id}`)
                          }
                          style={({ pressed }) => ({
                            padding: spacing.lg,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                            opacity: pressed ? 0.75 : 1,
                          })}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: spacing.sm,
                            }}
                          >
                            <AppText variant="bodyMedium" color={colors.text.primary}>
                              {workout.workout_name}
                            </AppText>

                            <AppText
                              variant="caption"
                              color={
                                workout.status === 'completed'
                                  ? colors.brand.red
                                  : colors.text.tertiary
                              }
                            >
                              {formatLabel(workout.status)}
                            </AppText>
                          </View>

                          <AppText variant="caption" color={colors.text.secondary}>
                            {formatWorkoutDate(workout.workout_date)} ·{' '}
                            {formatLabel(workout.workout_type)}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Active personal goals */}
                <View>
                  <SectionHeading
                    title="ACTIVE FITNESS GOALS"
                    action="Manage goals"
                    onPress={() => navigateTo('/(tabs)/personal-workout')}
                  />

                  {fitnessGoals.length === 0 ? (
                    <View
                      style={{
                        padding: spacing.lg,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                      }}
                    >
                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        You have no active fitness goals yet.
                      </AppText>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {fitnessGoals.map((goal) => (
                        <View
                          key={goal.id}
                          style={{
                            padding: spacing.lg,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                          }}
                        >
                          <AppText variant="bodyMedium" color={colors.text.primary}>
                            {goal.goal_name}
                          </AppText>

                          <AppText variant="bodySmall" color={colors.text.secondary}>
                            Target: {goal.target_value}
                            {goal.measurement_unit ? ` ${goal.measurement_unit}` : ''}
                          </AppText>

                          {goal.target_date ? (
                            <AppText variant="caption" color={colors.text.tertiary}>
                              Target date: {formatWorkoutDate(goal.target_date)}
                            </AppText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Personal records */}
                <View>
                  <SectionHeading title="PERSONAL RECORDS" />

                  {personalRecords.length === 0 ? (
                    <View
                      style={{
                        padding: spacing.lg,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                      }}
                    >
                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        Complete workouts to build your personal records.
                      </AppText>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {personalRecords.map((record) => (
                        <View
                          key={record.id}
                          style={{
                            padding: spacing.lg,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                          }}
                        >
                          <AppText variant="bodyMedium" color={colors.text.primary}>
                            {formatLabel(record.record_type)}
                          </AppText>

                          <AppText variant="h2" color={colors.brand.red}>
                            {record.record_value} {record.measurement_unit}
                          </AppText>

                          <AppText variant="caption" color={colors.text.secondary}>
                            {formatLabel(record.exercise_category)} ·{' '}
                            {formatWorkoutDate(record.achieved_at)}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        ) : null}

        <AppText variant="caption" color={colors.text.tertiary} align="center">
          TRAINR · TRAIN SMARTER. PERFORM BETTER.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
