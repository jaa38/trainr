
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

import {
    assignWorkoutPlan,
    getClientWorkoutAssignments,
    type WorkoutAssignment,
} from '@/services/workout-assignments';

import {
    getPublishedWorkoutPlans,
    type WorkoutPlan,
} from '@/services/workout-plans';

import {
    getClientFitnessProgress,
    type FitnessProgress,
} from '@/services/fitness-progress';

import {
    createTrainerFeedback,
    getTrainerFeedback,
    updateTrainerFeedback,
    type TrainerFeedback,
} from '@/services/trainer-feedback';

import {
    getTrainerSessionNotes,
    type TrainerSessionNote,
} from '@/services/trainer-session-notes';

import { useTrainrTheme } from '@/theme';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

type BookingStatus =
    | 'pending'
    | 'confirmed'
    | 'declined'
    | 'cancelled'
    | 'completed';

type ClientProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
};

type FitnessGoal = {
    user_id: string;
    goal: string;
};

type ClientBooking = {
    id: string;
    gym_goer_id: string;
    scheduled_start: string;
    scheduled_end: string;
    session_rate: number;
    currency: string;
    status: BookingStatus;
    notes: string | null;
};

type ClientPayment = {
    id: string;
    booking_id: string;
    amount: number;
    currency: string;
    provider: string;
    provider_reference: string | null;
    status: 'pending' | 'successful' | 'failed' | 'cancelled';
    initialization_status: string;
    paid_at: string | null;
    created_at: string;
};

type ClientDetailTab =
    | 'overview'
    | 'sessions'
    | 'payments'
    | 'programmes'
    | 'fitness'
    | 'feedback';

type ClientDetails = {
    profile: ClientProfile;
    goals: FitnessGoal[];
    bookings: ClientBooking[];
    payments: ClientPayment[];
    assignments: WorkoutAssignment[];
    fitnessProgress: FitnessProgress[];
    feedback: TrainerFeedback[];
    sessionNotes: TrainerSessionNote[];
};

const DEFAULT_TIMEZONE = 'Africa/Lagos';

const FITNESS_GOAL_LABELS: Record<string, string> = {
    build_muscle: 'Build muscle',
    lose_weight: 'Lose weight',
    improve_fitness: 'Improve fitness',
    increase_strength: 'Increase strength',
    improve_endurance: 'Improve endurance',
    improve_health: 'Improve general health',
    sports_performance: 'Sports performance',
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
    revoked: 'Revoked',
};

function getInitials(profile: ClientProfile) {
    const name = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

    return (
        name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'TC'
    );
}

function getClientName(profile: ClientProfile) {
    return (
        [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || 'TRAINR client'
    );
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: DEFAULT_TIMEZONE,
    });
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: DEFAULT_TIMEZONE,
    });
}

function formatCurrency(amount: number, currency: string) {
    return `${currency} ${new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)}`;
}

function getGoalLabel(goal: string) {
    return FITNESS_GOAL_LABELS[goal] ?? goal.replace(/_/g, ' ');
}

function getSnapshotPlanName(snapshot: Record<string, unknown>) {
    const directName = snapshot.name;

    if (typeof directName === 'string' && directName.trim()) {
        return directName;
    }

    const nestedPlan = snapshot.plan;

    if (
        nestedPlan &&
        typeof nestedPlan === 'object' &&
        'name' in nestedPlan &&
        typeof nestedPlan.name === 'string'
    ) {
        return nestedPlan.name;
    }

    return 'Workout programme';
}

function getStatusColour(
    status: string,
    colors: ReturnType<typeof useTrainrTheme>['colors'],
) {
    if (status === 'completed' || status === 'successful') {
        return colors.semantic.success;
    }

    if (status === 'pending' || status === 'active') {
        return colors.semantic.warning;
    }

    if (
        status === 'cancelled' ||
        status === 'declined' ||
        status === 'failed' ||
        status === 'revoked'
    ) {
        return colors.semantic.error;
    }

    return colors.text.secondary;
}

