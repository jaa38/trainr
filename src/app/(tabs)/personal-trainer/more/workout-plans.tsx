
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import {
    createWorkoutPlan,
    getWorkoutPlans,
    type WorkoutPlan,
    type WorkoutPlanStatus,
} from '@/services/workout-plans';
import { useTrainrTheme } from '@/theme';

type PlanFilter = 'all' | 'draft' | 'published';

export default function WorkoutPlansScreen() {
    const router = useRouter();
    const { colors, spacing } = useTrainrTheme();

    const [plans, setPlans] = useState<WorkoutPlan[]>([]);
    const [filter, setFilter] = useState<PlanFilter>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [createVisible, setCreateVisible] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [objectives, setObjectives] = useState('');
    const [duration, setDuration] = useState('4');

    const loadPlans = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const result = await getWorkoutPlans();
            setPlans(result);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load workout plans.',
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadPlans();
    }, [loadPlans]);

    const filteredPlans = useMemo(() => {
        if (filter === 'all') {
            return plans;
        }

        return plans.filter((plan) => plan.status === filter);
    }, [plans, filter]);

    const publishedCount = plans.filter(
        (plan) => plan.status === 'published',
    ).length;

    const draftCount = plans.filter(
        (plan) => plan.status === 'draft',
    ).length;

    const handleCreatePlan = async () => {
        const trimmedName = name.trim();
        const parsedDuration = duration.trim()
            ? Number(duration)
            : null;

        if (!trimmedName) {
            setError('Please enter a workout plan name.');
            return;
        }

        if (
            parsedDuration !== null &&
            (!Number.isInteger(parsedDuration) || parsedDuration < 1)
        ) {
            setError('Duration must be a positive number of weeks.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await createWorkoutPlan({
                name: trimmedName,
                description,
                objectives,
                duration_weeks: parsedDuration,
            });

            setCreateVisible(false);
            setName('');
            setDescription('');
            setObjectives('');
            setDuration('4');

            await loadPlans();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to create workout plan.',
            );
        } finally {
            setSaving(false);
        }
    };

    const getStatusTone = (
        status: WorkoutPlanStatus,
    ): 'neutral' | 'success' | 'warning' => {
        if (status === 'published') return 'success';
        if (status === 'draft') return 'warning';
        return 'neutral';
    };

    const filters: { label: string; value: PlanFilter }[] = [
        { label: 'All plans', value: 'all' },
        { label: 'Drafts', value: 'draft' },
        { label: 'Published', value: 'published' },
    ];

    const renderField = (
        label: string,
        value: string,
        onChangeText: (value: string) => void,
        placeholder: string,
        multiline = false,
        keyboardType?: 'default' | 'numeric',
    ) => (
        <View style={{ gap: spacing.sm }}>
            <AppText variant="label" color={colors.text.primary}>
                {label}
            </AppText>

            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.text.tertiary}
                multiline={multiline}
                keyboardType={keyboardType ?? 'default'}
                textAlignVertical={multiline ? 'top' : 'center'}
                style={{
                    minHeight: multiline ? 90 : 52,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                    fontSize: 14,
                }}
            />
        </View>
    );

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
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => void loadPlans(true)}
                        tintColor={colors.brand.red}
                    />
                }
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: spacing.huge + spacing.huge + spacing.lg,
                    gap: spacing.xl,
                }}
            >
                {/* Header */}
                <View style={{ gap: spacing.md }}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        onPress={() => router.back()}
                        style={{ alignSelf: 'flex-start' }}
                    >
                        <AppText variant="h3" color={colors.text.secondary}>
                            ← Back
                        </AppText>
                    </Pressable>

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: spacing.md,
                        }}
                    >
                        <View style={{ flex: 1, gap: spacing.xs }}>
                            <AppText variant="caption" color={colors.brand.red}>
                                TRAINER WORKSPACE
                            </AppText>

                            <AppText
                                variant="displayLarge"
                                color={colors.text.primary}
                            >
                                WORKOUT PLANS.
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
                                {plans.length}
                            </AppText>
                        </View>
                    </View>

                    <AppText variant="body" color={colors.text.secondary}>
                        Create personalised training programmes and organise
                        your clients' workouts.
                    </AppText>

                    <Button
                        fullWidth
                        onPress={() => {
                            setError(null);
                            setCreateVisible(true);
                        }}
                        leftIcon={<AppText color="#FFFFFF">＋</AppText>}
                    >
                        Create workout plan
                    </Button>
                </View>

                {/* Overview */}
                <View style={{ gap: spacing.md }}>
                    <AppText variant="h3" color={colors.text.primary}>
                        PLAN OVERVIEW
                    </AppText>

                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        {[
                            {
                                label: 'TOTAL PLANS',
                                value: plans.length,
                            },
                            {
                                label: 'PUBLISHED',
                                value: publishedCount,
                            },
                            {
                                label: 'DRAFTS',
                                value: draftCount,
                            },
                        ].map((item) => (
                            <View
                                key={item.label}
                                style={{
                                    flex: 1,
                                    padding: spacing.md,
                                    borderRadius: 14,
                                    backgroundColor: colors.background.secondary,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    gap: spacing.sm,
                                }}
                            >
                                <AppText
                                    variant="h2"
                                    color={colors.text.primary}
                                >
                                    {item.value}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    color={colors.text.secondary}
                                >
                                    {item.label}
                                </AppText>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Filters */}
                <View style={{ gap: spacing.md }}>
                    <AppText variant="h3" color={colors.text.primary}>
                        YOUR PROGRAMMES
                    </AppText>

                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: spacing.sm,
                        }}
                    >
                        {filters.map((item) => {
                            const selected = filter === item.value;

                            return (
                                <Pressable
                                    key={item.value}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    onPress={() => setFilter(item.value)}
                                    style={{
                                        paddingHorizontal: spacing.md,
                                        paddingVertical: spacing.sm,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: selected
                                            ? colors.brand.red
                                            : colors.border.default,
                                        backgroundColor: selected
                                            ? colors.brand.redLight
                                            : colors.background.secondary,
                                    }}
                                >
                                    <AppText
                                        variant="caption"
                                        color={
                                            selected
                                                ? colors.brand.red
                                                : colors.text.secondary
                                        }
                                    >
                                        {item.label}
                                    </AppText>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Loading */}
                {loading ? (
                    <Card variant="outlined">
                        <View
                            style={{
                                paddingVertical: spacing.xl,
                                alignItems: 'center',
                                gap: spacing.md,
                            }}
                        >
                            <AppText
                                variant="body"
                                color={colors.text.secondary}
                            >
                                Loading workout plans...
                            </AppText>
                        </View>
                    </Card>
                ) : null}

                {/* Error */}
                {!loading && error && !createVisible ? (
                    <Card variant="outlined">
                        <View style={{ gap: spacing.md }}>
                            <AppText variant="h3" color={colors.error}>
                                Unable to load workout plans
                            </AppText>

                            <AppText variant="body" color={colors.text.secondary}>
                                {error}
                            </AppText>

                            <Button
                                variant="outline"
                                onPress={() => void loadPlans()}
                            >
                                Try again
                            </Button>
                        </View>
                    </Card>
                ) : null}

                {/* Empty state */}
                {!loading && !error && filteredPlans.length === 0 ? (
                    <Card variant="outlined">
                        <View
                            style={{
                                paddingVertical: spacing.xl,
                                alignItems: 'center',
                                gap: spacing.md,
                            }}
                        >
                            <AppText variant="h2" color={colors.text.primary}>
                                {plans.length === 0
                                    ? 'Your programmes start here.'
                                    : 'No plans in this category.'}
                            </AppText>

                            <AppText
                                variant="body"
                                color={colors.text.secondary}
                                align="center"
                            >
                                {plans.length === 0
                                    ? 'Build your first personalised workout programme for your clients.'
                                    : 'Try another filter to see your workout plans.'}
                            </AppText>

                            {plans.length === 0 ? (
                                <Button onPress={() => setCreateVisible(true)}>
                                    Create your first plan
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    onPress={() => setFilter('all')}
                                >
                                    View all plans
                                </Button>
                            )}
                        </View>
                    </Card>
                ) : null}

                {/* Plan cards */}
                {!loading &&
                    filteredPlans.map((plan) => {
                        const exerciseCount =
                            plan.workout_plan_exercises?.length ?? 0;

                        return (
                            <Card
                                key={plan.id}
                                variant="interactive"
                                onPress={() =>
                                    router.push({
                                        pathname:
                                            '/(tabs)/personal-trainer/more/workout-plan-builder',
                                        params: { planId: plan.id },
                                    })
                                }
                                accessibilityLabel={`Open workout plan ${plan.name}`}
                                style={{ gap: spacing.md }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: spacing.md,
                                    }}
                                >
                                    <View style={{ flex: 1, gap: spacing.xs }}>
                                        <AppText
                                            variant="h3"
                                            color={colors.text.primary}
                                        >
                                            {plan.name}
                                        </AppText>

                                        <AppText
                                            variant="caption"
                                            color={colors.text.tertiary}
                                        >
                                            Version {plan.version}
                                        </AppText>
                                    </View>

                                    <Badge tone={getStatusTone(plan.status)}>
                                        {plan.status.toUpperCase()}
                                    </Badge>
                                </View>

                                {plan.description ? (
                                    <AppText
                                        variant="body"
                                        color={colors.text.secondary}
                                    >
                                        {plan.description}
                                    </AppText>
                                ) : null}

                                <View
                                    style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: spacing.lg,
                                    }}
                                >
                                    <View style={{ gap: spacing.xs }}>
                                        <AppText
                                            variant="caption"
                                            color={colors.text.tertiary}
                                        >
                                            EXERCISES
                                        </AppText>
                                        <AppText
                                            variant="body"
                                            color={colors.text.primary}
                                        >
                                            {exerciseCount}
                                        </AppText>
                                    </View>

                                    <View style={{ gap: spacing.xs }}>
                                        <AppText
                                            variant="caption"
                                            color={colors.text.tertiary}
                                        >
                                            DURATION
                                        </AppText>
                                        <AppText
                                            variant="body"
                                            color={colors.text.primary}
                                        >
                                            {plan.duration_weeks
                                                ? `${plan.duration_weeks} weeks`
                                                : 'Not set'}
                                        </AppText>
                                    </View>

                                    <View style={{ gap: spacing.xs }}>
                                        <AppText
                                            variant="caption"
                                            color={colors.text.tertiary}
                                        >
                                            LAST UPDATED
                                        </AppText>
                                        <AppText
                                            variant="body"
                                            color={colors.text.primary}
                                        >
                                            {new Date(plan.updated_at).toLocaleDateString()}
                                        </AppText>
                                    </View>
                                </View>

                                {plan.objectives ? (
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
                                            TRAINING OBJECTIVES
                                        </AppText>

                                        <AppText
                                            variant="body"
                                            color={colors.text.primary}
                                        >
                                            {plan.objectives}
                                        </AppText>
                                    </View>
                                ) : null}

                                <AppText
                                    variant="caption"
                                    color={colors.text.tertiary}
                                >
                                    {exerciseCount === 0
                                        ? 'No exercises added yet'
                                        : `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} in this programme`}
                                </AppText>
                            </Card>
                        );
                    })}
            </ScrollView>

            {/* Create workout plan */}
            <BottomSheet
                visible={createVisible}
                onClose={() => {
                    if (!saving) {
                        setCreateVisible(false);
                        setError(null);
                    }
                }}
                title="Create workout plan"
                subtitle="Start building a personalised training programme."
                scrollable
                footer={
                    <View style={{ gap: spacing.sm }}>
                        {error ? (
                            <AppText variant="caption" color={colors.error}>
                                {error}
                            </AppText>
                        ) : null}

                        <Button
                            fullWidth
                            loading={saving}
                            disabled={!name.trim()}
                            onPress={() => void handleCreatePlan()}
                        >
                            Create draft plan
                        </Button>

                        <Button
                            fullWidth
                            variant="ghost"
                            disabled={saving}
                            onPress={() => {
                                setCreateVisible(false);
                                setError(null);
                            }}
                        >
                            Cancel
                        </Button>
                    </View>
                }
            >
                <View style={{ gap: spacing.lg }}>
                    {renderField(
                        'PLAN NAME',
                        name,
                        setName,
                        'e.g. Beginner Strength Programme',
                    )}

                    {renderField(
                        'DESCRIPTION',
                        description,
                        setDescription,
                        'Describe this training programme...',
                        true,
                    )}

                    {renderField(
                        'TRAINING OBJECTIVES',
                        objectives,
                        setObjectives,
                        'e.g. Build strength and improve endurance...',
                        true,
                    )}

                    {renderField(
                        'DURATION (WEEKS)',
                        duration,
                        setDuration,
                        '4',
                        false,
                        'numeric',
                    )}
                </View>
            </BottomSheet>
        </SafeAreaView>
    );
}
