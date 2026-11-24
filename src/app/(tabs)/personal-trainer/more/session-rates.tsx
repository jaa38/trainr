import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { ArrowLeft, Check, Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainerSessionRates } from '@/hooks/trainer/useTrainerSessionRates';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerSessionRateSchema,
  type TrainerSessionCurrency,
  type TrainerSessionDuration,
  type TrainerSessionRateFormValues,
  type TrainerSessionStatus,
  type TrainerSessionType,
  type TrainerTrainingFormat,
} from '@/schemas/trainer-session-rates';
import type { TrainerSessionRate } from '@/services/trainer-session-rates';
import { useTrainrTheme } from '@/theme';

type SessionRateDraft = {
  sessionType: TrainerSessionType | '';
  sessionDurationMinutes: TrainerSessionDuration | '';
  sessionRate: string;
  currency: TrainerSessionCurrency;
  trainingFormat: TrainerTrainingFormat | '';
  status: TrainerSessionStatus;
};

type SessionRateFormOutput = TrainerSessionRateFormValues;

const INITIAL_FORM: SessionRateDraft = {
  sessionType: '',
  sessionDurationMinutes: 60,
  sessionRate: '',
  currency: 'NGN',
  trainingFormat: '',
  status: 'active',
};

const SESSION_TYPES: {
  label: string;
  value: TrainerSessionType;
}[] = [
  { label: 'One-to-one', value: 'one_to_one' },
  { label: 'Group training', value: 'group_training' },
  { label: 'Online training', value: 'online_training' },
];

const DURATIONS: TrainerSessionDuration[] = [30, 45, 60, 90];

const CURRENCIES: TrainerSessionCurrency[] = ['NGN', 'GBP', 'USD', 'EUR'];

const FORMATS: {
  label: string;
  value: TrainerTrainingFormat;
}[] = [
  { label: 'Online', value: 'online' },
  { label: 'In-person', value: 'in_person' },
  { label: 'Both', value: 'both' },
];

const STATUSES: TrainerSessionStatus[] = ['active', 'inactive'];

function getSessionTypeLabel(value: TrainerSessionType | null) {
  return SESSION_TYPES.find((item) => item.value === value)?.label ?? 'Not specified';
}

function getFormatLabel(value: TrainerTrainingFormat | null) {
  return FORMATS.find((item) => item.value === value)?.label ?? 'Not specified';
}

