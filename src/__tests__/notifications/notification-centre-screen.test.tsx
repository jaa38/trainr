import React from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import NotificationsScreen from '@/app/(tabs)/notifications';
import { useAuth } from '@/providers/AuthProvider';
import type {
  AppNotification,
  NotificationPage,
} from '@/services/notifications/notification-history';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications/notification-history';
import { resolveNotificationRoute } from '@/services/notifications/notification-navigation';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
};

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    useRouter: () => mockRouter,
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    ArrowLeft: (props: object) => React.createElement(View, props),
    Bell: (props: object) => React.createElement(View, props),
    CheckCheck: (props: object) => React.createElement(View, props),
    Inbox: (props: object) => React.createElement(View, props),
  };
});

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/notifications/notification-history', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  markNotificationAsRead: jest.fn(),
}));

jest.mock('@/services/notifications/notification-navigation', () => ({
  resolveNotificationRoute: jest.fn(),
}));

jest.mock('@/theme', () => ({
  useTrainrTheme: () => ({
    colors: {
      background: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
      },
      brand: {
        red: '#D71920',
        redLight: '#FDE8E9',
      },
      surface: {
        muted: '#F5F5F5',
      },
      text: {
        primary: '#0B0B0B',
        secondary: '#666666',
        tertiary: '#999999',
      },
      border: {
        subtle: '#E5E5E5',
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    radius: {
      pill: 999,
    },
  }),
}));

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    AppText: ({ children, style }: React.PropsWithChildren<{ style?: object }>) =>
      React.createElement(Text, { style }, children),
  };
});

jest.mock('@/components/Button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    Button: ({
      children,
      onPress,
      disabled,
    }: React.PropsWithChildren<{
      onPress?: () => void;
      disabled?: boolean;
    }>) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          disabled,
          onPress,
        },
        React.createElement(Text, null, children),
      ),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockGetNotifications = jest.mocked(getNotifications);
const mockGetUnreadNotificationCount = jest.mocked(getUnreadNotificationCount);
const mockMarkAllNotificationsAsRead = jest.mocked(markAllNotificationsAsRead);
const mockMarkNotificationAsRead = jest.mocked(markNotificationAsRead);
const mockResolveNotificationRoute = jest.mocked(resolveNotificationRoute);

const mockNotification: AppNotification = {
  id: 'notification-1',
  outbox_id: 'outbox-1',
  user_id: 'test-user-id',
  event_type: 'booking_confirmed',
  title: 'Booking confirmed',
  body: 'Your training session has been confirmed.',
  entity_type: 'booking',
  entity_id: 'booking-1',
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
};

const mockReadNotification: AppNotification = {
  ...mockNotification,
  id: 'notification-2',
  event_type: 'workout_assigned',
  title: 'New workout assigned',
  body: 'Your trainer has assigned a new workout.',
  entity_type: 'workout_assignment',
  entity_id: 'assignment-1',
  is_read: true,
  read_at: new Date().toISOString(),
};

function createPage(
  notifications: AppNotification[] = [mockNotification],
  hasMore = false,
  nextPage: number | null = null,
): NotificationPage {
  return {
    notifications,
    hasMore,
    nextPage,
  };
}

