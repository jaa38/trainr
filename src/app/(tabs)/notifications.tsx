import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ArrowLeft, CheckCheck, Inbox } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import {
  AppNotification,
  NotificationPage,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications/notification-history';
import { resolveNotificationRoute } from '@/services/notifications/notification-navigation';
import { useTrainrTheme } from '@/theme';

const PAYMENT_SUCCESS_GREEN = '#16A34A';

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();
  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(difference / 3_600_000);
  const days = Math.floor(difference / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';

  if (days < 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Select an icon that represents the notification.
 *
 * Uses the event type first, with title and body as
 * additional context for more specific notification types.
 */
function getNotificationIcon(notification: AppNotification) {
  const eventType = notification.event_type.toLowerCase();
  const title = notification.title.toLowerCase();
  const body = notification.body.toLowerCase();
  const content = `${title} ${body}`;

  if (eventType.includes('payment') || content.includes('payment')) {
    if (
      content.includes('failed') ||
      content.includes('declined') ||
      content.includes('unsuccessful')
    ) {
      return 'cash-remove';
    }

    return 'cash-check';
  }

  if (content.includes('review') || eventType.includes('review')) {
    return 'star-check';
  }

  if (
    eventType.includes('workout') ||
    content.includes('workout') ||
    content.includes('programme')
  ) {
    return 'dumbbell';
  }

  if (
    eventType.includes('booking') ||
    content.includes('booking') ||
    content.includes('session')
  ) {
    if (
      content.includes('declined') ||
      content.includes('cancelled') ||
      content.includes('canceled')
    ) {
      return 'calendar-remove';
    }

    if (content.includes('confirmed') || content.includes('accepted')) {
      return 'calendar-check';
    }

    return 'calendar-clock';
  }

  return 'bell-outline';
}

/**
 * Identifies successful payment notifications.
 */
function isSuccessfulPaymentNotification(notification: AppNotification) {
  const eventType = notification.event_type.toLowerCase();
  const title = notification.title.toLowerCase();
  const body = notification.body.toLowerCase();
  const content = `${title} ${body}`;

  const isPaymentNotification =
    eventType.includes('payment') || content.includes('payment');

  const isSuccessful =
    content.includes('successful') ||
    content.includes('successfully') ||
    content.includes('success');

  const isFailed =
    content.includes('failed') ||
    content.includes('declined') ||
    content.includes('unsuccessful');

  return isPaymentNotification && isSuccessful && !isFailed;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const userRole = profile?.role;
  const { colors, spacing, radius } = useTrainrTheme();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const [page, unread] = await Promise.all([
        getNotifications(0),
        getUnreadNotificationCount(),
      ]);

      setNotifications(page.notifications);
      setUnreadCount(unread);
      setNextPage(page.nextPage);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('[Notifications] Unable to load notification history:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load your notifications. Please try again.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const loadMore = useCallback(async () => {
    if (nextPage === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page: NotificationPage = await getNotifications(nextPage);

      setNotifications((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const newItems = page.notifications.filter((item) => !existingIds.has(item.id));

        return [...current, ...newItems];
      });

      setNextPage(page.nextPage);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('[Notifications] Unable to load more notifications:', error);

      Alert.alert('Unable to load more', 'Please check your connection and try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextPage]);

  const handleMarkAsRead = useCallback(async (notification: AppNotification) => {
    if (notification.is_read) {
      return;
    }

    try {
      await markNotificationAsRead(notification.id);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.error('[Notifications] Unable to mark notification as read:', error);

      Alert.alert(
        'Update failed',
        'We could not update this notification. Please try again.',
      );
    }
  }, []);

  const handleOpenNotification = useCallback(
    async (notification: AppNotification) => {
      if (!userRole) {
        return;
      }

      if (!notification.is_read) {
        try {
          await markNotificationAsRead(notification.id);

          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? {
                    ...item,
                    is_read: true,
                    read_at: new Date().toISOString(),
                  }
                : item,
            ),
          );

          setUnreadCount((current) => Math.max(0, current - 1));
        } catch (error) {
          console.warn(
            '[Notifications] Could not mark opened notification as read:',
            error,
          );
        }
      }

      const route = resolveNotificationRoute({
        eventType: notification.event_type,
        entityType: notification.entity_type,
        entityId: notification.entity_id,
        role: userRole === 'trainer' ? 'trainer' : 'gym_goer',
      });

      router.push(route as Href);
    },
    [userRole, router],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      await markAllNotificationsAsRead();

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? readAt,
        })),
      );

      setUnreadCount(0);
    } catch (error) {
      console.error('[Notifications] Unable to mark all as read:', error);

      Alert.alert(
        'Update failed',
        'We could not mark your notifications as read. Please try again.',
      );
    }
  }, [unreadCount]);

  const renderNotification = (notification: AppNotification) => {
    const unread = !notification.is_read;
    const notificationIcon = getNotificationIcon(notification);
    const isPaymentSuccess = isSuccessfulPaymentNotification(notification);

    /**
     * Payment success icon:
     * - Trainer: Green
     * - Gym-goer: Red
     *
     * All other notification icons retain their existing colours.
     */
    const notificationIconColor = isPaymentSuccess
      ? userRole === 'trainer'
        ? PAYMENT_SUCCESS_GREEN
        : colors.brand.red
      : unread
        ? colors.brand.red
        : colors.text.secondary;

    return (
      <Pressable
        key={notification.id}
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}. ${notification.body
          .trim()
          .replace(/[.!?]+$/, '')}. ${unread ? 'Unread' : 'Read'}.`}
        accessibilityState={{ selected: unread }}
        onPress={() => void handleOpenNotification(notification)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.md,
          backgroundColor: unread ? colors.brand.redLight : colors.background.primary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {/* Notification-specific icon */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: unread ? colors.brand.redLight : colors.surface.muted,
          }}
        >
          <MaterialCommunityIcons
            name={notificationIcon}
            size={22}
            color={notificationIconColor}
          />
        </View>

        {/* Notification content */}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <AppText variant="bodyMedium" color={colors.text.primary} style={{ flex: 1 }}>
              {notification.title}
            </AppText>

            {unread ? (
              <View
                accessibilityLabel="Unread notification"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.brand.red,
                }}
              />
            ) : null}
          </View>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            {notification.body}
          </AppText>

          <AppText variant="caption" color={colors.text.tertiary}>
            {formatNotificationDate(notification.created_at)}
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Navigation header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>

        <AppText variant="h3" color={colors.text.primary}>
          NOTIFICATIONS
        </AppText>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        testID="notifications-scroll-view"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={colors.brand.red}
            colors={[colors.brand.red]}
          />
        }
      >
        {/* Updates heading */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <AppText variant="h2" color={colors.text.primary}>
                Your updates
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                {unreadCount === 0
                  ? 'You are all caught up.'
                  : `${unreadCount} unread ${
                      unreadCount === 1 ? 'notification' : 'notifications'
                    }`}
              </AppText>
            </View>

            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="small"
                onPress={() => void handleMarkAllAsRead()}
                leftIcon={<CheckCheck size={16} color={colors.brand.red} />}
              >
                Mark all read
              </Button>
            ) : null}
          </View>
        </View>

        {/* Loading state */}
        {isLoading ? (
          <View
            style={{
              flex: 1,
              minHeight: 240,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading notifications...
            </AppText>
          </View>
        ) : errorMessage ? (
          /* Error state */
          <View
            style={{
              flex: 1,
              minHeight: 240,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
              gap: spacing.md,
            }}
          >
            <AppText variant="bodyMedium" color={colors.text.primary} align="center">
              {errorMessage}
            </AppText>

            <Button variant="outline" onPress={() => void loadNotifications()}>
              Try again
            </Button>
          </View>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <View
            style={{
              flex: 1,
              minHeight: 280,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface.muted,
              }}
            >
              <Inbox size={32} color={colors.text.tertiary} />
            </View>

            <AppText variant="h4" color={colors.text.primary}>
              You&apos;re all caught up
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary} align="center">
              When you receive updates about bookings, workouts and sessions, they&apos;ll
              appear here.
            </AppText>
          </View>
        ) : (
          /* Notification list */
          <View>
            {notifications.map(renderNotification)}

            {hasMore ? (
              <View
                style={{
                  padding: spacing.lg,
                  alignItems: 'center',
                }}
              >
                <Button
                  variant="outline"
                  loading={isLoadingMore}
                  disabled={isLoadingMore}
                  onPress={() => void loadMore()}
                >
                  Load more
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
