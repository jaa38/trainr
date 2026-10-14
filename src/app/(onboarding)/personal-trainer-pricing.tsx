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
  type TrainerPricingFormValues,
  type TrainingPackageFormValues,
} from '@/schemas/trainer-pricing';
import { useTrainrTheme } from '@/theme';

const currencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

type Currency = (typeof currencies)[number];

type TrainingPackage = TrainingPackageFormValues & {
  id?: string;
};

const createPackage = (): TrainingPackage => ({
  name: '',
  description: '',
  sessionsCount: '',
  price: '',
});

export default function PersonalTrainerPricingScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TrainerPricingFormValues>({
    resolver: zodResolver(trainerPricingSchema),
    defaultValues: {
      sessionRate: '',
      currency: 'NGN',
      sessionDuration: '60',
      packages: [],
    },
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

  const packages =
    useWatch({
      control,
      name: 'packages',
    }) ?? [];

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPricing() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const [
          { data: pricing, error: pricingError },
          { data: savedPackages, error: packagesError },
        ] = await Promise.all([
          supabase
            .from('trainer_pricing')
            .select('session_rate, currency, session_duration_minutes')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('trainer_packages')
            .select('id, name, description, sessions_count, price, currency')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: true }),
        ]);

        if (pricingError) throw pricingError;
        if (packagesError) throw packagesError;
        if (!isMounted) return;

        reset({
          sessionRate: pricing ? String(pricing.session_rate) : '',
          currency:
            pricing && currencies.includes(pricing.currency as Currency)
              ? (pricing.currency as Currency)
              : 'NGN',
          sessionDuration: pricing ? String(pricing.session_duration_minutes) : '60',
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

  function renderCurrencyOption(option: Currency) {
    const selected = currency === option;

    return (
      <Pressable
        key={option}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
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
          {option}
        </AppText>
      </Pressable>
    );
  }

  async function handleContinue(values: TrainerPricingFormValues) {
    if (!user || isSaving || isLoading) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();
      const rate = Number(values.sessionRate);
      const duration = Number(values.sessionDuration);

      const { error: pricingError } = await supabase.from('trainer_pricing').upsert(
        {
          user_id: user.id,
          session_rate: rate,
          currency: values.currency,
          session_duration_minutes: duration,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

      if (pricingError) throw pricingError;

      const { data: existingPackages, error: existingError } = await supabase
        .from('trainer_packages')
        .select('id')
        .eq('trainer_id', user.id);

      if (existingError) throw existingError;

      // Normalize the form values while retaining saved package IDs.
      const normalizedPackages: (TrainingPackage & {
        normalizedName: string;
        normalizedDescription: string;
        normalizedSessions: number;
        normalizedPrice: number;
      })[] = values.packages.map((item) => ({
        ...item,
        normalizedName: item.name.trim(),
        normalizedDescription: item.description.trim(),
        normalizedSessions: Number(item.sessionsCount),
        normalizedPrice: Number(item.price),
      }));

      // Only existing IDs are retained; new packages have no ID yet.
      const retainedIds = new Set(
        normalizedPackages
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id)),
      );

      const removedIds = (existingPackages ?? [])
        .map((item) => item.id)
        .filter((id) => !retainedIds.has(id));

      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('trainer_packages')
          .delete()
          .eq('trainer_id', user.id)
          .in('id', removedIds);

        if (deleteError) throw deleteError;
      }

      for (const item of normalizedPackages) {
        const packageData = {
          trainer_id: user.id,
          name: item.normalizedName,
          description: item.normalizedDescription || null,
          sessions_count: item.normalizedSessions,
          price: item.normalizedPrice,
          currency: values.currency,
          updated_at: now,
        };

        if (item.id) {
          const { error } = await supabase
            .from('trainer_packages')
            .update(packageData)
            .eq('id', item.id)
            .eq('trainer_id', user.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from('trainer_packages').insert(packageData);

          if (error) throw error;
        }
      }

      console.log('[Trainer Pricing] Pricing draft saved');

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
              <View style={{ gap: spacing.md }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Individual sessions
                </AppText>

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
                </View>

                {renderField(
                  'Session duration (minutes)',
                  sessionDuration,
                  (value) => {
                    setValue('sessionDuration', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });

                    setErrorMessage(null);
                  },
                  'e.g. 60',
                  { numeric: true },
                )}

                {errors.sessionDuration?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.sessionDuration.message}
                  </AppText>
                ) : null}
              </View>

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
                        style={{ padding: spacing.xs }}
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
                      `Package price (${currency})`,
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
