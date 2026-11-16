import { resolveNotificationRoute } from '../notifications/notification-navigation';

describe('resolveNotificationRoute', () => {
  const gymGoerHome = { pathname: '/(tabs)/gym-goer' } as const;
  const trainerHome = { pathname: '/(tabs)/personal-trainer' } as const;

  it.each([
    'booking_requested',
    'booking_reschedule_requested',
    'booking_cancelled',
  ])('routes trainer event %s to the trainer schedule', (eventType) => {
    expect(
      resolveNotificationRoute({
        eventType,
        entityType: 'booking',
        entityId: 'booking-123',
        role: 'trainer',
      }),
    ).toEqual({ pathname: '/(tabs)/personal-trainer/schedule' });
  });

  it.each([
    'booking_confirmed',
    'booking_declined',
    'payment_succeeded',
    'payment_failed',
    'session_reminder',
    'session_completed',
  ])('routes gym-goer event %s to sessions', (eventType) => {
    expect(
      resolveNotificationRoute({
        eventType,
        entityType: 'booking',
        entityId: 'booking-123',
        role: 'gym_goer',
      }),
    ).toEqual({ pathname: '/(tabs)/gym-goer/sessions' });
  });

  it('routes workout assignments to gym-goer workouts', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'workout_assigned',
        entityType: 'workout_assignment',
        entityId: 'assignment-123',
        role: 'gym_goer',
      }),
    ).toEqual({ pathname: '/(tabs)/gym-goer/workouts' });
  });

  it('routes trainer feedback to gym-goer workouts', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'trainer_feedback_created',
        entityType: 'trainer_feedback',
        entityId: 'feedback-123',
        role: 'gym_goer',
      }),
    ).toEqual({ pathname: '/(tabs)/gym-goer/workouts' });
  });

  it('routes post-session follow-ups to the matching workout log', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'post_session_followup',
        entityType: 'workout_log',
        entityId: 'workout-log-123',
        role: 'gym_goer',
      }),
    ).toEqual({
      pathname: '/(tabs)/gym-goer-workout/session/[assignmentId]',
      params: { assignmentId: 'workout-log-123' },
    });
  });

  it('falls back to the role dashboard when the recipient role does not match', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'booking_requested',
        entityType: 'booking',
        entityId: 'booking-123',
        role: 'gym_goer',
      }),
    ).toEqual(gymGoerHome);

    expect(
      resolveNotificationRoute({
        eventType: 'booking_confirmed',
        entityType: 'booking',
        entityId: 'booking-123',
        role: 'trainer',
      }),
    ).toEqual(trainerHome);
  });

  it('falls back when the entity type does not match the event', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'workout_assigned',
        entityType: 'booking',
        entityId: 'assignment-123',
        role: 'gym_goer',
      }),
    ).toEqual(gymGoerHome);
  });

  it('falls back when the entity ID is empty', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'booking_confirmed',
        entityType: 'booking',
        entityId: ' ',
        role: 'gym_goer',
      }),
    ).toEqual(gymGoerHome);
  });

  it('falls back for unknown notification events', () => {
    expect(
      resolveNotificationRoute({
        eventType: 'unknown_event',
        entityType: 'booking',
        entityId: 'booking-123',
        role: 'gym_goer',
      }),
    ).toEqual(gymGoerHome);
  });
});
