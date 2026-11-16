export type NotificationRole = 'gym_goer' | 'trainer';

export type NotificationRoute = {
    pathname:
        | '/(tabs)/gym-goer'
        | '/(tabs)/personal-trainer'
        | '/(tabs)/gym-goer/sessions'
        | '/(tabs)/personal-trainer/schedule'
        | '/(tabs)/gym-goer/workouts'
        | '/(tabs)/gym-goer-workout/history'
        | '/(tabs)/gym-goer-workout/session/[assignmentId]';
    params?: {
        assignmentId: string;
    };
};

type NotificationRouteInput = {
    eventType: string;
    entityType: string;
    entityId: string;
    role: NotificationRole;
};

const ROLE_HOME: Record<NotificationRole, NotificationRoute> = {
    gym_goer: {
        pathname: '/(tabs)/gym-goer',
    },
    trainer: {
        pathname: '/(tabs)/personal-trainer',
    },
};

const GYM_GOER_SESSIONS: NotificationRoute = {
    pathname: '/(tabs)/gym-goer/sessions',
};

const TRAINER_SCHEDULE: NotificationRoute = {
    pathname: '/(tabs)/personal-trainer/schedule',
};

const GYM_GOER_WORKOUTS: NotificationRoute = {
    pathname: '/(tabs)/gym-goer/workouts',
};


/**
 * Resolves a notification to a safe in-app destination.
 *
 * Entity types and recipient roles are checked before navigation.
 * Unknown events, mismatched entities and invalid IDs fall back
 * to the authenticated user's role-specific dashboard.
 */
export function resolveNotificationRoute({
    eventType,
    entityType,
    entityId,
    role,
}: NotificationRouteInput): NotificationRoute {
    const fallback = ROLE_HOME[role];

    if (!entityId?.trim()) {
        return fallback;
    }

    switch (eventType) {
        case 'booking_requested':
        case 'booking_reschedule_requested':
        case 'booking_cancelled':
            return role === 'trainer' && entityType === 'booking'
                ? TRAINER_SCHEDULE
                : fallback;

        case 'booking_confirmed':
        case 'booking_declined':
        case 'payment_succeeded':
        case 'payment_failed':
        case 'session_reminder':
        case 'session_completed':
            return role === 'gym_goer' && entityType === 'booking'
                ? GYM_GOER_SESSIONS
                : fallback;

        case 'workout_assigned':
            return role === 'gym_goer' &&
                entityType === 'workout_assignment'
                ? GYM_GOER_WORKOUTS
                : fallback;

        case 'trainer_feedback_created':
            return role === 'gym_goer' &&
                entityType === 'trainer_feedback'
                ? GYM_GOER_WORKOUTS
                : fallback;

        case 'post_session_followup':
            return role === 'gym_goer' && entityType === 'workout_log'
                ? {
                    pathname:
                        '/(tabs)/gym-goer-workout/session/[assignmentId]',
                    params: {
                        assignmentId: entityId,
                    },
                }
                : fallback;

        default:
            return fallback;
    }
}
