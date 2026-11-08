
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    TextInput,
    View,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import {
    createExercise,
    deleteExercise,
    getExercises,
    updateExercise,
    type Exercise,
    type ExerciseInput,
} from '@/services/exercises';
import { useTrainrTheme } from '@/theme';

type ExerciseFilter = 'All' | 'Shared' | 'My Exercises';

type ExerciseForm = {
    name: string;
    description: string;
    muscle_group: string;
    category: string;
    equipment: string;
    instructions: string;
    image_url: string;
    video_url: string;
};

const filters: ExerciseFilter[] = ['All', 'Shared', 'My Exercises'];

const emptyForm: ExerciseForm = {
    name: '',
    description: '',
    muscle_group: '',
    category: '',
    equipment: '',
    instructions: '',
    image_url: '',
    video_url: '',
};

export default function ExerciseLibraryScreen() {
    const router = useRouter();
    const { colors, spacing } = useTrainrTheme();
    const { user } = useAuth();

    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<ExerciseFilter>('All');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [formVisible, setFormVisible] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [form, setForm] = useState<ExerciseForm>(emptyForm);

    const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);

    const hasActiveFilters = search.trim().length > 0 || activeFilter !== 'All';

    const loadExercises = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const result = await getExercises();
            setExercises(result);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to load your exercise library.',
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadExercises();
    }, [loadExercises]);

    const filteredExercises = useMemo(() => {
        const query = search.trim().toLowerCase();

        return exercises.filter((exercise) => {
            const isOwned = exercise.created_by === user?.id;

            const matchesFilter =
                activeFilter === 'All' ||
                (activeFilter === 'Shared' && exercise.created_by === null) ||
                (activeFilter === 'My Exercises' && isOwned);

            const searchableContent = [
                exercise.name,
                exercise.description,
                exercise.muscle_group,
                exercise.category,
                ...(exercise.equipment ?? []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesFilter && searchableContent.includes(query);
        });
    }, [exercises, search, activeFilter, user?.id]);

    const sharedCount = exercises.filter(
        (exercise) => exercise.created_by === null,
    ).length;

    const personalCount = exercises.filter(
        (exercise) => exercise.created_by === user?.id,
    ).length;

    function openCreateForm() {
        setEditingExercise(null);
        setForm(emptyForm);
        setFormError(null);
        setFormVisible(true);
    }

    function openEditForm(exercise: Exercise) {
        setEditingExercise(exercise);

        setForm({
            name: exercise.name,
            description: exercise.description ?? '',
            muscle_group: exercise.muscle_group ?? '',
            category: exercise.category ?? '',
            equipment: (exercise.equipment ?? []).join(', '),
            instructions: exercise.instructions ?? '',
            image_url: exercise.image_url ?? '',
            video_url: exercise.video_url ?? '',
        });

        setFormError(null);
        setFormVisible(true);
    }

    function updateFormField<K extends keyof ExerciseForm>(
        field: K,
        value: ExerciseForm[K],
    ) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function handleSaveExercise() {
        if (isSaving) return;

        const trimmedName = form.name.trim();

        if (!trimmedName) {
            setFormError('Enter an exercise name to continue.');
            return;
        }

        const input: ExerciseInput = {
            name: trimmedName,
            description: form.description,
            muscle_group: form.muscle_group,
            category: form.category,
            equipment: form.equipment
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            instructions: form.instructions,
            image_url: form.image_url,
            video_url: form.video_url,
        };

        setIsSaving(true);
        setFormError(null);

        try {
            if (editingExercise) {
                const updated = await updateExercise(editingExercise.id, input);

                setExercises((current) =>
                    current.map((exercise) =>
                        exercise.id === updated.id ? updated : exercise,
                    ),
                );
            } else {
                const created = await createExercise(input);

                setExercises((current) =>
                    [...current, created].sort((a, b) =>
                        a.name.localeCompare(b.name),
                    ),
                );
            }

            setFormVisible(false);
            setEditingExercise(null);
            setForm(emptyForm);
        } catch (error) {
            setFormError(
                error instanceof Error
                    ? error.message
                    : 'Unable to save this exercise. Please try again.',
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteExercise() {
        if (!exerciseToDelete || isDeleting) return;

        setIsDeleting(true);

        try {
            await deleteExercise(exerciseToDelete.id);

            setExercises((current) =>
                current.filter((exercise) => exercise.id !== exerciseToDelete.id),
            );

            setExerciseToDelete(null);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to delete this exercise.',
            );

            setExerciseToDelete(null);
        } finally {
            setIsDeleting(false);
        }
    }

    function clearFilters() {
        setSearch('');
        setActiveFilter('All');
    }

    const inputStyle = {
        minHeight: 50,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.background.secondary,
        color: colors.text.primary,
        fontSize: 15,
    } as const;

    function renderFormField(
        label: string,
        field: keyof ExerciseForm,
        placeholder: string,
        multiline = false,
    ) {
        return (
            <View style={{ gap: spacing.xs }}>
                <AppText variant="button" color={colors.text.primary}>
                    {label}
                </AppText>

                <TextInput
                    value={form[field]}
                    onChangeText={(value) => updateFormField(field, value)}
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.tertiary}
                    accessibilityLabel={label}
                    multiline={multiline}
                    textAlignVertical={multiline ? 'top' : 'center'}
                    autoCapitalize={
                        field === 'image_url' || field === 'video_url'
                            ? 'none'
                            : 'sentences'
                    }
                    style={{
                        ...inputStyle,
                        minHeight: multiline ? 110 : 50,
                        textAlignVertical: multiline ? 'top' : 'center',
                    }}
                />
            </View>
        );
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
                    paddingHorizontal: spacing.lg,
                    paddingTop: spacing.lg,
                    paddingBottom: spacing.huge + spacing.huge + spacing.lg,
                    gap: spacing.lg,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
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
                            alignItems: 'center',
                            gap: spacing.md,
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
                                EXERCISE LIBRARY.
                            </AppText>

                            <AppText variant="body" color={colors.text.secondary}>
                                Your movements. Your training knowledge.
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
                                {exercises.length}
                            </AppText>
                        </View>
                    </View>
                </View>

                {/* Overview */}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View
                        style={{
                            flex: 1,
                            padding: spacing.md,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                        }}
                    >
                        <AppText variant="caption" color={colors.text.secondary}>
                            SHARED EXERCISES
                        </AppText>

                        <AppText variant="displayLarge" color={colors.text.primary}>
                            {sharedCount}
                        </AppText>
                    </View>

                    <View
                        style={{
                            flex: 1,
                            padding: spacing.md,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                        }}
                    >
                        <AppText variant="caption" color={colors.text.secondary}>
                            YOUR EXERCISES
                        </AppText>

                        <AppText variant="displayLarge" color={colors.brand.red}>
                            {personalCount}
                        </AppText>
                    </View>
                </View>

                {/* Create action */}
                <Button
                    variant="primary"
                    fullWidth
                    onPress={openCreateForm}
                >
                    + Add exercise
                </Button>

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
                        placeholder="Exercise, muscle or equipment"
                        placeholderTextColor={colors.text.tertiary}
                        accessibilityLabel="Search exercises"
                        returnKeyType="search"
                        autoCapitalize="none"
                        style={{
                            flex: 1,
                            marginLeft: spacing.md,
                            paddingVertical: spacing.sm,
                            color: colors.text.primary,
                            fontSize: 15,
                        }}
                    />

                    {search.length > 0 ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Clear exercise search"
                            onPress={() => setSearch('')}
                            hitSlop={8}
                        >
                            <AppText variant="button" color={colors.brand.red}>
                                Clear
                            </AppText>
                        </Pressable>
                    ) : null}
                </View>

                {/* Filters */}
                <View style={{ gap: spacing.md }}>
                    <AppText variant="h3" color={colors.text.primary}>
                        EXERCISES
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

                {/* Error state */}
                {errorMessage ? (
                    <View
                        accessibilityRole="alert"
                        style={{
                            padding: spacing.md,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.error,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.md,
                        }}
                    >
                        <AppText variant="bodySmall" color={colors.error}>
                            {errorMessage}
                        </AppText>

                        <Button
                            variant="outline"
                            size="small"
                            onPress={loadExercises}
                        >
                            Try again
                        </Button>
                    </View>
                ) : null}

                {/* Exercise list */}
                {isLoading ? (
                    <View style={{ alignItems: 'center', padding: spacing.xl }}>
                        <AppText variant="body" color={colors.text.secondary}>
                            Loading exercises...
                        </AppText>
                    </View>
                ) : filteredExercises.length > 0 ? (
                    <View style={{ gap: spacing.md }}>
                        {filteredExercises.map((exercise) => {
                            const isOwned = exercise.created_by === user?.id;

                            const exerciseCard = (
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
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            gap: spacing.md,
                                        }}
                                    >
                                        <View style={{ flex: 1, gap: spacing.xs }}>
                                            <AppText variant="h3" color={colors.text.primary}>
                                                {exercise.name}
                                            </AppText>

                                            <AppText
                                                variant="bodySmall"
                                                color={colors.text.secondary}
                                            >
                                                {exercise.muscle_group ||
                                                    'Muscle group not specified'}
                                            </AppText>
                                        </View>

                                        <View
                                            style={{
                                                paddingHorizontal: spacing.sm,
                                                paddingVertical: spacing.xs,
                                                borderRadius: 8,
                                                backgroundColor: isOwned
                                                    ? colors.brand.redLight
                                                    : colors.background.primary,
                                                borderWidth: 1,
                                                borderColor: isOwned
                                                    ? colors.brand.red
                                                    : colors.border.default,
                                            }}
                                        >
                                            <AppText
                                                variant="caption"
                                                color={
                                                    isOwned
                                                        ? colors.brand.red
                                                        : colors.text.secondary
                                                }
                                            >
                                                {isOwned ? 'MY EXERCISE' : 'SHARED'}
                                            </AppText>
                                        </View>
                                    </View>

                                    {exercise.description ? (
                                        <AppText
                                            variant="bodySmall"
                                            color={colors.text.secondary}
                                        >
                                            {exercise.description}
                                        </AppText>
                                    ) : null}

                                    <View
                                        style={{
                                            height: 1,
                                            backgroundColor: colors.border.default,
                                        }}
                                    />

                                    <View style={{ gap: spacing.sm }}>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: spacing.sm,
                                            }}
                                        >
                                            <View style={{ flex: 1, gap: spacing.xs }}>
                                                <AppText
                                                    variant="caption"
                                                    color={colors.text.tertiary}
                                                >
                                                    CATEGORY
                                                </AppText>

                                                <AppText
                                                    variant="bodySmall"
                                                    color={colors.text.primary}
                                                >
                                                    {exercise.category || 'Not specified'}
                                                </AppText>
                                            </View>

                                            <View style={{ flex: 1, gap: spacing.xs }}>
                                                <AppText
                                                    variant="caption"
                                                    color={colors.text.tertiary}
                                                >
                                                    EQUIPMENT
                                                </AppText>

                                                <AppText
                                                    variant="bodySmall"
                                                    color={colors.text.primary}
                                                >
                                                    {exercise.equipment?.length
                                                        ? exercise.equipment.join(', ')
                                                        : 'No equipment'}
                                                </AppText>
                                            </View>
                                        </View>

                                        {exercise.instructions ? (
                                            <View style={{ gap: spacing.xs }}>
                                                <AppText
                                                    variant="caption"
                                                    color={colors.text.tertiary}
                                                >
                                                    INSTRUCTIONS
                                                </AppText>

                                                <AppText
                                                    variant="bodySmall"
                                                    color={colors.text.secondary}
                                                >
                                                    {exercise.instructions}
                                                </AppText>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                            );

                            if (!isOwned) {
                                return (
                                    <View key={exercise.id}>
                                        {exerciseCard}
                                    </View>
                                );
                            }

                            return (
                                <ReanimatedSwipeable
                                    key={exercise.id}
                                    friction={2}
                                    rightThreshold={40}
                                    overshootRight={false}
                                    containerStyle={{
                                        borderRadius: 18,
                                    }}
                                    renderRightActions={(
                                        _progress,
                                        _translation,
                                        swipeableMethods,
                                    ) => (
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'stretch',
                                                marginLeft: spacing.sm,
                                                gap: spacing.xs,
                                            }}
                                        >
                                            <Pressable
                                                accessibilityRole="button"
                                                accessibilityLabel={`Edit ${exercise.name}`}
                                                onPress={() => {
                                                    swipeableMethods.close();
                                                    openEditForm(exercise);
                                                }}
                                                style={{
                                                    width: 76,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 14,
                                                    backgroundColor: colors.background.secondary,
                                                    borderWidth: 1,
                                                    borderColor: colors.border.default,
                                                    gap: spacing.xs,
                                                }}
                                            >
                                                <AppText variant="h3" color={colors.text.primary}>
                                                    ✎
                                                </AppText>

                                                <AppText
                                                    variant="caption"
                                                    color={colors.text.primary}
                                                >
                                                    Edit
                                                </AppText>
                                            </Pressable>

                                            <Pressable
                                                accessibilityRole="button"
                                                accessibilityLabel={`Delete ${exercise.name}`}
                                                onPress={() => {
                                                    swipeableMethods.close();
                                                    setExerciseToDelete(exercise);
                                                }}
                                                style={{
                                                    width: 76,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 14,
                                                    backgroundColor: colors.error,
                                                    gap: spacing.xs,
                                                }}
                                            >
                                                <AppText variant="h3" color="#FFFFFF">
                                                    ×
                                                </AppText>

                                                <AppText
                                                    variant="caption"
                                                    color="#FFFFFF"
                                                >
                                                    Delete
                                                </AppText>
                                            </Pressable>
                                        </View>
                                    )}
                                >
                                    {exerciseCard}
                                </ReanimatedSwipeable>
                            );
                        })}
                    </View>
                ) : (
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
                            {hasActiveFilters
                                ? 'NO EXERCISES FOUND.'
                                : 'YOUR LIBRARY IS EMPTY.'}
                        </AppText>

                        <AppText
                            variant="body"
                            color={colors.text.secondary}
                            style={{ textAlign: 'center' }}
                        >
                            {hasActiveFilters
                                ? 'Try another search term or select a different filter.'
                                : 'Create your first exercise to start building your training library.'}
                        </AppText>

                        {hasActiveFilters ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={clearFilters}
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
                        ) : null}
                    </View>
                )}

                <AppText
                    variant="caption"
                    color={colors.text.tertiary}
                    style={{ textAlign: 'center' }}
                >
                    TRAINR · YOUR EXERCISE COLLECTION
                </AppText>
            </ScrollView>

            {/* Create / Edit Exercise */}
            <BottomSheet
                visible={formVisible}
                onClose={() => {
                    if (!isSaving) {
                        setFormVisible(false);
                        setFormError(null);
                    }
                }}
                title={editingExercise ? 'EDIT EXERCISE' : 'ADD EXERCISE'}
                subtitle="Build your exercise collection with clear training information."
                footer={
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                            <Button
                                variant="outline"
                                fullWidth
                                disabled={isSaving}
                                onPress={() => setFormVisible(false)}
                            >
                                Cancel
                            </Button>
                        </View>

                        <View style={{ flex: 1 }}>
                            <Button
                                variant="primary"
                                fullWidth
                                loading={isSaving}
                                onPress={handleSaveExercise}
                            >
                                {editingExercise ? 'Save changes' : 'Create exercise'}
                            </Button>
                        </View>
                    </View>
                }
            >
                {renderFormField('EXERCISE NAME *', 'name', 'e.g. Barbell squat')}

                {renderFormField(
                    'DESCRIPTION',
                    'description',
                    'Brief exercise description',
                    true,
                )}

                {renderFormField('MUSCLE GROUP', 'muscle_group', 'e.g. Quadriceps')}

                {renderFormField('CATEGORY', 'category', 'e.g. Strength training')}

                {renderFormField('EQUIPMENT', 'equipment', 'e.g. Barbell, Bench')}

                {renderFormField(
                    'INSTRUCTIONS',
                    'instructions',
                    'Explain how to perform the exercise',
                    true,
                )}

                {renderFormField('IMAGE URL', 'image_url', 'https://...')}

                {renderFormField('VIDEO URL', 'video_url', 'https://...')}

                <AppText variant="caption" color={colors.text.tertiary}>
                    Separate multiple equipment items with commas.
                </AppText>

                {formError ? (
                    <AppText
                        variant="bodySmall"
                        color={colors.error}
                        accessibilityRole="alert"
                    >
                        {formError}
                    </AppText>
                ) : null}
            </BottomSheet>

            {/* Delete confirmation */}
            <BottomSheet
                visible={exerciseToDelete !== null}
                onClose={() => {
                    if (!isDeleting) {
                        setExerciseToDelete(null);
                    }
                }}
                title="DELETE EXERCISE?"
                subtitle="This action cannot be undone."
                scrollable={false}
                footer={
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                            <Button
                                variant="outline"
                                fullWidth
                                disabled={isDeleting}
                                onPress={() => setExerciseToDelete(null)}
                            >
                                Cancel
                            </Button>
                        </View>

                        <View style={{ flex: 1 }}>
                            <Button
                                variant="destructive"
                                fullWidth
                                loading={isDeleting}
                                onPress={handleDeleteExercise}
                            >
                                Delete
                            </Button>
                        </View>
                    </View>
                }
            >
                <AppText variant="body" color={colors.text.secondary}>
                    Are you sure you want to delete{' '}
                    <AppText variant="body" color={colors.text.primary}>
                        {exerciseToDelete?.name}
                    </AppText>
                    ? It will be removed from your exercise library.
                </AppText>
            </BottomSheet>
        </SafeAreaView>
    );
}
