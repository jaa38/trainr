import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useTrainrTheme } from '@/theme';

const currencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;
type Currency = (typeof currencies)[number];

type TrainingPackage = {
  id?: string;
  name: string;
  description: string;
  sessionsCount: string;
  price: string;
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

  const [sessionRate, setSessionRate] = useState('');
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [sessionDuration, setSessionDuration] = useState('60');
  const [packages, setPackages] = useState<TrainingPackage[]>([]);
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

        if (pricing) {
          setSessionRate(String(pricing.session_rate));
          setCurrency(
            currencies.includes(pricing.currency as Currency)
              ? (pricing.currency as Currency)
              : 'NGN',
          );
          setSessionDuration(String(pricing.session_duration_minutes));
        }

        setPackages(
          (savedPackages ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? '',
            sessionsCount: String(item.sessions_count),
            price: String(item.price),
          })),
        );
      } catch (error) {
        console.error('[Trainer Pricing] Failed to load pricing:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load your saved pricing.',
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadPricing();

    return () => {
      isMounted = false;
    };
  }, [user]);

  function updatePackage(index: number, field: keyof TrainingPackage, value: string) {
    setPackages((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removePackage(index: number) {
    if (isSaving) return;
    setPackages((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
        onPress={() => setCurrency(option)}
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

  async function handleContinue() {
    if (!user || isSaving || isLoading) return;

    const rate = Number(sessionRate);
    const duration = Number(sessionDuration);

    if (!sessionRate.trim() || !Number.isFinite(rate) || rate <= 0) {
      setErrorMessage('Enter a session rate greater than zero.');
      return;
    }

    if (!sessionDuration.trim() || !Number.isInteger(duration) || duration <= 0) {
      setErrorMessage('Enter a valid session duration in minutes.');
      return;
    }

    const normalizedPackages = packages.map((item) => ({
      ...item,
      normalizedName: item.name.trim(),
      normalizedDescription: item.description.trim(),
      normalizedSessions: Number(item.sessionsCount),
      normalizedPrice: Number(item.price),
    }));

    for (const item of normalizedPackages) {
      if (
        !item.normalizedName ||
        !item.sessionsCount.trim() ||
        !Number.isInteger(item.normalizedSessions) ||
        item.normalizedSessions <= 0 ||
        !item.price.trim() ||
        !Number.isFinite(item.normalizedPrice) ||
        item.normalizedPrice <= 0
      ) {
        setErrorMessage(
          'Complete each package name, session count and price, or remove the unfinished package.',
        );
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error: pricingError } = await supabase.from('trainer_pricing').upsert(
        {
          user_id: user.id,
          session_rate: rate,
          currency,
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
          currency,
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
      style={{ flex: 1, backgroundColor: colors.background.primary }}
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
                  setSessionRate,
                  'e.g. 5000',
                  { numeric: true },
                )}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Currency
                  </AppText>

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {currencies.map(renderCurrencyOption)}
                  </View>
                </View>

                {renderField(
                  'Session duration (minutes)',
                  sessionDuration,
                  setSessionDuration,
                  'e.g. 60',
                  { numeric: true },
                )}
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

                    {renderField(
                      'Description (optional)',
                      item.description,
                      (value) => updatePackage(index, 'description', value),
                      'Describe what the package includes',
                      { multiline: true },
                    )}

                    {renderField(
                      'Number of sessions',
                      item.sessionsCount,
                      (value) => updatePackage(index, 'sessionsCount', value),
                      'e.g. 8',
                      { numeric: true },
                    )}

                    {renderField(
                      `Package price (${currency})`,
                      item.price,
                      (value) => updatePackage(index, 'price', value),
                      'e.g. 35000',
                      { numeric: true },
                    )}
                  </View>
                ))}

                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => setPackages((current) => [...current, createPackage()])}
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
            onPress={handleContinue}
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
