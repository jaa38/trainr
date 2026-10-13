import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type WorkoutCategory = 'All' | 'Strength' | 'Cardio' | 'Mobility';

const categories: WorkoutCategory[] = ['All', 'Strength', 'Cardio', 'Mobility'];

const workouts = [
  {
    id: '1',
    title: 'Upper Body Strength',
    category: 'Strength',
    description: 'Chest, back, shoulders and arms.',
    duration: '45 min',
    level: 'Intermediate',
  },
  {
    id: '2',
    title: 'Full Body Conditioning',
    category: 'Cardio',
    description: 'Build stamina and improve endurance.',
    duration: '30 min',
    level: 'Beginner',
  },
  {
    id: '3',
    title: 'Mobility & Recovery',
    category: 'Mobility',
    description: 'Improve movement and flexibility.',
    duration: '20 min',
    level: 'All levels',
  },
] as const;

export default function WorkoutsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);

  const filteredWorkouts = workouts.filter(
    (workout) => selectedCategory === 'All' || workout.category === selectedCategory,
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            YOUR TRAINING
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            WORKOUTS.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Train with purpose. Build consistency. Track your progress.
          </AppText>
        </View>

        <View
          style={{
            padding: spacing.lg,
            borderRadius: 18,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.default,
            gap: spacing.sm,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            YOUR TRAINING PLAN
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Your assigned plan and personalised exercises will appear here when connected
            to your trainer.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <AppText variant="h2" color={colors.text.primary}>
            EXPLORE WORKOUTS
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {categories.map((category) => {
                const selected = selectedCategory === category;

                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedCategory(category)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand.red : colors.border.default,
                      backgroundColor: selected
                        ? colors.brand.red
                        : colors.background.primary,
                    }}
                  >
                    <AppText
                      variant="button"
                      color={selected ? '#FFFFFF' : colors.text.secondary}
                    >
                      {category}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {filteredWorkouts.map((workout) => {
          const expanded = selectedWorkout === workout.id;

          return (
            <View
              key={workout.id}
              style={{
                padding: spacing.lg,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.background.secondary,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.brand.red,
                }}
              />

              <AppText variant="h3" color={colors.text.primary}>
                {workout.title}
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                {workout.description}
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                }}
              >
                <AppText variant="caption" color={colors.text.tertiary}>
                  {workout.duration}
                </AppText>
                <AppText variant="caption" color={colors.text.tertiary}>
                  {workout.level}
                </AppText>
              </View>

              {expanded && (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  This is a sample workout. Exercise instructions and workout tracking
                  will be added in a future iteration.
                </AppText>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setSelectedWorkout(expanded ? null : workout.id)}
                style={{
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 12,
                  backgroundColor: colors.brand.red,
                }}
              >
                <AppText variant="button" color="#FFFFFF">
                  {expanded ? 'Show less' : 'View workout'}
                </AppText>
              </Pressable>
            </View>
          );
        })}

        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{ textAlign: 'center' }}
        >
          SAMPLE WORKOUTS — NOT A PERSONAL PRESCRIPTION
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
