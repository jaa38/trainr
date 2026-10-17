import { Filter } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useTrainrTheme } from '@/theme';

export const TRAINER_SPECIALTIES = [
  'Strength training',
  'Weight loss',
  'Muscle building',
  'General fitness',
  'Functional training',
  'Sports performance',
  'Mobility and flexibility',
  'Nutrition coaching',
] as const;

export type TrainerSpecialty = (typeof TRAINER_SPECIALTIES)[number];

type TrainerSpecialtyFiltersProps = {
  selectedSpecialties: TrainerSpecialty[];
  onToggleSpecialty: (specialty: TrainerSpecialty) => void;
  onClearSpecialties: () => void;
};

export function TrainerSpecialtyFilters({
  selectedSpecialties,
  onToggleSpecialty,
  onClearSpecialties,
}: TrainerSpecialtyFiltersProps) {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;
  const [visible, setVisible] = React.useState(false);

  const hasSelectedSpecialties = selectedSpecialties.length > 0;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter trainers by expertise"
        accessibilityHint="Opens trainer specialty filters"
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
          borderColor: hasSelectedSpecialties ? colors.brand.red : colors.border.default,
          backgroundColor: colors.surface.default,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Filter
          size={20}
          color={hasSelectedSpecialties ? colors.brand.red : colors.text.primary}
          strokeWidth={2}
        />
      </Pressable>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="Filter trainers"
        subtitle="Choose one or more areas of expertise."
        maxHeight="90%"
      >
        <View style={{ gap: spacing.md }}>
          {TRAINER_SPECIALTIES.map((specialty) => {
            const isSelected = selectedSpecialties.includes(specialty);

            return (
              <Pressable
                key={specialty}
                accessibilityRole="checkbox"
                accessibilityLabel={specialty}
                accessibilityState={{ checked: isSelected }}
                onPress={() => onToggleSpecialty(specialty)}
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
                    {specialty}
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
              <Button variant="outline" fullWidth onPress={onClearSpecialties}>
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
