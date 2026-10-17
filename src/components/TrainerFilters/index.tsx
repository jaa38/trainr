import { SlidersHorizontal } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import {
  TRAINER_SPECIALTIES,
  type TrainerSpecialty,
} from '@/components/TrainerSpecialtyFilters';
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

type TrainerFiltersProps = {
  selectedSpecialties: TrainerSpecialty[];
  selectedGoals: FitnessGoal[];
  onToggleSpecialty: (specialty: TrainerSpecialty) => void;
  onToggleGoal: (goal: FitnessGoal) => void;
  onClearAll: () => void;
};

export function TrainerFilters({
  selectedSpecialties,
  selectedGoals,
  onToggleSpecialty,
  onToggleGoal,
  onClearAll,
}: TrainerFiltersProps) {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;
  const [visible, setVisible] = React.useState(false);

  const activeFilterCount = selectedSpecialties.length + selectedGoals.length;

  function renderOption(label: string, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        key={label}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected ? colors.brand.redLight : colors.surface.default,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            borderWidth: 1.5,
            borderColor: selected ? colors.brand.red : colors.border.default,
            backgroundColor: selected ? colors.brand.red : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          {selected ? (
            <AppText variant="caption" color="#FFFFFF">
              ✓
            </AppText>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <AppText variant="body" color={colors.text.primary}>
            {label}
          </AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          activeFilterCount > 0
            ? `Filter trainers, ${activeFilterCount} selections active`
            : 'Filter trainers'
        }
        accessibilityHint="Opens fitness goal and trainer specialty filters"
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
          borderColor: activeFilterCount > 0 ? colors.brand.red : colors.border.default,
          backgroundColor:
            activeFilterCount > 0 ? colors.brand.redLight : colors.surface.default,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SlidersHorizontal
          size={20}
          color={activeFilterCount > 0 ? colors.brand.red : colors.text.primary}
          strokeWidth={2}
        />

        {activeFilterCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand.red,
            }}
          >
            <AppText variant="caption" color="#FFFFFF">
              {activeFilterCount}
            </AppText>
          </View>
        ) : null}
      </Pressable>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="Filter trainers"
        subtitle="Choose your goals and areas of expertise."
        maxHeight="90%"
        footer={
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              paddingBottom: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button variant="outline" fullWidth onPress={onClearAll}>
                Clear all
              </Button>
            </View>

            <View style={{ flex: 1 }}>
              <Button variant="primary" fullWidth onPress={() => setVisible(false)}>
                Show trainers
              </Button>
            </View>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Fitness goals
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Choose what you want to achieve.
            </AppText>
          </View>

          {FITNESS_GOALS.map((goal) =>
            renderOption(goal.label, selectedGoals.includes(goal.id), () =>
              onToggleGoal(goal.id),
            ),
          )}

          <View
            style={{
              height: 1,
              backgroundColor: colors.border.default,
              marginVertical: spacing.sm,
            }}
          />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Areas of expertise
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Choose the expertise you want in a trainer.
            </AppText>
          </View>

          {TRAINER_SPECIALTIES.map((specialty) =>
            renderOption(specialty, selectedSpecialties.includes(specialty), () =>
              onToggleSpecialty(specialty as TrainerSpecialty),
            ),
          )}
        </View>
      </BottomSheet>
    </>
  );
}
