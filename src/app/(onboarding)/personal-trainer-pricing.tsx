import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

import {
  trainerPricingSchema,
  type TrainerPricingFormInput,
  type TrainerPricingFormValues,
  type TrainingPackageFormValues,
} from '@/schemas/trainer-pricing';

import {
  trainerSessionRateSchema,
  type TrainerSessionType,
  type TrainerTrainingFormat,
} from '@/schemas/trainer-session-rates';

import {
  createTrainerSessionRate,
  getTrainerSessionRates,
  updateTrainerSessionRate,
  type TrainerSessionRate,
} from '@/services/trainer-session-rates';

import { useTrainrTheme } from '@/theme';
import { formatCurrency } from '@/utils/formatCurrency';

// -----------------------------------------------------------------------------
// Constants and types.
// -----------------------------------------------------------------------------

const currencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

const sessionDurations = ['30', '45', '60', '90'] as const;

type Currency = (typeof currencies)[number];

type SessionDurationInput = (typeof sessionDurations)[number];

const sessionTypes: {
  label: string;
  value: TrainerSessionType;
}[] = [
  { label: 'One-to-one', value: 'one_to_one' },
  { label: 'Group training', value: 'group_training' },
  { label: 'Online training', value: 'online_training' },
];

const trainingFormats: {
  label: string;
  value: TrainerTrainingFormat;
}[] = [
  { label: 'Online', value: 'online' },
  { label: 'In-person', value: 'in_person' },
  { label: 'Both', value: 'both' },
];

type TrainingPackage = TrainingPackageFormValues & {
  id?: string;
};

const createPackage = (): TrainingPackage => ({
  name: '',
  description: '',
  sessionsCount: '',
  price: '',
});

// -----------------------------------------------------------------------------
// Utility functions.
// -----------------------------------------------------------------------------

function isSessionDuration(value: string): value is SessionDurationInput {
  return sessionDurations.some((duration) => duration === value);
}

function isCurrency(value: string): value is Currency {
  return currencies.some((currency) => currency === value);
}

function getCurrencySymbol(currencyCode: string): string {
  if (!currencyCode) return '';

  try {
    return (
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currencyCode
    );
  } catch {
    return currencyCode;
  }
}

// -----------------------------------------------------------------------------
// Screen.
// -----------------------------------------------------------------------------