function setupDefaultMocks() {
  mockGetNotifications.mockResolvedValue(createPage());
  mockGetUnreadNotificationCount.mockResolvedValue(1);
  mockMarkNotificationAsRead.mockResolvedValue(undefined);
  mockMarkAllNotificationsAsRead.mockResolvedValue(undefined);

  mockResolveNotificationRoute.mockReturnValue({
    pathname: '/(tabs)/gym-goer/sessions',
  });
}

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      profile: {
        id: 'test-user-id',
        role: 'gym_goer',
      },
    } as unknown as ReturnType<typeof useAuth>);

    setupDefaultMocks();
  });

  it('loads and displays notifications and unread count', async () => {
    const { getByText, getByLabelText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Your updates')).toBeTruthy();
      expect(getByText('1 unread notification')).toBeTruthy();
      expect(getByText('Booking confirmed')).toBeTruthy();
      expect(getByText('Your training session has been confirmed.')).toBeTruthy();
    });

    expect(
      getByLabelText(
        'Booking confirmed. Your training session has been confirmed. Unread.',
      ),
    ).toBeTruthy();

    expect(mockGetNotifications).toHaveBeenCalledWith(0);
    expect(mockGetUnreadNotificationCount).toHaveBeenCalledTimes(1);
  });

  it('displays the empty state when there are no notifications', async () => {
    mockGetNotifications.mockResolvedValue(createPage([], false, null));
    mockGetUnreadNotificationCount.mockResolvedValue(0);

    const { getByText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText("You're all caught up")).toBeTruthy();
      expect(getByText('You are all caught up.')).toBeTruthy();
    });

    expect(
      getByText(
        "When you receive updates about bookings, workouts and sessions, they'll appear here.",
      ),
    ).toBeTruthy();
  });

  it('displays a load error and retries successfully', async () => {
    mockGetNotifications
      .mockRejectedValueOnce(new Error('Unable to load notifications. Please try again.'))
      .mockResolvedValueOnce(createPage());

    const { getByText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Unable to load notifications. Please try again.')).toBeTruthy();
    });

    fireEvent.press(getByText('Try again'));

    await waitFor(() => {
      expect(getByText('Booking confirmed')).toBeTruthy();
    });

    expect(mockGetNotifications).toHaveBeenCalledTimes(2);
  });

  it('refreshes the notification history', async () => {
    const { getByTestId, getByText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Booking confirmed')).toBeTruthy();
    });

    const scrollView = getByTestId('notifications-scroll-view');
    const refreshControl = scrollView.props.refreshControl;

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalledTimes(2);
      expect(mockGetUnreadNotificationCount).toHaveBeenCalledTimes(2);
    });
  });

  it('marks an individual notification as read when opened', async () => {
    const { getByLabelText, getByText } = await render(<NotificationsScreen />);

    const notification = getByLabelText(
      'Booking confirmed. Your training session has been confirmed. Unread.',
    );

    await act(async () => {
      fireEvent.press(notification);
    });

    await waitFor(() => {
      expect(mockMarkNotificationAsRead).toHaveBeenCalledWith('notification-1');
    });

    expect(mockResolveNotificationRoute).toHaveBeenCalledWith({
      eventType: 'booking_confirmed',
      entityType: 'booking',
      entityId: 'booking-1',
      role: 'gym_goer',
    });

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/gym-goer/sessions',
    });

    expect(getByText('You are all caught up.')).toBeTruthy();
  });

  it('navigates even if marking an opened notification as read fails', async () => {
    mockMarkNotificationAsRead.mockRejectedValueOnce(
      new Error('Unable to update notification'),
    );

    const { getByLabelText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(
        getByLabelText(
          'Booking confirmed. Your training session has been confirmed. Unread.',
        ),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(
        getByLabelText(
          'Booking confirmed. Your training session has been confirmed. Unread.',
        ),
      );
    });

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/gym-goer/sessions',
      });
    });
  });

  it('does not mark an already-read notification as read again', async () => {
    mockGetNotifications.mockResolvedValue(createPage([mockReadNotification]));
    mockGetUnreadNotificationCount.mockResolvedValue(0);

    const { getByLabelText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(
        getByLabelText(
          'New workout assigned. Your trainer has assigned a new workout. Read.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(
      getByLabelText(
        'New workout assigned. Your trainer has assigned a new workout. Read.',
      ),
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalled();
    });

    expect(mockMarkNotificationAsRead).not.toHaveBeenCalled();
  });

  it('marks all notifications as read', async () => {
    mockGetNotifications.mockResolvedValue(
      createPage([mockNotification, mockReadNotification]),
    );
    mockGetUnreadNotificationCount.mockResolvedValue(1);

    const { getByText, getByLabelText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Mark all read')).toBeTruthy();
    });

    fireEvent.press(getByText('Mark all read'));

    await waitFor(() => {
      expect(mockMarkAllNotificationsAsRead).toHaveBeenCalledTimes(1);
      expect(getByText('You are all caught up.')).toBeTruthy();
    });

    expect(
      getByLabelText(
        'Booking confirmed. Your training session has been confirmed. Read.',
      ),
    ).toBeTruthy();
  });

  it('loads another page and avoids adding duplicate notifications', async () => {
    const secondNotification: AppNotification = {
      ...mockNotification,
      id: 'notification-3',
      title: 'Session reminder',
      body: 'Your session starts soon.',
      event_type: 'session_reminder',
    };

    mockGetNotifications
      .mockResolvedValueOnce(createPage([mockNotification], true, 1))
      .mockResolvedValueOnce(
        createPage([mockNotification, secondNotification], false, null),
      );

    const { getByText, queryAllByText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Load more')).toBeTruthy();
    });

    fireEvent.press(getByText('Load more'));

    await waitFor(() => {
      expect(getByText('Session reminder')).toBeTruthy();
    });

    expect(mockGetNotifications).toHaveBeenNthCalledWith(1, 0);
    expect(mockGetNotifications).toHaveBeenNthCalledWith(2, 1);
    expect(queryAllByText('Booking confirmed')).toHaveLength(1);
  });

  it('does not navigate when the user role is unavailable', async () => {
    mockUseAuth.mockReturnValue({
      profile: null,
    } as unknown as ReturnType<typeof useAuth>);

    const { getByLabelText } = await render(<NotificationsScreen />);

    await waitFor(() => {
      expect(
        getByLabelText(
          'Booking confirmed. Your training session has been confirmed. Unread.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(
      getByLabelText(
        'Booking confirmed. Your training session has been confirmed. Unread.',
      ),
    );

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockMarkNotificationAsRead).not.toHaveBeenCalled();
  });

  it('navigates back when the back control is pressed', async () => {
    const { getByLabelText } = await render(<NotificationsScreen />);

    fireEvent.press(getByLabelText('Go back'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
