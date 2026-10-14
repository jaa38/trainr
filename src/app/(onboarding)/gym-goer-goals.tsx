import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

const fitnessGoals = [
  {
    id: 'build_muscle',
    title: 'Build muscle',
    description: 'Develop strength and muscle mass.',
  },
  {
    id: 'lose_weight',
    title: 'Lose weight',
    description: 'Work towards a healthier body composition.',
  },
  {
    id: 'improve_fitness',
    title: 'Improve fitness',
    description: 'Build stamina, endurance and overall fitness.',
  },
  {
    id: 'increase_strength',
    title: 'Increase strength',
    description: 'Get stronger and improve performance.',
  },
  {
    id: 'improve_endurance',
    title: 'Improve endurance',
    description: 'Build stamina and sustain physical activity for longer.',
  },
  {
    id: 'improve_health',
    title: 'Improve general health',
    description: 'Build sustainable, healthy habits.',
  },
  {
    id: 'sports_performance',
    title: 'Improve sports performance',
    description: 'Train for your sport and move more effectively.',
  },
] as const;

export default function GymGoerGoalsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleGoal(goalId: string) {
    if (isSaving) return;

    setSelectedGoals((current) =>
      current.includes(goalId)
        ? current.filter((goal) => goal !== goalId)
        : [...current, goalId],
    );
  }

  async function handleContinue() {
    if (!user || isSaving || selectedGoals.length === 0) {
      if (!user) {
        setErrorMessage('Your session could not be found. Please sign in again.');
      }
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Replace the user's existing selections with the current selections.
      const { error: deleteError } = await supabase
        .from('gym_goer_fitness_goals')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      const { error: insertError } = await supabase.from('gym_goer_fitness_goals').insert(
        selectedGoals.map((goal) => ({
          user_id: user.id,
          goal,
        })),
      );

      if (insertError) {
        throw insertError;
      }

      // Continue to the next step after the goals have been saved.
      router.push('/(onboarding)/gym-goer-preferences');
    } catch (error) {
      console.error('[Gym-Goer Onboarding] Failed to save fitness goals:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your fitness goals. Please try again.',
      );
    } finally {
      setIsSaving(false);
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
          flexGrow: 1,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" color={colors.brand.red}>
          GYM-GOER SETUP · STEP 3 OF 4
        </AppText>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h1" color={colors.text.primary}>
            Define your goals.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            What would you like to achieve? Choose all that apply.
          </AppText>
        </View>

        {fitnessGoals.map((goal) => {
          const selected = selectedGoals.includes(goal.id);

          return (
            <Pressable
              key={goal.id}
              accessibilityRole="checkbox"
              accessibilityLabel={goal.title}
              accessibilityHint={goal.description}
              accessibilityState={{
                checked: selected,
                disabled: isSaving,
              }}
              disabled={isSaving}
              onPress={() => toggleGoal(goal.id)}
              style={({ pressed }) => ({
                padding: spacing.lg,
                gap: spacing.xs,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? colors.brand.red : colors.border.default,
                backgroundColor: selected
                  ? colors.background.secondary
                  : colors.background.primary,
                opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
              })}
            >
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
                    {goal.title}
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    {goal.description}
                  </AppText>
                </View>

                <AppText
                  variant="h3"
                  color={selected ? colors.brand.red : colors.text.tertiary}
                >
                  {selected ? '✓' : '+'}
                </AppText>
              </View>
            </Pressable>
          );
        })}

        <AppText variant="caption" color={colors.text.secondary}>
          {selectedGoals.length} goal
          {selectedGoals.length === 1 ? '' : 's'} selected
        </AppText>

        {errorMessage ? (
          <AppText
            variant="bodySmall"
            color={colors.text.error}
            accessibilityRole="alert"
          >
            {errorMessage}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: selectedGoals.length === 0 || isSaving,
            busy: isSaving,
          }}
          disabled={selectedGoals.length === 0 || isSaving}
          onPress={handleContinue}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: colors.brand.red,
            opacity: selectedGoals.length === 0 || isSaving ? 0.45 : pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="buttonLarge" color="#FFFFFF">
            {isSaving ? 'SAVING…' : 'CONTINUE →'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
