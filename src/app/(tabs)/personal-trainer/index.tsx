import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react-native';
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
import {
  getTrainerDashboard,
  type TrainerDashboardData,
  type TrainerDashboardProgress,
} from '@/services/trainer-dashboard';
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
  recentWorkouts: [],
  recentProgress: [],
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

function formatMetricType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatActivityDate(value: string, timezone: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  });
}

function formatMeasurement(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getProgressChangeLabel(item: TrainerDashboardProgress) {
  if (item.change === null) {
    return 'First measurement';
  }

  if (item.change > 0) {
    return `+${formatMeasurement(item.change)} ${item.unit}`;
  }

  if (item.change < 0) {
    return `${formatMeasurement(item.change)} ${item.unit}`;
  }

  return 'No change';
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

function ProgressCard({
  item,
  timezone,
}: {
  item: TrainerDashboardProgress;
  timezone: string;
}) {
  const { colors, spacing } = useTrainrTheme();

  const change = item.change;
  const hasPreviousMeasurement = item.previous_value !== null;
  const hasChange = change !== null;

  const changeColor =
    change === null || change === 0
      ? colors.text.secondary
      : change > 0
        ? colors.brand.red
        : colors.text.secondary;

  const ChangeIcon =
    change === null ? Minus : change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.background.secondary,
        gap: spacing.md,
      }}
    >
      {/* Client information */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="bodyMedium" color={colors.text.primary}>
            {item.client_name}
          </AppText>

          <AppText variant="caption" color={colors.text.secondary}>
            {formatMetricType(item.metric_type)}
          </AppText>
        </View>

        <AppText variant="caption" color={colors.text.tertiary}>
          {formatActivityDate(item.recorded_at, timezone)}
        </AppText>
      </View>

      {/* Measurement comparison */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="caption" color={colors.text.tertiary}>
            PREVIOUS
          </AppText>

          <AppText variant="h3" color={colors.text.secondary}>
            {hasPreviousMeasurement
              ? `${formatMeasurement(item.previous_value!)} ${item.unit}`
              : '--'}
          </AppText>
        </View>

        <View
          style={{
            width: 1,
            height: 42,
            backgroundColor: colors.border.default,
          }}
        />

        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="caption" color={colors.text.tertiary}>
            CURRENT
          </AppText>

          <AppText variant="h2" color={colors.text.primary}>
            {formatMeasurement(item.value)} {item.unit}
          </AppText>
        </View>
      </View>

      {/* Recorded change */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
        }}
      >
        <AppText variant="caption" color={colors.text.secondary}>
          RECORDED CHANGE
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <ChangeIcon size={16} color={changeColor} />

          <AppText variant="bodyMedium" color={changeColor}>
            {getProgressChangeLabel(item)}
          </AppText>
        </View>
      </View>
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

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

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
            onRefresh={() => void loadDashboard(true)}
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

        {/* Error state */}
        {errorMessage ? (
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

        {/* Performance overview */}
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="OVERVIEW" />

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
                Loading your dashboard...
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

        {/* Recent workouts */}
        <View>
          <SectionHeading
            title="RECENT WORKOUTS"
            action="View clients"
            onPress={() => navigateTo('/(tabs)/personal-trainer/clients')}
          />

          {dashboard.recentWorkouts.length === 0 ? (
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
                Completed workouts linked to your assigned plans will appear here.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {dashboard.recentWorkouts.map((workout) => (
                <View
                  key={workout.id}
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
                    {workout.client_name}
                  </AppText>

                  {(workout.day_name || workout.day_number) && (
                    <AppText variant="caption" color={colors.text.secondary}>
                      {workout.day_name || `Day ${workout.day_number}`}
                    </AppText>
                  )}

                  <AppText variant="caption" color={colors.text.secondary}>
                    {formatActivityDate(workout.started_at, dashboard.timezone)}
                    {workout.duration_minutes
                      ? ` · ${workout.duration_minutes} minutes`
                      : ''}
                  </AppText>

                  <AppText variant="caption" color={colors.text.tertiary}>
                    {workout.completed_at ? 'Completed' : 'In progress'}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Client progress */}
        <View>
          <SectionHeading title="CLIENT PROGRESS" />

          {dashboard.recentProgress.length === 0 ? (
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
                No client measurements yet
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Fitness measurements from your confirmed and completed clients will appear
                here.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {dashboard.recentProgress.map((item) => (
                <ProgressCard
                  key={`${item.user_id}-${item.metric_type}`}
                  item={item}
                  timezone={dashboard.timezone}
                />
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

        <AppText variant="caption" color={colors.text.tertiary} align="center">
          TRAINR · TRAIN SMARTER. PERFORM BETTER.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
