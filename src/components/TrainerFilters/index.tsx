import { CalendarDays, MapPin, SlidersHorizontal, Wallet } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

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

export const TRAINING_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type TrainingDay = (typeof TRAINING_DAYS)[number];
export type FitnessGoal = (typeof FITNESS_GOALS)[number]['id'];

type TrainerFiltersProps = {
  selectedSpecialties: TrainerSpecialty[];
  selectedGoals: FitnessGoal[];
  locations: string[];
  selectedLocation: string | null;
  selectedDay: TrainingDay | null;
  minimumPrice: string;
  maximumPrice: string;
  availableCurrencies: string[];
  selectedCurrency: string | null;
  showMainFilterButton?: boolean;
  mainFilterButtonOnly?: boolean;
  onMinimumPriceChange: (value: string) => void;
  onMaximumPriceChange: (value: string) => void;
  onSelectCurrency: (currency: string | null) => void;
  onToggleSpecialty: (specialty: TrainerSpecialty) => void;
  onToggleGoal: (goal: FitnessGoal) => void;
  onSelectLocation: (location: string | null) => void;
  onSelectDay: (day: TrainingDay | null) => void;
  onClearPrice: () => void;
  onClearAll: () => void;
};

export function TrainerFilters({
  showMainFilterButton = true,
  mainFilterButtonOnly = false,
  selectedSpecialties,
  selectedGoals,
  locations,
  selectedLocation,
  selectedDay,
  minimumPrice,
  maximumPrice,
  availableCurrencies,
  selectedCurrency,
  onMinimumPriceChange,
  onMaximumPriceChange,
  onSelectCurrency,
  onToggleSpecialty,
  onToggleGoal,
  onSelectLocation,
  onSelectDay,
  onClearPrice,
  onClearAll,
}: TrainerFiltersProps) {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;

  const [visible, setVisible] = React.useState(false);
  const [locationSheetVisible, setLocationSheetVisible] = React.useState(false);
  const [priceSheetVisible, setPriceSheetVisible] = React.useState(false);
  const [availabilitySheetVisible, setAvailabilitySheetVisible] = React.useState(false);

  const hasPriceFilter = minimumPrice.trim() !== '' || maximumPrice.trim() !== '';

  const activeFilterCount =
    selectedSpecialties.length +
    selectedGoals.length +
    (selectedLocation ? 1 : 0) +
    (selectedDay ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);

  const minimum = minimumPrice.trim() === '' ? null : Number(minimumPrice);
  const maximum = maximumPrice.trim() === '' ? null : Number(maximumPrice);

  const priceError =
    (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) ||
    (maximum !== null && (!Number.isFinite(maximum) || maximum < 0))
      ? 'Enter valid, non-negative prices.'
      : minimum !== null && maximum !== null && minimum > maximum
        ? 'Minimum price cannot exceed maximum price.'
        : null;

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

  function renderPriceInput(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    accessibilityLabel: string,
  ) {
    return (
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="bodySmall" color={colors.text.secondary}>
          {label}
        </AppText>

        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          onChangeText={(text) => {
            if (/^\d*\.?\d{0,2}$/.test(text)) {
              onChangeText(text);
            }
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
          style={{
            minHeight: theme.sizes.inputHeight,
            paddingHorizontal: spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.surface.default,
            color: colors.text.primary,
            fontSize: 16,
          }}
        />
      </View>
    );
  }

  const filterButtonStyle = (active: boolean) => ({
    minHeight: theme.sizes.inputHeight,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: active ? colors.brand.red : colors.border.default,
    backgroundColor: active ? colors.brand.redLight : colors.surface.default,
  });

  return (
    <>
      {/* Horizontally scrollable discovery filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
          paddingRight: spacing.xs,
        }}
      >
        {showMainFilterButton ? (
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
            style={({ pressed }) => ({
              width: theme.sizes.inputHeight,
              height: theme.sizes.inputHeight,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor:
                activeFilterCount > 0 ? colors.brand.red : colors.border.default,
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
        ) : null}

        {!mainFilterButtonOnly ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedLocation
                  ? `Location: ${selectedLocation}`
                  : 'Filter trainers by location'
              }
              accessibilityHint="Opens available trainer locations"
              accessibilityState={{ expanded: locationSheetVisible }}
              onPress={() => setLocationSheetVisible(true)}
              style={({ pressed }) => ({
                ...filterButtonStyle(Boolean(selectedLocation)),
                maxWidth: 200,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MapPin
                size={18}
                color={selectedLocation ? colors.brand.red : colors.text.primary}
              />
              <AppText
                variant="bodySmall"
                color={selectedLocation ? colors.brand.red : colors.text.primary}
                numberOfLines={1}
              >
                {selectedLocation ?? 'Location'}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedDay
                  ? `Availability: ${selectedDay}`
                  : 'Filter trainers by availability'
              }
              accessibilityHint="Choose a day when you want to train"
              accessibilityState={{ expanded: availabilitySheetVisible }}
              onPress={() => setAvailabilitySheetVisible(true)}
              style={({ pressed }) => ({
                ...filterButtonStyle(Boolean(selectedDay)),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <CalendarDays
                size={17}
                color={selectedDay ? colors.brand.red : colors.text.primary}
              />
              <AppText
                variant="bodySmall"
                color={selectedDay ? colors.brand.red : colors.text.primary}
              >
                {selectedDay ?? 'Day'}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter trainers by price"
              accessibilityHint="Opens minimum and maximum session price filters"
              accessibilityState={{ expanded: priceSheetVisible }}
              onPress={() => setPriceSheetVisible(true)}
              style={({ pressed }) => ({
                ...filterButtonStyle(hasPriceFilter),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Wallet
                size={18}
                color={hasPriceFilter ? colors.brand.red : colors.text.primary}
                strokeWidth={2}
              />

              <AppText
                variant="bodySmall"
                color={hasPriceFilter ? colors.brand.red : colors.text.primary}
              >
                Price
              </AppText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {/* Fitness goal and specialty filters */}
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

      {/* Location selection bottom sheet */}
      <BottomSheet
        visible={locationSheetVisible}
        onClose={() => setLocationSheetVisible(false)}
        title="Trainer location"
        subtitle="Choose a location where published trainers are available."
        maxHeight="75%"
        footer={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            {selectedLocation ? (
              <Button
                variant="outline"
                fullWidth
                onPress={() => {
                  onSelectLocation(null);
                  setLocationSheetVisible(false);
                }}
              >
                Clear location
              </Button>
            ) : null}

            <Button
              variant="primary"
              fullWidth
              onPress={() => setLocationSheetVisible(false)}
            >
              Done
            </Button>
          </View>
        }
      >
        <View style={{ gap: spacing.sm }}>
          {locations.length > 0 ? (
            locations.map((location) => {
              const selected = selectedLocation === location;

              return (
                <Pressable
                  key={location}
                  accessibilityRole="radio"
                  accessibilityLabel={location}
                  accessibilityState={{ checked: selected }}
                  onPress={() => onSelectLocation(location)}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: spacing.md,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand.red : colors.border.default,
                    backgroundColor: selected
                      ? colors.brand.redLight
                      : colors.surface.default,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <AppText
                    variant="body"
                    color={selected ? colors.brand.red : colors.text.primary}
                  >
                    {location}
                  </AppText>

                  {selected ? (
                    <AppText variant="body" color={colors.brand.red}>
                      ✓
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <AppText variant="body" color={colors.text.secondary}>
              No trainer locations are available yet.
            </AppText>
          )}
        </View>
      </BottomSheet>

      {/* Availability day selection bottom sheet */}
      <BottomSheet
        visible={availabilitySheetVisible}
        onClose={() => setAvailabilitySheetVisible(false)}
        title="Training availability"
        subtitle="Choose the day you prefer to train. This shows trainers who list that day in their weekly schedule."
        maxHeight="75%"
        footer={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            {selectedDay ? (
              <Button
                variant="outline"
                fullWidth
                onPress={() => {
                  onSelectDay(null);
                  setAvailabilitySheetVisible(false);
                }}
              >
                Clear day
              </Button>
            ) : null}

            <Button
              variant="primary"
              fullWidth
              onPress={() => setAvailabilitySheetVisible(false)}
            >
              Done
            </Button>
          </View>
        }
      >
        <View style={{ gap: spacing.sm }}>
          {TRAINING_DAYS.map((day) =>
            renderOption(day, selectedDay === day, () => onSelectDay(day)),
          )}
        </View>
      </BottomSheet>

      {/* Price filter bottom sheet */}
      <BottomSheet
        visible={priceSheetVisible}
        onClose={() => setPriceSheetVisible(false)}
        title="Session price"
        subtitle="Set a price range for individual training sessions."
        maxHeight="75%"
        footer={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            <Button
              variant="outline"
              fullWidth
              onPress={() => {
                onClearPrice();
                setPriceSheetVisible(false);
              }}
            >
              Clear price
            </Button>

            <Button
              variant="primary"
              fullWidth
              disabled={Boolean(priceError)}
              onPress={() => setPriceSheetVisible(false)}
            >
              Apply price filter
            </Button>
          </View>
        }
      >
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              Currency
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select a currency so trainers with different currencies are not compared
              directly.
            </AppText>
          </View>

          {availableCurrencies.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {availableCurrencies.map((currency) =>
                renderOption(currency, selectedCurrency === currency, () =>
                  onSelectCurrency(currency),
                ),
              )}
            </View>
          ) : (
            <AppText variant="bodySmall" color={colors.text.secondary}>
              No trainer session prices are available yet.
            </AppText>
          )}

          <View style={{ gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              Price range
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              {selectedCurrency
                ? `Enter your budget in ${selectedCurrency}.`
                : 'Select a currency to set your budget.'}
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {renderPriceInput(
              'Minimum',
              minimumPrice,
              onMinimumPriceChange,
              'Minimum session price',
            )}

            {renderPriceInput(
              'Maximum',
              maximumPrice,
              onMaximumPriceChange,
              'Maximum session price',
            )}
          </View>

          {priceError ? (
            <AppText variant="bodySmall" color={colors.brand.red}>
              {priceError}
            </AppText>
          ) : null}

          {availableCurrencies.length > 1 ? (
            <AppText variant="bodySmall" color={colors.text.secondary}>
              Prices are filtered within the selected currency only.
            </AppText>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}
