import { useFocusEffect, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { getUnreadNotificationCount } from '@/services/notifications/notification-history';
import { useTrainrTheme } from '@/theme';

export function NotificationBell() {
  const router = useRouter();
  const { colors, radius, spacing } = useTrainrTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadUnreadCount() {
        try {
          const count = await getUnreadNotificationCount();

          if (isActive) {
            setUnreadCount(count);
          }
        } catch (error) {
          console.error(
            '[Notification Bell] Unable to load unread count:',
            error,
          );
        }
      }

      void loadUnreadCount();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const accessibilityLabel =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : 'Notifications';

  return (
    <View style={{ position: 'relative' }}>
      <IconButton
        accessibilityLabel={accessibilityLabel}
        onPress={() => router.push('/(tabs)/notifications')}
      >
        <Bell size={22} color={colors.text.primary} />
      </IconButton>

      {unreadCount > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.brand.red,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background.primary,
          }}
        >
          <AppText
            variant="caption"
            color="#FFFFFF"
            weight="bold"
            style={{ fontSize: 9, lineHeight: 12 }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
