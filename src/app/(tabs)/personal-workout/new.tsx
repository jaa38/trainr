import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { createPersonalWorkout } from '@/services/personal-workouts';
import { useTrainrTheme } from '@/theme';
import type { PersonalWorkoutCategory } from '@/types/personal-workouts';

const CATEGORIES: { label: string; value: PersonalWorkoutCategory }[] = [
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Flexibility', value: 'flexibility' },
  { label: 'Functional', value: 'functional' },
  { label: 'Custom', value: 'custom' },
];

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function NewPersonalWorkoutScreen() {
  const { colors, spacing, radius } = useTrainrTheme();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PersonalWorkoutCategory>('strength');
  const [workoutDate, setWorkoutDate] = useState(getTodayDate);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate(status: 'draft' | 'in_progress') {
    if (isSaving) return;

    if (!name.trim()) {
      setErrorMessage('Enter a workout name to continue.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
      setErrorMessage('Enter the date in YYYY-MM-DD format.');
      return;
    }

    const [year, month, day] = workoutDate.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      setErrorMessage('Enter a valid workout date.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const workout = await createPersonalWorkout({
        workout_name: name.trim(),
        workout_type: category,
        workout_date: workoutDate,
        notes: notes.trim() || null,
        status,
      });

      router.replace({
        pathname: '/(tabs)/personal-workout/[id]',
        params: { id: workout.id },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create your workout. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <View style={{ gap: spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <AppText variant="bodyMedium" color={colors.text.primary}>
            Back
          </AppText>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.brand.red} weight="700">
            PERSONAL WORKOUTS
          </AppText>
          <AppText variant="h1" color={colors.text.primary}>
            New workout
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Set up your session before adding exercises and recording your sets.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            label="Workout name"
            placeholder="e.g. Upper body strength"
            value={name}
            onChangeText={setName}
            maxLength={120}
            returnKeyType="next"
          />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" color={colors.text.primary}>
              Workout category
            </AppText>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CATEGORIES.map((item) => {
                const selected = category === item.value;

                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(item.value)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand.red : colors.border.default,
                      backgroundColor: selected
                        ? colors.brand.redLight
                        : colors.surface.default,
                    }}
                  >
                    <AppText
                      variant="bodySmall"
                      color={selected ? colors.brand.red : colors.text.secondary}
                      weight={selected ? '700' : '500'}
                    >
                      {item.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Workout date"
            placeholder="YYYY-MM-DD"
            value={workoutDate}
            onChangeText={setWorkoutDate}
            helperText="Use the format YYYY-MM-DD."
            autoCapitalize="none"
          />

          <Input
            label="Notes (optional)"
            placeholder="Add a goal or anything you want to remember about this session..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
            style={{ minHeight: 110, paddingTop: spacing.md }}
          />
        </View>

        {errorMessage ? (
          <AppText variant="bodySmall" color={colors.text.error}>
            {errorMessage}
          </AppText>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            fullWidth
            size="large"
            loading={isSaving}
            disabled={isSaving}
            accessibilityLabel="Start workout"
            onPress={() => void handleCreate('in_progress')}
          >
            Start workout
          </Button>

          <Button
            fullWidth
            variant="outline"
            size="large"
            disabled={isSaving}
            accessibilityLabel="Save as draft"
            onPress={() => void handleCreate('draft')}
          >
            Save as draft
          </Button>
        </View>
      </View>
    </Screen>
  );
}
