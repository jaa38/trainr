import { Filter } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useTrainrTheme } from '@/theme';

export const FITNESS_GOALS = [
  { id: 'build_muscle', label: 'Build muscle' },
  { id: 'lose_weight', label: 'Lose weight' },
  { id: 'improve_fitness', label: 'Improve fitness' },
  { id: 'increase_strength', label: 'Increase strength' },
  { id: 'improve_endurance', label: 'Improve endurance' },
  { id: 'improve_health', label: 'Improve general health' },
  { id: 'sports_performance', label: 'Improve sports performance' },
] as const;

export type FitnessGoal = (typeof FITNESS_GOALS)[number]['id'];

type FitnessGoalFiltersProps = {
  selectedGoals: FitnessGoal[];
  onToggleGoal: (goal: FitnessGoal) => void;
  onClearGoals: () => void;
};

export function FitnessGoalFilters({
  selectedGoals,
  onToggleGoal,
  onClearGoals,
}: FitnessGoalFiltersProps) {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;
  const [visible, setVisible] = React.useState(false);

  const hasSelectedGoals = selectedGoals.length > 0;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter trainers by fitness goal"
        accessibilityHint="Opens fitness goal filters"
        accessibilityState={{ expanded: visible }}
        onPress={() => setVisible(true)}
        hitSlop={4}
        style={({ pressed }) => ({
          width: theme.sizes.inputHeight,
          height: theme.sizes.inputHeight,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: hasSelectedGoals ? colors.brand.red : colors.border.default,
          backgroundColor: colors.surface.default,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Filter
          size={20}
          color={hasSelectedGoals ? colors.brand.red : colors.text.primary}
          strokeWidth={2}
        />
      </Pressable>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="Fitness goals"
        subtitle="Choose one or more goals to find relevant trainers."
      >
        <View style={{ gap: spacing.md }}>
          {FITNESS_GOALS.map((goal) => {
            const isSelected = selectedGoals.includes(goal.id);

            return (
              <Pressable
                key={goal.id}
                accessibilityRole="checkbox"
                accessibilityLabel={goal.label}
                accessibilityState={{ checked: isSelected }}
                onPress={() => onToggleGoal(goal.id)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.brand.red : colors.border.default,
                  backgroundColor: isSelected
                    ? colors.brand.redLight
                    : colors.surface.default,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.brand.red : colors.border.default,
                    backgroundColor: isSelected ? colors.brand.red : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.md,
                  }}
                >
                  {isSelected ? (
                    <AppText variant="caption" color="#FFFFFF">
                      ✓
                    </AppText>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <AppText variant="body" color={colors.text.primary}>
                    {goal.label}
                  </AppText>
                </View>
              </Pressable>
            );
          })}

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginTop: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button variant="outline" fullWidth onPress={onClearGoals}>
                Clear all
              </Button>
            </View>

            <View style={{ flex: 1 }}>
              <Button variant="primary" fullWidth onPress={() => setVisible(false)}>
                Show trainers
              </Button>
            </View>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