export default function ClientDetailScreen() {
    const { clientId } = useLocalSearchParams<{ clientId: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { colors, spacing } = useTrainrTheme();

    const [details, setDetails] = useState<ClientDetails | null>(null);
    const [activeTab, setActiveTab] = useState<ClientDetailTab>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [selectedSessionNote, setSelectedSessionNote] =
        useState<TrainerSessionNote | null>(null);
    const [isFeedbackSheetVisible, setIsFeedbackSheetVisible] = useState(false);
    const [editingFeedback, setEditingFeedback] =
        useState<TrainerFeedback | null>(null);
    const [selectedFeedbackAssignmentId, setSelectedFeedbackAssignmentId] =
        useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackRecommendations, setFeedbackRecommendations] = useState('');
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);

    const [publishedPlans, setPublishedPlans] = useState<WorkoutPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [selectedBookingId, setSelectedBookingId] = useState('');
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

    const loadClientDetails = useCallback(
        async (refresh = false) => {
            if (!user || !clientId) {
                setDetails(null);
                setErrorMessage('Your session or client information could not be found.');
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            }

            if (refresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            setErrorMessage(null);

            try {
                const [
                    { data: profileRow, error: profileError },
                    { data: goalRows, error: goalsError },
                    { data: bookingRows, error: bookingsError },
                    { data: paymentRows, error: paymentsError },
                    assignments,
                    fitnessProgress,
                    feedback,
                    sessionNotes,
                ] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('id, first_name, last_name')
                        .eq('id', clientId)
                        .maybeSingle(),

                    supabase
                        .from('gym_goer_fitness_goals')
                        .select('user_id, goal')
                        .eq('user_id', clientId),

                    supabase
                        .from('trainer_bookings')
                        .select(
                            'id, gym_goer_id, scheduled_start, scheduled_end, session_rate, currency, status, notes',
                        )
                        .eq('trainer_id', user.id)
                        .eq('gym_goer_id', clientId)
                        .order('scheduled_start', { ascending: false }),

                    supabase.rpc('get_trainer_client_payments', {
                        p_gym_goer_id: clientId,
                    }),

                    getClientWorkoutAssignments(clientId),
                    getClientFitnessProgress(clientId),
                    getTrainerFeedback(clientId),
                    getTrainerSessionNotes(clientId),
                ]);

                if (profileError) throw profileError;
                if (goalsError) throw goalsError;
                if (bookingsError) throw bookingsError;
                if (paymentsError) throw paymentsError;

                if (!profileRow) {
                    throw new Error('This client profile could not be found.');
                }

                const bookings = (bookingRows ?? []) as ClientBooking[];
                const payments = (paymentRows ?? []) as ClientPayment[];

                // The secure RPC returns only payments linked to bookings owned by
                // the authenticated trainer for this client. Keep this additional
                // client-side match as a defensive consistency check.
                const bookingIds = new Set(bookings.map((booking) => booking.id));

                const clientPayments = payments.filter((payment) =>
                    bookingIds.has(payment.booking_id),
                );

                setDetails({
                    profile: profileRow as ClientProfile,
                    goals: (goalRows ?? []) as FitnessGoal[],
                    bookings,
                    payments: clientPayments,
                    assignments,
                    fitnessProgress,
                    feedback,
                    sessionNotes,
                });
            } catch (error) {
                console.error('[Client Details] Unable to load client:', error);

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load this client. Please try again.',
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [user, clientId],
    );

    const loadPublishedPlans = useCallback(async () => {
        setIsLoadingPlans(true);
        setAssignmentError(null);

        try {
            const plans = await getPublishedWorkoutPlans();
            setPublishedPlans(plans);
        } catch (error) {
            console.error('[Client Details] Unable to load published plans:', error);

            setAssignmentError(
                error instanceof Error
                    ? error.message
                    : 'Unable to load published programmes.',
            );
        } finally {
            setIsLoadingPlans(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadClientDetails();
            void loadPublishedPlans();
        }, [loadClientDetails, loadPublishedPlans]),
    );

    const completedSessions =
        details?.bookings.filter((booking) => booking.status === 'completed')
            .length ?? 0;

    const activeAssignments =
        details?.assignments.filter((assignment) => assignment.status === 'active')
            .length ?? 0;

    const eligibleBookings =
        details?.bookings.filter((booking) => {
            if (
                booking.status !== 'confirmed' &&
                booking.status !== 'completed'
            ) {
                return false;
            }

            return details.payments.some(
                (payment) =>
                    payment.booking_id === booking.id &&
                    payment.status === 'successful' &&
                    Boolean(payment.paid_at),
            );
        }) ?? [];

    function getBookingPayment(bookingId: string) {
        return details?.payments.find(
            (payment) =>
                payment.booking_id === bookingId &&
                payment.status === 'successful' &&
                Boolean(payment.paid_at),
        );
    }

    const selectedPlan = publishedPlans.find((plan) => plan.id === selectedPlanId);
    const selectedBooking = eligibleBookings.find(
        (booking) => booking.id === selectedBookingId,
    );
    const selectedPayment = selectedBooking
        ? getBookingPayment(selectedBooking.id)
        : undefined;

    async function handleAssignWorkoutPlan() {
        if (!clientId || !selectedPlan || !selectedBooking || !selectedPayment) {
            setAssignmentError(
                'Select a published programme and an eligible paid booking.',
            );
            return;
        }

        const alreadyAssigned = details?.assignments.some(
            (assignment) =>
                assignment.workout_plan_id === selectedPlan.id &&
                assignment.status === 'active',
        );

        if (alreadyAssigned) {
            setAssignmentError(
                'This client already has an active assignment for this programme.',
            );
            return;
        }

        setIsAssigning(true);
        setAssignmentError(null);
        setAssignmentSuccess(null);

        try {
            const result = await assignWorkoutPlan({
                workoutPlanId: selectedPlan.id,
                gymGoerId: clientId,
                bookingId: selectedBooking.id,
                paymentId: selectedPayment.id,
            });

            setAssignmentSuccess(
                `${selectedPlan.name} (version ${result.plan_version}) was assigned successfully.`,
            );
            setSelectedPlanId('');
            setSelectedBookingId('');

            await loadClientDetails(true);
        } catch (error) {
            console.error('[Client Details] Unable to assign programme:', error);
            setAssignmentError(
                error instanceof Error
                    ? error.message
                    : 'Unable to assign this programme. Please try again.',
            );
        } finally {
            setIsAssigning(false);
        }
    }

    function openCreateFeedback() {
        setEditingFeedback(null);
        setSelectedFeedbackAssignmentId('');
        setFeedbackText('');
        setFeedbackRecommendations('');
        setFeedbackError(null);
        setIsFeedbackSheetVisible(true);
    }

    function openEditFeedback(item: TrainerFeedback) {
        setEditingFeedback(item);
        setSelectedFeedbackAssignmentId(
            item.assigned_workout_plan_id ?? '',
        );
        setFeedbackText(item.feedback);
        setFeedbackRecommendations(item.recommendations ?? '');
        setFeedbackError(null);
        setIsFeedbackSheetVisible(true);
    }

    function closeFeedbackSheet() {
        if (isSavingFeedback) return;

        setIsFeedbackSheetVisible(false);
        setEditingFeedback(null);
        setSelectedFeedbackAssignmentId('');
        setFeedbackText('');
        setFeedbackRecommendations('');
        setFeedbackError(null);
    }

    async function handleSaveFeedback() {
        if (!clientId || !details) {
            setFeedbackError('Client information could not be found.');
            return;
        }

        if (!feedbackText.trim()) {
            setFeedbackError('Please enter your feedback.');
            return;
        }

        if (!editingFeedback && !selectedFeedbackAssignmentId) {
            setFeedbackError('Please select an assigned programme.');
            return;
        }

        setIsSavingFeedback(true);
        setFeedbackError(null);

        try {
            if (editingFeedback) {
                await updateTrainerFeedback(editingFeedback.id, {
                    feedback: feedbackText.trim(),
                    recommendations: feedbackRecommendations.trim() || null,
                });
            } else {
                await createTrainerFeedback({
                    gymGoerId: clientId,
                    assignedWorkoutPlanId: selectedFeedbackAssignmentId,
                    feedback: feedbackText.trim(),
                    recommendations: feedbackRecommendations.trim() || null,
                });
            }

            setIsFeedbackSheetVisible(false);
            setEditingFeedback(null);
            setSelectedFeedbackAssignmentId('');
            setFeedbackText('');
            setFeedbackRecommendations('');

            await loadClientDetails(true);
        } catch (error) {
            console.error('[Client Details] Unable to save feedback:', error);

            setFeedbackError(
                error instanceof Error
                    ? error.message
                    : 'Unable to save feedback. Please try again.',
            );
        } finally {
            setIsSavingFeedback(false);
        }
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
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: 144,
                    gap: spacing.md,
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => void loadClientDetails(true)}
                        tintColor={colors.brand.red}
                    />
                }
            >
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to clients"
                    onPress={() => router.back()}
                    style={{
                        alignSelf: 'flex-start',
                        paddingVertical: spacing.sm,
                        paddingRight: spacing.md,
                    }}
                >
                    <AppText variant="button" color={colors.brand.red}>
                        ← Back to clients
                    </AppText>
                </Pressable>

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
                            Loading client details...
                        </AppText>
                    </View>
                )}

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
                            UNABLE TO LOAD CLIENT.
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
                            onPress={() => void loadClientDetails()}
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

                {!isLoading && !errorMessage && details && (
                    <>
                        {/* Client profile card */}
                        <View
                            style={{
                                padding: spacing.md,
                                borderRadius: 18,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                backgroundColor: colors.background.secondary,
                                gap: spacing.md,
                            }}
                        >
                            <AppText
                                variant="caption"
                                color={colors.brand.red}
                                style={{ letterSpacing: 1.5 }}
                            >
                                TRAINER WORKSPACE
                            </AppText>

                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.md,
                                }}
                            >
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: colors.brand.red,
                                    }}
                                >
                                    <AppText variant="h2" color="#FFFFFF">
                                        {getInitials(details.profile)}
                                    </AppText>
                                </View>

                                <View style={{ flex: 1, gap: spacing.xs }}>
                                    <AppText variant="h2" color={colors.text.primary}>
                                        {getClientName(details.profile)}
                                    </AppText>
                                    <AppText variant="bodySmall" color={colors.text.secondary}>
                                        TRAINR CLIENT
                                    </AppText>
                                </View>
                            </View>
                        </View>

                        {/* Independent summary cards */}
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <View
                                style={{
                                    flex: 1,
                                    minHeight: 104,
                                    padding: spacing.md,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    backgroundColor: colors.background.secondary,
                                    justifyContent: 'space-between',
                                    gap: spacing.sm,
                                }}
                            >
                                <AppText variant="caption" color={colors.text.secondary}>
                                    COMPLETED SESSIONS
                                </AppText>
                                <AppText variant="h1" color={colors.text.primary}>
                                    {completedSessions}
                                </AppText>
                            </View>

                            <View
                                style={{
                                    flex: 1,
                                    minHeight: 104,
                                    padding: spacing.md,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    backgroundColor: colors.background.secondary,
                                    justifyContent: 'space-between',
                                    gap: spacing.sm,
                                }}
                            >
                                <AppText variant="caption" color={colors.text.secondary}>
                                    ACTIVE PROGRAMMES
                                </AppText>
                                <AppText variant="h1" color={colors.brand.red}>
                                    {activeAssignments}
                                </AppText>
                            </View>
                        </View>

                        {/* Client detail tabs — individual filter-style pills */}
                        <View accessibilityRole="tablist">
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.sm,
                                    paddingVertical: spacing.xs,
                                }}
                            >
                                {([
                                    { key: 'overview', label: 'Overview' },
                                    { key: 'sessions', label: 'Sessions' },
                                    { key: 'payments', label: 'Payments' },
                                    { key: 'programmes', label: 'Programmes' },
                                    { key: 'fitness', label: 'Fitness Progress' },
                                    { key: 'feedback', label: 'Feedback' },
                                ] as const).map((tab) => {
                                    const selected = activeTab === tab.key;

                                    return (
                                        <Pressable
                                            key={tab.key}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected }}
                                            onPress={() => setActiveTab(tab.key)}
                                            style={{
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                paddingHorizontal: spacing.md,
                                                paddingVertical: spacing.sm,
                                                borderRadius: 999,
                                                borderWidth: selected ? 0 : 1,
                                                borderColor: colors.border.default,
                                                backgroundColor: selected
                                                    ? colors.brand.red
                                                    : 'transparent',
                                            }}
                                        >
                                            <AppText
                                                variant="bodySmall"
                                                color={selected ? '#FFFFFF' : colors.text.primary}
                                                style={{ fontWeight: '600' }}
                                            >
                                                {tab.label}
                                            </AppText>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Overview tab */}
                        {activeTab === 'overview' && (
                            <>
                                {/* Fitness goals */}
                                <View
                                    style={{
                                        padding: spacing.md,
                                        borderRadius: 18,
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                        backgroundColor: colors.background.secondary,
                                        gap: spacing.sm,
                                    }}
                                >
                                    <AppText variant="h3" color={colors.text.primary}>
                                        FITNESS GOALS
                                    </AppText>

                                    {details.goals.length === 0 ? (
                                        <AppText variant="body" color={colors.text.secondary}>
                                            This client hasn't added any fitness goals yet.
                                        </AppText>
                                    ) : (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                                            {details.goals.map((item, index) => (
                                                <View
                                                    key={`${item.goal}-${index}`}
                                                    style={{
                                                        paddingHorizontal: spacing.md,
                                                        paddingVertical: spacing.sm,
                                                        borderRadius: 999,
                                                        backgroundColor: colors.brand.redLight,
                                                    }}
                                                >
                                                    <AppText variant="bodySmall" color={colors.brand.red}>
                                                        {getGoalLabel(item.goal)}
                                                    </AppText>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                            </>
                        )}

                        {/* Sessions tab */}
                        {activeTab === 'sessions' && (
                            <View style={{ gap: spacing.md }}>
                                <AppText variant="h3" color={colors.text.primary}>
                                    SESSION HISTORY
                                </AppText>

                                {details.bookings.length === 0 ? (
                                    <View
                                        style={{
                                            padding: spacing.lg,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            backgroundColor: colors.background.secondary,
                                        }}
                                    >
                                        <AppText variant="body" color={colors.text.secondary}>
                                            No sessions have been booked with this client yet.
                                        </AppText>
                                    </View>
                                ) : (
                                    details.bookings.map((booking) => {
                                        const payment = getBookingPayment(booking.id);
                                        const sessionNote = details.sessionNotes.find(
                                            (note) => note.booking_id === booking.id,
                                        );

                                        return (
                                            <View
                                                key={booking.id}
                                                style={{
                                                    padding: spacing.md,
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border.default,
                                                    backgroundColor: colors.background.secondary,
                                                    gap: spacing.sm,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: spacing.sm,
                                                    }}
                                                >
                                                    <AppText variant="h3" color={colors.text.primary}>
                                                        {formatDate(booking.scheduled_start)}
                                                    </AppText>

                                                    <AppText
                                                        variant="caption"
                                                        color={getStatusColour(booking.status, colors)}
                                                    >
                                                        {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                                                    </AppText>
                                                </View>

                                                <AppText variant="bodySmall" color={colors.text.secondary}>
                                                    {formatDateTime(booking.scheduled_start)}
                                                </AppText>

                                                <AppText variant="bodySmall" color={colors.text.secondary}>
                                                    Session rate: {formatCurrency(booking.session_rate, booking.currency)}
                                                </AppText>

                                                <View
                                                    style={{
                                                        height: 1,
                                                        backgroundColor: colors.border.default,
                                                    }}
                                                />

                                                <AppText variant="caption" color={colors.text.secondary}>
                                                    PAYMENT
                                                </AppText>

                                                <AppText
                                                    variant="bodySmall"
                                                    color={
                                                        payment
                                                            ? colors.semantic.success
                                                            : colors.text.secondary
                                                    }
                                                >
                                                    {payment
                                                        ? `Paid · ${formatCurrency(payment.amount, payment.currency)}`
                                                        : 'No successful payment recorded'}
                                                </AppText>

                                                {sessionNote ? (
                                                    <Pressable
                                                        onPress={() => setSelectedSessionNote(sessionNote)}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="View private session notes"
                                                        style={{
                                                            padding: spacing.md,
                                                            borderRadius: 12,
                                                            borderWidth: 1,
                                                            borderColor: colors.border.default,
                                                            backgroundColor: colors.background.secondary,
                                                            gap: spacing.md,
                                                        }}
                                                    >
                                                        <View
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: spacing.sm,
                                                            }}
                                                        >
                                                            <AppText variant="body" color={colors.text.primary}>
                                                                Session notes
                                                            </AppText>

                                                            <AppText
                                                                variant="caption"
                                                                color={colors.semantic.success}
                                                            >
                                                                SAVED
                                                            </AppText>
                                                        </View>

                                                        <View
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: spacing.sm,
                                                            }}
                                                        >
                                                            <AppText
                                                                variant="caption"
                                                                color={colors.text.secondary}
                                                            >
                                                                Summary and recommendations
                                                            </AppText>

                                                            <AppText
                                                                variant="bodySmall"
                                                                color={colors.text.primary}
                                                            >
                                                                View →
                                                            </AppText>
                                                        </View>
                                                    </Pressable>
                                                ) : null}

                                                {booking.notes ? (
                                                    <AppText variant="bodySmall" color={colors.text.tertiary}>
                                                        {booking.notes}
                                                    </AppText>
                                                ) : null}

                                                {booking.status !== 'confirmed' &&
                                                    booking.status !== 'completed' ? null : (
                                                    <AppText variant="caption" color={colors.text.tertiary}>
                                                        {payment
                                                            ? 'Eligible booking and payment combination'
                                                            : 'A successful payment is required for programme assignment'}
                                                    </AppText>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}

                        {/* Payments tab */}
                        {activeTab === 'payments' && (
                            <View style={{ gap: spacing.md }}>
                                <AppText variant="h3" color={colors.text.primary}>
                                    PAYMENT HISTORY
                                </AppText>

                                {details.payments.length === 0 ? (
                                    <AppText variant="body" color={colors.text.secondary}>
                                        No payment records are available for this client's sessions.
                                    </AppText>
                                ) : (
                                    details.payments.map((payment) => (
                                        <View
                                            key={payment.id}
                                            style={{
                                                padding: spacing.md,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border.default,
                                                backgroundColor: colors.background.secondary,
                                                gap: spacing.sm,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: spacing.sm,
                                                }}
                                            >
                                                <AppText variant="h3" color={colors.text.primary}>
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </AppText>

                                                <AppText
                                                    variant="caption"
                                                    color={getStatusColour(payment.status, colors)}
                                                >
                                                    {payment.status.toUpperCase()}
                                                </AppText>
                                            </View>

                                            <AppText variant="bodySmall" color={colors.text.secondary}>
                                                {payment.provider} · {formatDateTime(payment.created_at)}
                                            </AppText>

                                            {payment.paid_at ? (
                                                <AppText variant="caption" color={colors.text.tertiary}>
                                                    Paid {formatDateTime(payment.paid_at)}
                                                </AppText>
                                            ) : null}

                                            {payment.provider_reference ? (
                                                <AppText variant="caption" color={colors.text.tertiary}>
                                                    Reference: {payment.provider_reference}
                                                </AppText>
                                            ) : null}
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* Programmes tab */}
                        {activeTab === 'programmes' && (
                            <View style={{ gap: spacing.md }}>
                                <AppText variant="h3" color={colors.text.primary}>
                                    ASSIGN A WORKOUT PROGRAMME
                                </AppText>

                                <AppText variant="bodySmall" color={colors.text.secondary}>
                                    Choose a published programme and a confirmed or completed booking with a successful payment.
                                </AppText>

                                {isLoadingPlans ? (
                                    <View style={{ alignItems: 'center', padding: spacing.lg }}>
                                        <ActivityIndicator color={colors.brand.red} />
                                        <AppText variant="bodySmall" color={colors.text.secondary}>
                                            Loading published programmes...
                                        </AppText>
                                    </View>
                                ) : publishedPlans.length === 0 ? (
                                    <View
                                        style={{
                                            padding: spacing.md,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            backgroundColor: colors.background.secondary,
                                            gap: spacing.xs,
                                        }}
                                    >
                                        <AppText variant="body" color={colors.text.secondary}>
                                            No published programmes are currently available.
                                        </AppText>
                                        <AppText variant="caption" color={colors.text.tertiary}>
                                            Publish a workout programme in the Workout Plan Builder before assigning it.
                                        </AppText>
                                    </View>
                                ) : (
                                    <View style={{ gap: spacing.sm }}>
                                        <AppText variant="caption" color={colors.text.secondary}>
                                            SELECT A PROGRAMME
                                        </AppText>
                                        {publishedPlans.map((plan) => {
                                            const isSelected = selectedPlanId === plan.id;
                                            const alreadyAssigned = details.assignments.some(
                                                (assignment) =>
                                                    assignment.workout_plan_id === plan.id &&
                                                    assignment.status === 'active',
                                            );

                                            return (
                                                <Pressable
                                                    key={plan.id}
                                                    accessibilityRole="button"
                                                    accessibilityState={{
                                                        selected: isSelected,
                                                        disabled: alreadyAssigned,
                                                    }}
                                                    disabled={alreadyAssigned || isAssigning}
                                                    onPress={() => {
                                                        setSelectedPlanId(plan.id);
                                                        setAssignmentError(null);
                                                        setAssignmentSuccess(null);
                                                    }}
                                                    style={{
                                                        padding: spacing.md,
                                                        borderRadius: 16,
                                                        borderWidth: isSelected ? 2 : 1,
                                                        borderColor: isSelected
                                                            ? colors.brand.red
                                                            : colors.border.default,
                                                        backgroundColor: colors.background.secondary,
                                                        gap: spacing.xs,
                                                        opacity: alreadyAssigned ? 0.55 : 1,
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: spacing.sm,
                                                        }}
                                                    >
                                                        <AppText variant="h3" color={colors.text.primary}>
                                                            {plan.name}
                                                        </AppText>
                                                        <AppText
                                                            variant="caption"
                                                            color={alreadyAssigned
                                                                ? colors.semantic.success
                                                                : isSelected
                                                                    ? colors.brand.red
                                                                    : colors.text.secondary}
                                                        >
                                                            {alreadyAssigned
                                                                ? 'Already assigned'
                                                                : isSelected
                                                                    ? 'Selected'
                                                                    : `Version ${plan.version}`}
                                                        </AppText>
                                                    </View>
                                                    {plan.description ? (
                                                        <AppText variant="bodySmall" color={colors.text.secondary}>
                                                            {plan.description}
                                                        </AppText>
                                                    ) : null}
                                                    <AppText variant="caption" color={colors.text.tertiary}>
                                                        Version {plan.version}
                                                        {plan.duration_weeks
                                                            ? ` · ${plan.duration_weeks} weeks`
                                                            : ''}
                                                    </AppText>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                )}

                                <View style={{ gap: spacing.sm }}>
                                    <AppText variant="caption" color={colors.text.secondary}>
                                        SELECT AN ELIGIBLE BOOKING
                                    </AppText>
                                    {eligibleBookings.length === 0 ? (
                                        <View
                                            style={{
                                                padding: spacing.md,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border.default,
                                                backgroundColor: colors.background.secondary,
                                            }}
                                        >
                                            <AppText variant="bodySmall" color={colors.text.secondary}>
                                                No confirmed or completed bookings with a successful payment are available.
                                            </AppText>
                                        </View>
                                    ) : (
                                        eligibleBookings.map((booking) => {
                                            const payment = getBookingPayment(booking.id);
                                            const isSelected = selectedBookingId === booking.id;

                                            return (
                                                <Pressable
                                                    key={booking.id}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: isSelected }}
                                                    disabled={isAssigning}
                                                    onPress={() => {
                                                        setSelectedBookingId(booking.id);
                                                        setAssignmentError(null);
                                                        setAssignmentSuccess(null);
                                                    }}
                                                    style={{
                                                        padding: spacing.md,
                                                        borderRadius: 16,
                                                        borderWidth: isSelected ? 2 : 1,
                                                        borderColor: isSelected
                                                            ? colors.brand.red
                                                            : colors.border.default,
                                                        backgroundColor: colors.background.secondary,
                                                        gap: spacing.xs,
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            flexDirection: 'row',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            gap: spacing.sm,
                                                        }}
                                                    >
                                                        <AppText variant="body" color={colors.text.primary}>
                                                            {formatDateTime(booking.scheduled_start)}
                                                        </AppText>
                                                        <AppText
                                                            variant="caption"
                                                            color={isSelected ? colors.brand.red : colors.semantic.success}
                                                        >
                                                            {isSelected ? 'Selected' : 'Eligible'}
                                                        </AppText>
                                                    </View>
                                                    {payment ? (
                                                        <AppText variant="bodySmall" color={colors.semantic.success}>
                                                            Paid · {formatCurrency(payment.amount, payment.currency)}
                                                        </AppText>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        })
                                    )}
                                </View>

                                {selectedPayment ? (
                                    <View
                                        style={{
                                            padding: spacing.md,
                                            borderRadius: 14,
                                            backgroundColor: colors.background.secondary,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            gap: spacing.xs,
                                        }}
                                    >
                                        <AppText variant="caption" color={colors.text.secondary}>
                                            PAYMENT TO BE USED
                                        </AppText>
                                        <AppText variant="bodySmall" color={colors.text.primary}>
                                            {formatCurrency(selectedPayment.amount, selectedPayment.currency)} · {selectedPayment.provider}
                                        </AppText>
                                        <AppText variant="caption" color={colors.text.tertiary}>
                                            Payment reference: {selectedPayment.provider_reference ?? 'Not provided'}
                                        </AppText>
                                    </View>
                                ) : null}

                                {assignmentError ? (
                                    <AppText variant="bodySmall" color={colors.semantic.error}>
                                        {assignmentError}
                                    </AppText>
                                ) : null}

                                {assignmentSuccess ? (
                                    <AppText variant="bodySmall" color={colors.semantic.success}>
                                        {assignmentSuccess}
                                    </AppText>
                                ) : null}

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        disabled: isAssigning || !selectedPlan || !selectedBooking || !selectedPayment,
                                    }}
                                    disabled={
                                        isAssigning ||
                                        isLoadingPlans ||
                                        !selectedPlan ||
                                        !selectedBooking ||
                                        !selectedPayment
                                    }
                                    onPress={() => void handleAssignWorkoutPlan()}
                                    style={{
                                        minHeight: 50,
                                        borderRadius: 14,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: colors.brand.red,
                                        opacity:
                                            isAssigning ||
                                                isLoadingPlans ||
                                                !selectedPlan ||
                                                !selectedBooking ||
                                                !selectedPayment
                                                ? 0.5
                                                : 1,
                                    }}
                                >
                                    {isAssigning ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <AppText variant="button" color="#FFFFFF">
                                            Assign programme
                                        </AppText>
                                    )}
                                </Pressable>

                                <View
                                    style={{
                                        height: 1,
                                        backgroundColor: colors.border.default,
                                        marginVertical: spacing.sm,
                                    }}
                                />

                                <AppText variant="h3" color={colors.text.primary}>
                                    ASSIGNED PROGRAMMES
                                </AppText>

                                {details.assignments.length === 0 ? (
                                    <View
                                        style={{
                                            padding: spacing.lg,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            backgroundColor: colors.background.secondary,
                                        }}
                                    >
                                        <AppText variant="body" color={colors.text.secondary}>
                                            No workout programmes have been assigned to this client.
                                        </AppText>
                                    </View>
                                ) : (
                                    details.assignments.map((assignment) => (
                                        <View
                                            key={assignment.id}
                                            style={{
                                                padding: spacing.md,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border.default,
                                                backgroundColor: colors.background.secondary,
                                                gap: spacing.sm,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: spacing.sm,
                                                }}
                                            >
                                                <View style={{ flex: 1, gap: spacing.xs }}>
                                                    <AppText variant="h3" color={colors.text.primary}>
                                                        {getSnapshotPlanName(assignment.plan_snapshot)}
                                                    </AppText>
                                                    <AppText variant="caption" color={colors.text.secondary}>
                                                        Version {assignment.plan_version}
                                                    </AppText>
                                                </View>
                                                <AppText
                                                    variant="caption"
                                                    color={getStatusColour(assignment.status, colors)}
                                                >
                                                    {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
                                                </AppText>
                                            </View>
                                            <AppText variant="bodySmall" color={colors.text.secondary}>
                                                Assigned {formatDate(assignment.assigned_at)}
                                            </AppText>
                                            {assignment.completed_at ? (
                                                <AppText variant="caption" color={colors.text.tertiary}>
                                                    Completed {formatDate(assignment.completed_at)}
                                                </AppText>
                                            ) : null}
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* Fitness Progress tab */}
                        {activeTab === 'fitness' && (
                            <View style={{ gap: spacing.md }}>
                                <AppText variant="h3" color={colors.text.primary}>
                                    FITNESS PROGRESS
                                </AppText>

                                {(() => {
                                    const measurements = [...details.fitnessProgress].sort(
                                        (a, b) =>
                                            new Date(b.recorded_at).getTime() -
                                            new Date(a.recorded_at).getTime(),
                                    );

                                    const weightRecords = measurements.filter(
                                        (item) => item.metric_type === 'body_weight',
                                    );

                                    const latestWeight = weightRecords[0];
                                    const previousWeight = weightRecords[1];

                                    const metricLabels: Record<string, string> = {
                                        body_weight: 'Body weight',
                                        body_fat: 'Body fat',
                                        waist: 'Waist',
                                        chest: 'Chest',
                                        hips: 'Hips',
                                        arm: 'Arm',
                                        thigh: 'Thigh',
                                    };

                                    return (
                                        <>
                                            <View
                                                style={{
                                                    padding: spacing.md,
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border.default,
                                                    backgroundColor: colors.background.secondary,
                                                    gap: spacing.sm,
                                                }}
                                            >
                                                <AppText variant="caption" color={colors.text.secondary}>
                                                    CURRENT BODY WEIGHT
                                                </AppText>

                                                {latestWeight ? (
                                                    <>
                                                        <AppText variant="h2" color={colors.text.primary}>
                                                            {latestWeight.value.toLocaleString('en-GB', {
                                                                maximumFractionDigits: 2,
                                                            })} {latestWeight.unit}
                                                        </AppText>

                                                        <AppText variant="caption" color={colors.text.tertiary}>
                                                            Recorded {formatDate(latestWeight.recorded_at)}
                                                        </AppText>

                                                        {previousWeight &&
                                                            previousWeight.unit === latestWeight.unit ? (
                                                            <AppText
                                                                variant="bodySmall"
                                                                color={colors.text.secondary}
                                                            >
                                                                {`${latestWeight.value - previousWeight.value > 0 ? '+' : ''}${(latestWeight.value - previousWeight.value).toFixed(2)} ${latestWeight.unit} since the previous measurement`}
                                                            </AppText>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <AppText variant="body" color={colors.text.secondary}>
                                                        No body weight measurements have been recorded.
                                                    </AppText>
                                                )}
                                            </View>

                                            <AppText variant="h3" color={colors.text.primary}>
                                                MEASUREMENT HISTORY
                                            </AppText>

                                            {measurements.length === 0 ? (
                                                <View
                                                    style={{
                                                        padding: spacing.lg,
                                                        borderRadius: 16,
                                                        borderWidth: 1,
                                                        borderColor: colors.border.default,
                                                        backgroundColor: colors.background.secondary,
                                                    }}
                                                >
                                                    <AppText variant="body" color={colors.text.secondary}>
                                                        This client hasn't recorded any fitness measurements yet.
                                                    </AppText>
                                                </View>
                                            ) : (
                                                measurements.map((item) => (
                                                    <View
                                                        key={item.id}
                                                        style={{
                                                            padding: spacing.md,
                                                            borderRadius: 16,
                                                            borderWidth: 1,
                                                            borderColor: colors.border.default,
                                                            backgroundColor: colors.background.secondary,
                                                            gap: spacing.xs,
                                                        }}
                                                    >
                                                        <View
                                                            style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                gap: spacing.sm,
                                                            }}
                                                        >
                                                            <AppText variant="body" color={colors.text.primary}>
                                                                {metricLabels[item.metric_type] ?? item.metric_type}
                                                            </AppText>

                                                            <AppText variant="body" color={colors.text.primary}>
                                                                {item.value.toLocaleString('en-GB', {
                                                                    maximumFractionDigits: 2,
                                                                })} {item.unit}
                                                            </AppText>
                                                        </View>

                                                        <AppText variant="caption" color={colors.text.tertiary}>
                                                            {formatDate(item.recorded_at)}
                                                        </AppText>

                                                        {item.notes ? (
                                                            <AppText variant="bodySmall" color={colors.text.secondary}>
                                                                {item.notes}
                                                            </AppText>
                                                        ) : null}
                                                    </View>
                                                ))
                                            )}
                                        </>
                                    );
                                })()}
                            </View>
                        )}

                        {/* Feedback tab */}
                        {activeTab === 'feedback' && (
                            <View style={{ gap: spacing.md }}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: spacing.md,
                                    }}
                                >
                                    <View style={{ flex: 1, gap: spacing.xs }}>
                                        <AppText variant="h3" color={colors.text.primary}>
                                            TRAINER FEEDBACK
                                        </AppText>
                                        <AppText variant="caption" color={colors.text.secondary}>
                                            Coaching observations and recommendations for this client.
                                        </AppText>
                                    </View>

                                    <Button
                                        size="small"
                                        onPress={openCreateFeedback}
                                        accessibilityLabel="Add feedback"
                                    >
                                        Add feedback
                                    </Button>
                                </View>

                                {details.feedback.length === 0 ? (
                                    <View
                                        style={{
                                            padding: spacing.lg,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            backgroundColor: colors.background.secondary,
                                            gap: spacing.sm,
                                        }}
                                    >
                                        <AppText variant="body" color={colors.text.secondary}>
                                            No feedback has been recorded for this client yet.
                                        </AppText>
                                        <AppText variant="caption" color={colors.text.tertiary}>
                                            Add feedback after reviewing an assigned programme or workout.
                                        </AppText>
                                        <Button
                                            variant="outline"
                                            fullWidth
                                            onPress={openCreateFeedback}
                                        >
                                            Create first feedback
                                        </Button>
                                    </View>
                                ) : (
                                    details.feedback.map((item) => {
                                        const assignment = item.assigned_workout_plan_id
                                            ? details.assignments.find(
                                                (entry) => entry.id === item.assigned_workout_plan_id,
                                            )
                                            : null;

                                        return (
                                            <View
                                                key={item.id}
                                                style={{
                                                    padding: spacing.md,
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border.default,
                                                    backgroundColor: colors.background.secondary,
                                                    gap: spacing.sm,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: spacing.sm,
                                                    }}
                                                >
                                                    <AppText variant="caption" color={colors.text.tertiary}>
                                                        {formatDateTime(item.created_at)}
                                                    </AppText>
                                                    <Button
                                                        size="small"
                                                        variant="outline"
                                                        onPress={() => openEditFeedback(item)}
                                                        accessibilityLabel="Edit feedback"
                                                    >
                                                        Edit
                                                    </Button>
                                                </View>

                                                {assignment ? (
                                                    <AppText variant="caption" color={colors.brand.red}>
                                                        {getSnapshotPlanName(assignment.plan_snapshot)}
                                                    </AppText>
                                                ) : item.workout_log_id ? (
                                                    <AppText variant="caption" color={colors.brand.red}>
                                                        Workout session
                                                    </AppText>
                                                ) : null}

                                                <AppText variant="body" color={colors.text.primary}>
                                                    {item.feedback}
                                                </AppText>

                                                {item.recommendations ? (
                                                    <View
                                                        style={{
                                                            borderTopWidth: 1,
                                                            borderTopColor: colors.border.default,
                                                            paddingTop: spacing.sm,
                                                            gap: spacing.xs,
                                                        }}
                                                    >
                                                        <AppText variant="caption" color={colors.text.secondary}>
                                                            RECOMMENDATIONS
                                                        </AppText>
                                                        <AppText variant="bodySmall" color={colors.text.secondary}>
                                                            {item.recommendations}
                                                        </AppText>
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}

                        {/* Assignment eligibility summary */}
                        {activeTab === 'overview' && (
                            <View
                                style={{
                                    padding: spacing.md,
                                    borderRadius: 18,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    backgroundColor: colors.background.secondary,
                                    gap: spacing.sm,
                                }}
                            >
                                <AppText variant="h3" color={colors.text.primary}>
                                    PROGRAMME ASSIGNMENT
                                </AppText>

                                <AppText variant="body" color={colors.text.secondary}>
                                    {eligibleBookings.length > 0
                                        ? `${eligibleBookings.length} booking${eligibleBookings.length === 1 ? '' : 's'} meet the initial booking and payment eligibility checks.`
                                        : 'No bookings currently meet the initial booking and payment eligibility checks.'}
                                </AppText>

                                <AppText variant="caption" color={colors.text.tertiary}>
                                    The Programmes tab lets you assign published plans using an eligible booking and successful payment. The server rechecks trainer, client, booking and payment eligibility before creating an assignment.
                                </AppText>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <BottomSheet
                visible={Boolean(selectedSessionNote)}
                onClose={() => setSelectedSessionNote(null)}
                title="Private session notes"
                subtitle={
                    selectedSessionNote && details
                        ? (() => {
                            const booking = details.bookings.find(
                                (item) => item.id === selectedSessionNote.booking_id,
                            );

                            return booking
                                ? formatDateTime(booking.scheduled_start)
                                : 'Historical coaching record';
                        })()
                        : undefined
                }
                maxHeight="85%"
            >
                {selectedSessionNote ? (
                    <View style={{ gap: spacing.lg }}>
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: spacing.md,
                                borderRadius: 12,
                                backgroundColor: colors.background.secondary,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                            }}
                        >
                            <View style={{ flex: 1, gap: spacing.xs }}>
                                <AppText variant="bodySmall" color={colors.text.primary}>
                                    PRIVATE TRAINER RECORD
                                </AppText>
                                <AppText variant="caption" color={colors.text.secondary}>
                                    Only authorised trainers can access these notes.
                                </AppText>
                            </View>
                            <AppText variant="caption" color={colors.semantic.success}>
                                SAVED
                            </AppText>
                        </View>

                        <View style={{ gap: spacing.sm }}>
                            <AppText variant="caption" color={colors.text.secondary}>
                                SESSION SUMMARY
                            </AppText>
                            <AppText variant="body" color={colors.text.primary}>
                                {selectedSessionNote.session_summary}
                            </AppText>
                        </View>

                        {selectedSessionNote.observations ? (
                            <View style={{ gap: spacing.sm }}>
                                <View
                                    style={{
                                        height: 1,
                                        backgroundColor: colors.border.default,
                                    }}
                                />
                                <AppText variant="caption" color={colors.text.secondary}>
                                    OBSERVATIONS
                                </AppText>
                                <AppText variant="body" color={colors.text.primary}>
                                    {selectedSessionNote.observations}
                                </AppText>
                            </View>
                        ) : null}

                        {selectedSessionNote.recommendations ? (
                            <View style={{ gap: spacing.sm }}>
                                <View
                                    style={{
                                        height: 1,
                                        backgroundColor: colors.border.default,
                                    }}
                                />
                                <AppText variant="caption" color={colors.text.secondary}>
                                    RECOMMENDATIONS
                                </AppText>
                                <AppText variant="body" color={colors.text.primary}>
                                    {selectedSessionNote.recommendations}
                                </AppText>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </BottomSheet>

            <BottomSheet
                visible={isFeedbackSheetVisible}
                onClose={closeFeedbackSheet}
                title={editingFeedback ? 'Edit feedback' : 'Add feedback'}
                subtitle={
                    editingFeedback
                        ? 'Update your coaching feedback for this client.'
                        : 'Record coaching feedback for an assigned programme.'
                }
                maxHeight="90%"
                footer={
                    <View style={{ gap: spacing.sm }}>
                        {feedbackError ? (
                            <AppText
                                variant="caption"
                                color={colors.semantic.error}
                            >
                                {feedbackError}
                            </AppText>
                        ) : null}

                        <Button
                            fullWidth
                            loading={isSavingFeedback}
                            disabled={isSavingFeedback}
                            onPress={() => void handleSaveFeedback()}
                        >
                            {editingFeedback ? 'Save changes' : 'Save feedback'}
                        </Button>

                        <Button
                            fullWidth
                            variant="outline"
                            disabled={isSavingFeedback}
                            onPress={closeFeedbackSheet}
                        >
                            Cancel
                        </Button>
                    </View>
                }
            >
                <View style={{ gap: spacing.lg }}>
                    {!editingFeedback ? (
                        <View style={{ gap: spacing.sm }}>
                            <AppText
                                variant="label"
                                color={colors.text.primary}
                            >
                                Assigned programme
                            </AppText>

                            {details?.assignments.some(
                                (assignment) =>
                                    assignment.status === 'active' ||
                                    assignment.status === 'completed',
                            ) ? (
                                details.assignments
                                    .filter(
                                        (assignment) =>
                                            assignment.status === 'active' ||
                                            assignment.status === 'completed',
                                    )
                                    .map((assignment) => {
                                        const isSelected =
                                            selectedFeedbackAssignmentId === assignment.id;

                                        return (
                                            <Pressable
                                                key={assignment.id}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: isSelected }}
                                                onPress={() => {
                                                    setSelectedFeedbackAssignmentId(assignment.id);
                                                    setFeedbackError(null);
                                                }}
                                                style={{
                                                    padding: spacing.md,
                                                    borderRadius: 12,
                                                    borderWidth: isSelected ? 2 : 1,
                                                    borderColor: isSelected
                                                        ? colors.brand.red
                                                        : colors.border.default,
                                                    backgroundColor: colors.background.secondary,
                                                    gap: spacing.xs,
                                                }}
                                            >
                                                <AppText
                                                    variant="body"
                                                    color={colors.text.primary}
                                                >
                                                    {getSnapshotPlanName(assignment.plan_snapshot)}
                                                </AppText>

                                                <AppText
                                                    variant="caption"
                                                    color={isSelected
                                                        ? colors.brand.red
                                                        : colors.text.secondary}
                                                >
                                                    {isSelected
                                                        ? 'Selected'
                                                        : `${ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status} · Select programme`}
                                                </AppText>
                                            </Pressable>
                                        );
                                    })
                            ) : (
                                <View
                                    style={{
                                        padding: spacing.md,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                        backgroundColor: colors.background.secondary,
                                        gap: spacing.xs,
                                    }}
                                >
                                    <AppText
                                        variant="bodySmall"
                                        color={colors.text.secondary}
                                    >
                                        No active or completed assigned programmes are available.
                                    </AppText>
                                    <AppText
                                        variant="caption"
                                        color={colors.text.tertiary}
                                    >
                                        Assign a programme before creating programme feedback.
                                    </AppText>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View
                            style={{
                                padding: spacing.md,
                                borderRadius: 12,
                                backgroundColor: colors.background.secondary,
                                gap: spacing.xs,
                            }}
                        >
                            <AppText
                                variant="caption"
                                color={colors.text.secondary}
                            >
                                LINKED PROGRAMME
                            </AppText>
                            <AppText
                                variant="body"
                                color={colors.text.primary}
                            >
                                {editingFeedback.assigned_workout_plan_id
                                    ? (() => {
                                        const assignment = details?.assignments.find(
                                            (item) =>
                                                item.id === editingFeedback.assigned_workout_plan_id,
                                        );

                                        return assignment
                                            ? getSnapshotPlanName(assignment.plan_snapshot)
                                            : 'Previously assigned programme';
                                    })()
                                    : editingFeedback.workout_log_id
                                        ? 'Workout session'
                                        : 'Existing feedback record'}
                            </AppText>
                            <AppText
                                variant="caption"
                                color={colors.text.tertiary}
                            >
                                The original workout or programme association will be preserved.
                            </AppText>
                        </View>
                    )}

                    <Input
                        label="Feedback"
                        placeholder="Write your feedback for this client..."
                        value={feedbackText}
                        onChangeText={(value) => {
                            setFeedbackText(value);
                            setFeedbackError(null);
                        }}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                        style={{
                            minHeight: 120,
                            paddingTop: spacing.md,
                        }}
                    />

                    <Input
                        label="Recommendations (optional)"
                        placeholder="Add recommendations or next steps..."
                        value={feedbackRecommendations}
                        onChangeText={setFeedbackRecommendations}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        style={{
                            minHeight: 100,
                            paddingTop: spacing.md,
                        }}
                    />
                </View>
            </BottomSheet>
        </SafeAreaView>
    );
}