function formatPrice(amount: number, currency: TrainerSessionCurrency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function TrainerSessionRatesScreen() {
  const { colors, spacing } = useTrainrTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { ratesQuery, createMutation, updateMutation, deleteMutation, defaultMutation } =
    useTrainerSessionRates(user?.id);

  const records = ratesQuery.data ?? [];
  const isLoading = ratesQuery.isPending;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Reserve space for the floating NativeTabs bar and bottom safe area.
  const bottomContentPadding = spacing.xxxl + insets.bottom + 100;

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrainerSessionRate | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SessionRateDraft, unknown, SessionRateFormOutput>({
    resolver: zodResolver(trainerSessionRateSchema) as Resolver<
      SessionRateDraft,
      unknown,
      SessionRateFormOutput
    >,
    defaultValues: INITIAL_FORM,
  });

  const formValues = useWatch({
    control,
  }) as SessionRateDraft;

  const isFormBusy = isSaving || isSubmitting;

  function clearMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function openCreate() {
    setEditingRecord(null);
    reset(INITIAL_FORM);
    clearMessages();
    setIsModalVisible(true);
  }

  function openEdit(record: TrainerSessionRate) {
    setEditingRecord(record);

    reset({
      sessionType: record.session_type ?? '',
      sessionDurationMinutes: record.session_duration_minutes,
      sessionRate: String(record.session_rate),
      currency: record.currency,
      trainingFormat: record.training_format ?? '',
      status: record.status,
    });

    clearMessages();
    setIsModalVisible(true);
  }

  function closeModal() {
    if (isFormBusy) return;

    setIsModalVisible(false);
    setEditingRecord(null);
    reset(INITIAL_FORM);
  }

  async function handleSave(values: SessionRateFormOutput) {
    if (!user?.id || isFormBusy) return;

    clearMessages();

    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({
          rateId: editingRecord.id,
          values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }

      setIsModalVisible(false);
      setEditingRecord(null);
      reset(INITIAL_FORM);

      setSuccessMessage(
        editingRecord
          ? 'Your session rate has been updated.'
          : 'Your session rate has been added.',
      );
    } catch (error) {
      console.error('[Trainer Session Rates] Failed to save:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save this session rate. Please try again.',
      );
    }
  }

  function confirmDelete(record: TrainerSessionRate) {
    const warning = record.is_default
      ? ' This is your current default rate. Removing it will also remove the legacy price used by existing discovery and booking integrations.'
      : '';

    Alert.alert(
      'Delete session rate',
      `Are you sure you want to delete this session rate?${warning}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id || deletingId) return;

            setDeletingId(record.id);
            clearMessages();

            try {
              await deleteMutation.mutateAsync(record.id);

              setSuccessMessage('Your session rate has been deleted.');
            } catch (error) {
              console.error('[Trainer Session Rates] Failed to delete:', error);

              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to delete this session rate. Please try again.',
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }

  async function handleSetDefault(record: TrainerSessionRate) {
    if (!user?.id || defaultMutation.isPending) return;

    if (record.requires_confirmation || !record.session_type || !record.training_format) {
      setErrorMessage(
        'Complete and confirm this session rate before making it the default.',
      );
      return;
    }

    if (record.status !== 'active') {
      setErrorMessage('Only active session rates can be selected as the default.');
      return;
    }

    setDefaultingId(record.id);
    clearMessages();

    try {
      await defaultMutation.mutateAsync(record.id);

      setSuccessMessage('Your default session rate has been updated.');
    } catch (error) {
      console.error('[Trainer Session Rates] Failed to update default:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update your default session rate.',
      );
    } finally {
      setDefaultingId(null);
    }
  }

  function renderOption<T extends string | number>(
    label: string,
    options: readonly T[],
    selected: T | '',
    onSelect: (value: T) => void,
    displayLabel?: (value: T) => string,
  ) {
    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          {options.map((option) => {
            const selectedOption = selected === option;

            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{
                  selected: selectedOption,
                }}
                disabled={isFormBusy}
                onPress={() => onSelect(option)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selectedOption ? colors.brand.red : colors.border.default,
                  backgroundColor: selectedOption
                    ? colors.brand.redLight
                    : colors.background.secondary,
                  opacity: isFormBusy ? 0.6 : 1,
                }}
              >
                <AppText
                  variant="bodySmall"
                  color={selectedOption ? colors.brand.red : colors.text.secondary}
                >
                  {displayLabel ? displayLabel(option) : option}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderRateCard(record: TrainerSessionRate) {
    const needsConfirmation =
      record.requires_confirmation || !record.session_type || !record.training_format;

    const isDeleting = deletingId === record.id;
    const isDefaulting = defaultingId === record.id;

    return (
      <View
        key={record.id}
        style={{
          padding: spacing.lg,
          gap: spacing.md,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: record.is_default ? colors.brand.red : colors.border.default,
          backgroundColor: colors.background.secondary,
        }}
      >
        {/* Session Information */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              {getSessionTypeLabel(record.session_type)}
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              {record.session_duration_minutes} minutes ·{' '}
              {getFormatLabel(record.training_format)}
            </AppText>
          </View>

          {record.is_default ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 999,
                backgroundColor: colors.brand.redLight,
              }}
            >
              <Star size={13} color={colors.brand.red} fill={colors.brand.red} />

              <AppText variant="caption" color={colors.brand.red}>
                DEFAULT
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Session Price */}
        <AppText variant="h2" color={colors.text.primary}>
          {formatPrice(record.session_rate, record.currency)}
        </AppText>

        {/* Status */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          <AppText variant="caption" color={colors.text.secondary}>
            {record.status.toUpperCase()}
          </AppText>

          {needsConfirmation ? (
            <AppText variant="caption" color={colors.text.error}>
              NEEDS CONFIRMATION
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.text.secondary}>
              CONFIRMED
            </AppText>
          )}
        </View>

        {needsConfirmation ? (
          <AppText variant="bodySmall" color={colors.text.secondary}>
            Complete the missing session type and training format to confirm this rate.
            Your existing price has been preserved.
          </AppText>
        ) : null}

        {/* Actions */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit session rate"
            disabled={isSaving || isDeleting}
            onPress={() => openEdit(record)}
            style={{
              minHeight: 42,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border.default,
              opacity: isSaving || isDeleting ? 0.5 : 1,
            }}
          >
            <Pencil size={15} color={colors.text.primary} />

            <AppText variant="button" color={colors.text.primary}>
              EDIT
            </AppText>
          </Pressable>

          {!record.is_default && !needsConfirmation && record.status === 'active' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set as default session rate"
              disabled={Boolean(defaultingId)}
              onPress={() => void handleSetDefault(record)}
              style={{
                minHeight: 42,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                borderRadius: 10,
                backgroundColor: colors.brand.redLight,
                opacity: defaultingId ? 0.6 : 1,
              }}
            >
              {isDefaulting ? (
                <ActivityIndicator size="small" color={colors.brand.red} />
              ) : (
                <Check size={15} color={colors.brand.red} />
              )}

              <AppText variant="button" color={colors.brand.red}>
                MAKE DEFAULT
              </AppText>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete session rate"
            disabled={Boolean(deletingId) || Boolean(defaultingId)}
            onPress={() => confirmDelete(record)}
            style={{
              minHeight: 42,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.text.error,
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.text.error} />
            ) : (
              <Trash2 size={15} color={colors.text.error} />
            )}

            <AppText variant="button" color={colors.text.error}>
              DELETE
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>

        <AppText variant="h2" color={colors.text.primary}>
          Session Rates
        </AppText>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: bottomContentPadding,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            PROFESSIONAL PROFILE
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Set your session rates.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Manage your training prices, session durations and training formats. Your
            rates help gym-goers understand your services and choose the right training
            option.
          </AppText>
        </View>

        {/* Error Message */}
        {errorMessage || ratesQuery.isError ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.background.secondary,
              gap: spacing.sm,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage ?? 'Unable to load your session rates. Please try again.'}
            </AppText>

            {ratesQuery.isError && !errorMessage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void ratesQuery.refetch()}
                style={{ alignSelf: 'flex-start' }}
              >
                <AppText variant="button" color={colors.brand.red}>
                  TRY AGAIN
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Success Message */}
        {successMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="bodySmall" color={colors.brand.red}>
              {successMessage}
            </AppText>
          </View>
        ) : null}

        {/* Add Session Rate */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add session rate"
          disabled={isLoading}
          onPress={openCreate}
          style={({ pressed }) => ({
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            borderRadius: 14,
            backgroundColor: colors.brand.red,
            opacity: isLoading ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <Plus size={19} color="#FFFFFF" />

          <AppText variant="buttonLarge" color="#FFFFFF">
            ADD SESSION RATE
          </AppText>
        </Pressable>

        {/* Session Rates */}
        {isLoading ? (
          <View
            style={{
              minHeight: 200,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator color={colors.brand.red} />

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading your session rates...
            </AppText>
          </View>
        ) : records.length === 0 ? (
          /* Empty State */
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <Star size={36} color={colors.brand.red} />

            <AppText variant="h3" color={colors.text.primary}>
              No session rates yet
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{
                textAlign: 'center',
                lineHeight: 24,
              }}
            >
              Add your first session rate to tell gym-goers how much your training
              sessions cost.
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="h3" color={colors.text.primary}>
              YOUR SESSION RATES
            </AppText>

            {records.map(renderRateCard)}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Session Rate Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView
          edges={['top', 'bottom']}
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
                padding: spacing.lg,
                paddingBottom: spacing.xxl,
                gap: spacing.lg,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Modal Introduction */}
              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" color={colors.brand.red}>
                  PROFESSIONAL PROFILE
                </AppText>

                <AppText variant="h1" color={colors.text.primary}>
                  {editingRecord ? 'Edit session rate.' : 'Add session rate.'}
                </AppText>

                <AppText variant="body" color={colors.text.secondary}>
                  Configure the session type, duration, price and training format.
                </AppText>
              </View>

              {/* Legacy Rate Notice */}
              {editingRecord?.requires_confirmation ? (
                <View
                  style={{
                    padding: spacing.md,
                    borderRadius: 12,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.xs,
                  }}
                >
                  <AppText variant="button" color={colors.brand.red}>
                    LEGACY RATE — CONFIRM DETAILS
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Your existing price and currency are preserved. Choose the missing
                    session details to confirm this rate.
                  </AppText>
                </View>
              ) : null}

              {/* Session Type */}
              {renderOption<TrainerSessionType>(
                'Session type',
                SESSION_TYPES.map((item) => item.value),
                formValues.sessionType,
                (value) => {
                  setValue('sessionType', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearMessages();
                },
                getSessionTypeLabel,
              )}

              {errors.sessionType?.message ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.sessionType.message}
                </AppText>
              ) : null}

              {/* Session Duration */}
              {renderOption<TrainerSessionDuration>(
                'Session duration',
                DURATIONS,
                formValues.sessionDurationMinutes,
                (value) => {
                  setValue('sessionDurationMinutes', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearMessages();
                },
                (value) => `${value} min`,
              )}

              {errors.sessionDurationMinutes?.message ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.sessionDurationMinutes.message}
                </AppText>
              ) : null}

              {/* Session Price */}
              <Controller
                control={control}
                name="sessionRate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="body" color={colors.text.primary}>
                      Session price
                    </AppText>

                    <TextInput
                      value={value}
                      onChangeText={(text) => {
                        onChange(text);
                        clearMessages();
                      }}
                      onBlur={onBlur}
                      placeholder="Enter your session price"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="decimal-pad"
                      editable={!isFormBusy}
                      accessibilityLabel="Session price"
                      style={{
                        minHeight: 54,
                        borderWidth: 1,
                        borderColor: errors.sessionRate
                          ? colors.text.error
                          : colors.border.default,
                        borderRadius: 12,
                        paddingHorizontal: spacing.md,
                        color: colors.text.primary,
                        backgroundColor: colors.background.secondary,
                      }}
                    />

                    {errors.sessionRate?.message ? (
                      <AppText variant="bodySmall" color={colors.text.error}>
                        {errors.sessionRate.message}
                      </AppText>
                    ) : null}
                  </View>
                )}
              />

              {/* Currency */}
              {renderOption<TrainerSessionCurrency>(
                'Currency',
                CURRENCIES,
                formValues.currency,
                (value) => {
                  setValue('currency', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearMessages();
                },
              )}

              {errors.currency?.message ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.currency.message}
                </AppText>
              ) : null}

              {/* Training Format */}
              {renderOption<TrainerTrainingFormat>(
                'Training format',
                FORMATS.map((item) => item.value),
                formValues.trainingFormat,
                (value) => {
                  setValue('trainingFormat', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearMessages();
                },
                getFormatLabel,
              )}

              {errors.trainingFormat?.message ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.trainingFormat.message}
                </AppText>
              ) : null}

              {/* Pricing Status */}
              {renderOption<TrainerSessionStatus>(
                'Pricing status',
                STATUSES,
                formValues.status,
                (value) => {
                  setValue('status', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearMessages();
                },
                (value) => (value === 'active' ? 'Active' : 'Inactive'),
              )}

              {/* Form Error */}
              {errorMessage ? (
                <View
                  accessibilityRole="alert"
                  style={{
                    padding: spacing.md,
                    borderRadius: 12,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errorMessage}
                  </AppText>
                </View>
              ) : null}

              {/* Save */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isFormBusy,
                  busy: isFormBusy,
                }}
                disabled={isFormBusy}
                onPress={handleSubmit(handleSave)}
                style={({ pressed }) => ({
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  backgroundColor: colors.brand.red,
                  opacity: isFormBusy ? 0.6 : pressed ? 0.8 : 1,
                })}
              >
                {isFormBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppText variant="buttonLarge" color="#FFFFFF">
                    {editingRecord ? 'SAVE CHANGES' : 'ADD SESSION RATE'}
                  </AppText>
                )}
              </Pressable>

              {/* Cancel */}
              <Pressable
                accessibilityRole="button"
                disabled={isFormBusy}
                onPress={closeModal}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="button" color={colors.text.secondary}>
                  CANCEL
                </AppText>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