export default function PersonalTrainerPricingScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  // ---------------------------------------------------------------------------
  // Form.
  //
  // Input permits temporary empty selections.
  // Output contains only validated session-rate values.
  // ---------------------------------------------------------------------------

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TrainerPricingFormInput, unknown, TrainerPricingFormValues>({
    resolver: zodResolver(trainerPricingSchema),

    defaultValues: {
      sessionType: '',
      sessionRate: '',
      currency: '',
      sessionDuration: '',
      trainingFormat: '',
      packages: [],
    },
  });

  // ---------------------------------------------------------------------------
  // Watched form values.
  // ---------------------------------------------------------------------------

  const sessionType = useWatch({
    control,
    name: 'sessionType',
  });

  const sessionRate = useWatch({
    control,
    name: 'sessionRate',
  });

  const currency = useWatch({
    control,
    name: 'currency',
  });

  const sessionDuration = useWatch({
    control,
    name: 'sessionDuration',
  });

  const trainingFormat = useWatch({
    control,
    name: 'trainingFormat',
  });

  const packages =
    useWatch({
      control,
      name: 'packages',
    }) ?? [];

  // ---------------------------------------------------------------------------
  // Screen state.
  // ---------------------------------------------------------------------------

  const [defaultRate, setDefaultRate] = useState<TrainerSessionRate | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load existing session rates and training packages.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function loadPricing() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const [rates, { data: savedPackages, error: packagesError }] = await Promise.all([
          getTrainerSessionRates(user.id),

          supabase
            .from('trainer_packages')
            .select('id, name, description, sessions_count, price, currency')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: true }),
        ]);

        if (packagesError) {
          throw packagesError;
        }

        if (!isMounted) return;

        // Find the trainer's existing default session rate.
        const savedDefault = rates.find((rate) => rate.is_default) ?? null;

        setDefaultRate(savedDefault);

        const savedDuration = savedDefault
          ? String(savedDefault.session_duration_minutes)
          : '';

        const savedCurrency = savedDefault?.currency ?? '';

        // Populate the form using saved values.
        //
        // Do not invent a session type or training format
        // for incomplete legacy records.
        reset({
          sessionType: savedDefault?.session_type ?? '',

          sessionRate: savedDefault ? String(savedDefault.session_rate) : '',

          currency: isCurrency(savedCurrency) ? savedCurrency : '',

          sessionDuration: isSessionDuration(savedDuration) ? savedDuration : '',

          trainingFormat: savedDefault?.training_format ?? '',

          packages: (savedPackages ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? '',
            sessionsCount: String(item.sessions_count),
            price: String(item.price),
          })),
        });
      } catch (error) {
        console.error('[Trainer Pricing] Failed to load pricing:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load your saved pricing.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPricing();

    return () => {
      isMounted = false;
    };
  }, [user, reset]);

  // ---------------------------------------------------------------------------
  // Training package helpers.
  // ---------------------------------------------------------------------------

  function updatePackage(index: number, field: keyof TrainingPackage, value: string) {
    const updatedPackages = packages.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );

    setValue('packages', updatedPackages, {
      shouldDirty: true,
      shouldValidate: true,
    });

    setErrorMessage(null);
  }

  function removePackage(index: number) {
    if (isSaving) return;

    setValue(
      'packages',
      packages.filter((_, itemIndex) => itemIndex !== index),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );

    setErrorMessage(null);
  }

  // ---------------------------------------------------------------------------
  // Reusable form field.
  // ---------------------------------------------------------------------------

  function renderField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      multiline?: boolean;
      numeric?: boolean;
    },
  ) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
        </AppText>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          multiline={options?.multiline}
          keyboardType={options?.numeric ? 'decimal-pad' : 'default'}
          editable={!isSaving && !isLoading}
          textAlignVertical={options?.multiline ? 'top' : 'center'}
          style={{
            minHeight: options?.multiline ? 90 : 54,
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
          }}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Reusable selection control.
  // ---------------------------------------------------------------------------

  function renderChoice<T extends string>(
    options: {
      label: string;
      value: T;
    }[],
    selectedValue: T | '',
    onSelect: (value: T) => void,
  ) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        }}
      >
        {options.map((option) => {
          const selected = selectedValue === option.value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selected,
              }}
              disabled={isSaving || isLoading}
              onPress={() => {
                onSelect(option.value);
                setErrorMessage(null);
              }}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: selected ? colors.brand.red : colors.border.default,
                backgroundColor: selected
                  ? colors.background.secondary
                  : colors.background.primary,
              }}
            >
              <AppText
                variant="button"
                color={selected ? colors.brand.red : colors.text.primary}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Currency selection.
  // ---------------------------------------------------------------------------

  function renderCurrencyOption(option: Currency) {
    const selected = currency === option;

    return (
      <Pressable
        key={option}
        accessibilityRole="radio"
        accessibilityLabel={`${option} (${getCurrencySymbol(option)})`}
        accessibilityState={{
          checked: selected,
        }}
        disabled={isSaving || isLoading}
        onPress={() => {
          setValue('currency', option, {
            shouldDirty: true,
            shouldValidate: true,
          });

          setErrorMessage(null);
        }}
        style={{
          flex: 1,
          minHeight: 46,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderRadius: 10,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
        }}
      >
        <AppText
          variant="button"
          color={selected ? colors.brand.red : colors.text.primary}
        >
          {getCurrencySymbol(option)}
        </AppText>
      </Pressable>
    );
  }

  // ---------------------------------------------------------------------------
  // Save session rate and training packages.
  // ---------------------------------------------------------------------------

  async function handleContinue(values: TrainerPricingFormValues) {
    if (!user || isSaving || isLoading) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Convert the validated onboarding values into
      // the strict session-rate service format.
      const sessionRateValues = trainerSessionRateSchema.parse({
        sessionType: values.sessionType,
        sessionDurationMinutes: Number(values.sessionDuration),
        sessionRate: Number(values.sessionRate),
        currency: values.currency,
        trainingFormat: values.trainingFormat,
        status: 'active',
      });

      let savedRate: TrainerSessionRate;

      if (defaultRate) {
        // Update the existing default rate.
        //
        // This also confirms incomplete legacy records
        // once the trainer supplies the missing details.
        savedRate = await updateTrainerSessionRate(
          user.id,
          defaultRate.id,
          sessionRateValues,
        );
      } else {
        // Create a new rate and make it the default.
        savedRate = await createTrainerSessionRate(user.id, sessionRateValues, true);
      }

      setDefaultRate(savedRate);

      const now = new Date().toISOString();

      // -----------------------------------------------------------------------
      // Preserve existing package management.
      // -----------------------------------------------------------------------

      const { data: existingPackages, error: existingError } = await supabase
        .from('trainer_packages')
        .select('id')
        .eq('trainer_id', user.id);

      if (existingError) {
        throw existingError;
      }

      const normalizedPackages = values.packages.map((item) => ({
        ...item,
        normalizedName: item.name.trim(),
        normalizedDescription: item.description.trim(),
        normalizedSessions: Number(item.sessionsCount),
        normalizedPrice: Number(item.price),
      }));

      const retainedIds = new Set(
        normalizedPackages
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id)),
      );

      const removedIds = (existingPackages ?? [])
        .map((item) => item.id)
        .filter((id) => !retainedIds.has(id));

      // Delete only packages removed from the form.
      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('trainer_packages')
          .delete()
          .eq('trainer_id', user.id)
          .in('id', removedIds);

        if (deleteError) {
          throw deleteError;
        }
      }

      // Create or update the remaining packages.
      for (const item of normalizedPackages) {
        const packageData = {
          trainer_id: user.id,
          name: item.normalizedName,
          description: item.normalizedDescription || null,
          sessions_count: item.normalizedSessions,
          price: item.normalizedPrice,
          currency: sessionRateValues.currency,
          updated_at: now,
        };

        if (item.id) {
          const { error } = await supabase
            .from('trainer_packages')
            .update(packageData)
            .eq('id', item.id)
            .eq('trainer_id', user.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase.from('trainer_packages').insert(packageData);

          if (error) {
            throw error;
          }
        }
      }

      console.log('[Trainer Pricing] Session rate and packages saved');

      router.push('/(onboarding)/personal-trainer-availability');
    } catch (error) {
      console.error('[Trainer Pricing] Failed to save pricing:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your pricing. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render screen.
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            padding: spacing.lg,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL TRAINER SETUP · STEP 4 OF 5
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Set your rates.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Set your standard session rate and create optional packages for gym-goers. You
            can save these details now and publish your profile later.
          </AppText>

          {isLoading ? (
            <AppText variant="body" color={colors.text.secondary}>
              Loading saved pricing…
            </AppText>
          ) : (
            <>
              {/* ----------------------------------------------------------- */}
              {/* Legacy rate confirmation notice. */}
              {/* ----------------------------------------------------------- */}

              {defaultRate?.requires_confirmation ? (
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
                  <AppText variant="body" color={colors.text.primary}>
                    Confirm your existing session rate
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Your previous pricing has been loaded. Please review the session type
                    and training format, then save to confirm your updated session
                    details.
                  </AppText>
                </View>
              ) : null}

              {/* ----------------------------------------------------------- */}
              {/* Individual session pricing. */}
              {/* ----------------------------------------------------------- */}

              <View style={{ gap: spacing.md }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Individual sessions
                </AppText>

                {/* Session type. */}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Session type
                  </AppText>

                  {renderChoice(sessionTypes, sessionType, (value) =>
                    setValue('sessionType', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    }),
                  )}

                  {errors.sessionType?.message ? (
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {errors.sessionType.message}
                    </AppText>
                  ) : null}
                </View>

                {/* Session rate. */}

                {renderField(
                  'Rate per session',
                  sessionRate,
                  (value) => {
                    setValue('sessionRate', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });

                    setErrorMessage(null);
                  },
                  'e.g. 5000',
                  { numeric: true },
                )}

                {errors.sessionRate?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.sessionRate.message}
                  </AppText>
                ) : null}

                {sessionRate.trim() !== '' &&
                Number.isFinite(Number(sessionRate)) &&
                currency !== '' ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Preview:{' '}
                    {formatCurrency(Number(sessionRate), {
                      currency,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    per session
                  </AppText>
                ) : null}

                {/* Currency. */}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Currency
                  </AppText>

                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                    }}
                  >
                    {currencies.map(renderCurrencyOption)}
                  </View>

                  {errors.currency?.message ? (
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {errors.currency.message}
                    </AppText>
                  ) : null}
                </View>

                {/* Session duration. */}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Session duration
                  </AppText>

                  {renderChoice(
                    sessionDurations.map((duration) => ({
                      label: `${duration} minutes`,
                      value: duration,
                    })),
                    sessionDuration,
                    (value) =>
                      setValue('sessionDuration', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      }),
                  )}

                  {errors.sessionDuration?.message ? (
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {errors.sessionDuration.message}
                    </AppText>
                  ) : null}
                </View>

                {/* Training format. */}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Training format
                  </AppText>

                  {renderChoice(trainingFormats, trainingFormat, (value) =>
                    setValue('trainingFormat', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    }),
                  )}

                  {errors.trainingFormat?.message ? (
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {errors.trainingFormat.message}
                    </AppText>
                  ) : null}
                </View>
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Training packages. */}
              {/* ----------------------------------------------------------- */}

              <View style={{ gap: spacing.md }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Training packages
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Packages are optional. Add an offer for clients who want multiple
                  training sessions.
                </AppText>

                {packages.map((item, index) => (
                  <View
                    key={item.id ?? `new-package-${index}`}
                    style={{
                      padding: spacing.md,
                      gap: spacing.md,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      borderRadius: 14,
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
                        Package {index + 1}
                      </AppText>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove package ${index + 1}`}
                        disabled={isSaving}
                        onPress={() => removePackage(index)}
                        style={{
                          padding: spacing.xs,
                        }}
                      >
                        <AppText variant="button" color={colors.brand.red}>
                          REMOVE
                        </AppText>
                      </Pressable>
                    </View>

                    {renderField(
                      'Package name',
                      item.name,
                      (value) => updatePackage(index, 'name', value),
                      'e.g. 8-session strength programme',
                    )}

                    {errors.packages?.[index]?.name?.message ? (
                      <AppText variant="bodySmall" color={colors.text.error}>
                        {errors.packages[index]?.name?.message}
                      </AppText>
                    ) : null}

                    {renderField(
                      'Description (optional)',
                      item.description,
                      (value) => updatePackage(index, 'description', value),
                      'Describe what the package includes',
                      { multiline: true },
                    )}

                    {errors.packages?.[index]?.description?.message ? (
                      <AppText variant="bodySmall" color={colors.text.error}>
                        {errors.packages[index]?.description?.message}
                      </AppText>
                    ) : null}

                    {renderField(
                      'Number of sessions',
                      item.sessionsCount,
                      (value) => updatePackage(index, 'sessionsCount', value),
                      'e.g. 8',
                      { numeric: true },
                    )}

                    {errors.packages?.[index]?.sessionsCount?.message ? (
                      <AppText variant="bodySmall" color={colors.text.error}>
                        {errors.packages[index]?.sessionsCount?.message}
                      </AppText>
                    ) : null}

                    {renderField(
                      `Package price (${getCurrencySymbol(currency) || 'currency'})`,
                      item.price,
                      (value) => updatePackage(index, 'price', value),
                      'e.g. 35000',
                      { numeric: true },
                    )}

                    {errors.packages?.[index]?.price?.message ? (
                      <AppText variant="bodySmall" color={colors.text.error}>
                        {errors.packages[index]?.price?.message}
                      </AppText>
                    ) : null}
                  </View>
                ))}

                {/* Add package. */}

                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving || isLoading}
                  onPress={() => {
                    setValue('packages', [...packages, createPackage()], {
                      shouldDirty: true,
                      shouldValidate: false,
                    });

                    setErrorMessage(null);
                  }}
                  style={{
                    minHeight: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.brand.red,
                  }}
                >
                  <AppText variant="button" color={colors.brand.red}>
                    + ADD TRAINING PACKAGE
                  </AppText>
                </Pressable>
              </View>
            </>
          )}

          {/* --------------------------------------------------------------- */}
          {/* Error message. */}
          {/* --------------------------------------------------------------- */}

          {errorMessage ? (
            <AppText
              variant="bodySmall"
              color={colors.text.error}
              accessibilityRole="alert"
            >
              {errorMessage}
            </AppText>
          ) : null}

          {/* --------------------------------------------------------------- */}
          {/* Continue button. */}
          {/* --------------------------------------------------------------- */}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: isSaving || isLoading,
              busy: isSaving,
            }}
            disabled={isSaving || isLoading}
            onPress={handleSubmit(handleContinue)}
            style={({ pressed }) => ({
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity: isSaving || isLoading ? 0.6 : pressed ? 0.8 : 1,
            })}
          >
            <AppText variant="buttonLarge" color="#FFFFFF">
              {isSaving ? 'SAVING…' : 'SAVE DRAFT & CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
