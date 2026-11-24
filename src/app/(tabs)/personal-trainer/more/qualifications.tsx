
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerQualificationSchema,
  type TrainerQualificationCategory,
  type TrainerQualificationFormValues,
} from '@/schemas/trainer-qualifications';
import {
  attachTrainerCertificate,
  createTrainerQualification,
  deleteTrainerCertificateFile,
  deleteTrainerQualification,
  getTrainerCertificateUrl,
  getTrainerQualifications,
  removeTrainerCertificate,
  updateTrainerQualification,
  uploadTrainerCertificate,
  type TrainerQualification,
} from '@/services/trainer-qualifications';
import { useTrainrTheme } from '@/theme';

const INITIAL_FORM: TrainerQualificationFormValues = {
  category: 'qualification',
  qualificationName: '',
  issuingOrganisation: '',
  dateObtained: '',
  expiryDate: '',
};

type FormField = keyof TrainerQualificationFormValues;
type DateField = 'dateObtained' | 'expiryDate';

const DATE_FIELD_LABELS: Record<DateField, string> = {
  dateObtained: 'Date obtained',
  expiryDate: 'Expiry date',
};

/**
 * Convert YYYY-MM-DD into a local Date.
 * Avoid new Date('YYYY-MM-DD') because it is parsed as UTC.
 */
function parseDate(value: string): Date {
  if (!value) {
    return new Date();
  }

  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Convert a Date into YYYY-MM-DD using local date values.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a stored date for display.
 */
function formatDateForDisplay(value: string): string {
  if (!value) return '';

  return parseDate(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function TrainerQualificationsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Reserve space for the floating NativeTabs bar and bottom safe area.
  const bottomContentPadding = spacing.xxxl + insets.bottom + 100;

  const [records, setRecords] = useState<TrainerQualification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [removingCertificateId, setRemovingCertificateId] =
    useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<TrainerQualification | null>(null);

  const [formValues, setFormValues] =
    useState<TrainerQualificationFormValues>(INITIAL_FORM);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Native date picker state
  const [datePickerField, setDatePickerField] =
    useState<DateField | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isIOSDatePickerVisible, setIsIOSDatePickerVisible] = useState(false);

  // --------------------------------------------------
  // Load records
  // --------------------------------------------------

  async function loadRecords(showLoader = true) {
    if (!user?.id) {
      setErrorMessage('Your session has expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const data = await getTrainerQualifications(user.id);

      setRecords(data);
      setErrorMessage(null);
    } catch (error) {
      console.error('[Trainer Qualifications] Failed to load:', error);

      setErrorMessage(
        'Unable to load your qualifications. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialRecords() {
      if (!user?.id) {
        setErrorMessage('Your session has expired. Please sign in again.');
        setIsLoading(false);
        return;
      }

      try {
        const data = await getTrainerQualifications(user.id);

        if (isActive) {
          setRecords(data);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('[Trainer Qualifications] Failed to load:', error);

        if (isActive) {
          setErrorMessage(
            'Unable to load your qualifications. Please try again.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialRecords();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  // --------------------------------------------------
  // Create and edit records
  // --------------------------------------------------

  function openCreate(category: TrainerQualificationCategory) {
    setEditingRecord(null);

    setFormValues({
      ...INITIAL_FORM,
      category,
    });

    setFieldErrors({});
    setErrorMessage(null);
    setSuccessMessage(null);
    setDatePickerField(null);
    setIsIOSDatePickerVisible(false);
    setIsModalVisible(true);
  }

  function openEdit(record: TrainerQualification) {
    setEditingRecord(record);

    setFormValues({
      category: record.category,
      qualificationName: record.qualification_name,
      issuingOrganisation: record.issuing_organisation ?? '',
      dateObtained: record.date_obtained ?? '',
      expiryDate: record.expiry_date ?? '',
    });

    setFieldErrors({});
    setErrorMessage(null);
    setSuccessMessage(null);
    setDatePickerField(null);
    setIsIOSDatePickerVisible(false);
    setIsModalVisible(true);
  }

  function closeModal() {
    if (isSaving) return;

    setIsModalVisible(false);
    setIsIOSDatePickerVisible(false);
    setDatePickerField(null);
    setEditingRecord(null);
    setFormValues(INITIAL_FORM);
    setFieldErrors({});
  }

  function updateField(field: FormField, value: string) {
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setErrorMessage(null);
  }

  // --------------------------------------------------
  // Native date picker
  // --------------------------------------------------

  function openDatePicker(field: DateField) {
    const currentValue = formValues[field];

    setDatePickerField(field);

    setSelectedDate(currentValue ? parseDate(currentValue) : new Date());

    if (Platform.OS === 'ios') {
      setIsIOSDatePickerVisible(true);
    }
  }

  /**
   * iOS:
   * Update the temporary selected date only.
   * The user must press Done to apply it to the form.
   *
   * Android:
   * Apply the selected date immediately.
   */
  function handleDateValueChange(_event: unknown, date: Date) {
    if (!date || !datePickerField) return;

    setSelectedDate(date);

    if (Platform.OS === 'android') {
      updateField(datePickerField, formatDate(date));
      setDatePickerField(null);
    }
  }

  function confirmIOSDate() {
    if (datePickerField) {
      updateField(datePickerField, formatDate(selectedDate));
    }

    setIsIOSDatePickerVisible(false);
    setDatePickerField(null);
  }

  function cancelIOSDatePicker() {
    setIsIOSDatePickerVisible(false);
    setDatePickerField(null);
  }

  function handleDateDismiss() {
    setDatePickerField(null);
    setIsIOSDatePickerVisible(false);
  }

  function clearDate(field: DateField) {
    updateField(field, '');
    setIsIOSDatePickerVisible(false);
    setDatePickerField(null);
  }

  // --------------------------------------------------
  // Save record
  // --------------------------------------------------

  async function handleSave() {
    if (!user?.id || isSaving) return;

    const result = trainerQualificationSchema.safeParse(formValues);

    if (!result.success) {
      const nextErrors: Partial<Record<FormField, string>> = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as FormField;

        if (!nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      });

      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (editingRecord) {
        await updateTrainerQualification(
          user.id,
          editingRecord.id,
          result.data,
        );
      } else {
        await createTrainerQualification(user.id, result.data);
      }

      // Refresh records after a successful save.
      const updatedRecords = await getTrainerQualifications(user.id);
      setRecords(updatedRecords);

      setIsModalVisible(false);
      setEditingRecord(null);
      setFormValues(INITIAL_FORM);
      setFieldErrors({});
      setDatePickerField(null);
      setIsIOSDatePickerVisible(false);

      setSuccessMessage(
        editingRecord
          ? 'Your record has been updated.'
          : 'Your record has been added.',
      );
    } catch (error) {
      console.error('[Trainer Qualifications] Failed to save:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save this record. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // --------------------------------------------------
  // Delete record
  // --------------------------------------------------

  function confirmDelete(record: TrainerQualification) {
    Alert.alert(
      'Delete record',
      `Are you sure you want to delete "${record.qualification_name}"? This action cannot be undone.`,
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
            setErrorMessage(null);
            setSuccessMessage(null);

            try {
              await deleteTrainerQualification(user.id, record.id);
              await loadRecords(false);

              setSuccessMessage('Your record has been deleted.');
            } catch (error) {
              console.error(
                '[Trainer Qualifications] Failed to delete:',
                error,
              );

              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to delete this record. Please try again.',
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }

  // --------------------------------------------------
  // Form fields
  // --------------------------------------------------

  function renderField(
    field: Exclude<FormField, 'category' | DateField>,
    label: string,
    placeholder: string,
    options?: {
      multiline?: boolean;
      maxLength?: number;
    },
  ) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
        </AppText>

        <TextInput
          value={formValues[field]}
          onChangeText={(value) => updateField(field, value)}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          editable={!isSaving}
          multiline={options?.multiline}
          maxLength={options?.maxLength}
          autoCapitalize="sentences"
          textAlignVertical={options?.multiline ? 'top' : 'center'}
          style={{
            minHeight: options?.multiline ? 90 : 54,
            borderWidth: 1,
            borderColor: fieldErrors[field]
              ? colors.text.error
              : colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
          }}
        />

        {fieldErrors[field] ? (
          <AppText variant="bodySmall" color={colors.text.error}>
            {fieldErrors[field]}
          </AppText>
        ) : null}
      </View>
    );
  }

  // --------------------------------------------------
  // Date fields
  // --------------------------------------------------

  function renderDateField(field: DateField) {
    const value = formValues[field];
    const label = DATE_FIELD_LABELS[field];

    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
          {field === 'expiryDate' ? ' (optional)' : ''}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${label}`}
          accessibilityHint="Opens the native date picker"
          disabled={isSaving}
          onPress={() => openDatePicker(field)}
          style={({ pressed }) => ({
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: fieldErrors[field]
              ? colors.text.error
              : colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background.secondary,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <AppText
            variant="body"
            color={value ? colors.text.primary : colors.text.tertiary}
          >
            {value ? formatDateForDisplay(value) : 'Select a date'}
          </AppText>

          <CalendarDays size={20} color={colors.text.secondary} />
        </Pressable>

        {value ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => clearDate(field)}
            disabled={isSaving}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: spacing.xs,
            }}
          >
            <AppText variant="caption" color={colors.brand.red}>
              CLEAR DATE
            </AppText>
          </Pressable>
        ) : null}

        {fieldErrors[field] ? (
          <AppText variant="bodySmall" color={colors.text.error}>
            {fieldErrors[field]}
          </AppText>
        ) : null}
      </View>
    );
  }

  // --------------------------------------------------
  // Record category selector
  // --------------------------------------------------

  function renderCategorySelector() {
    const categories: {
      value: TrainerQualificationCategory;
      label: string;
    }[] = [
      { value: 'qualification', label: 'Qualification' },
      { value: 'certification', label: 'Certification' },
    ];

    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          Record type
        </AppText>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {categories.map((category) => {
            const selected = formValues.category === category.value;

            return (
              <Pressable
                key={category.value}
                accessibilityRole="radio"
                accessibilityState={{
                  selected,
                  disabled: isSaving,
                }}
                disabled={isSaving}
                onPress={() =>
                  setFormValues((previous) => ({
                    ...previous,
                    category: category.value,
                  }))
                }
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected
                    ? colors.brand.red
                    : colors.border.default,
                  backgroundColor: selected
                    ? colors.background.secondary
                    : colors.background.primary,
                }}
              >
                <AppText
                  variant="button"
                  color={
                    selected ? colors.brand.red : colors.text.secondary
                  }
                >
                  {category.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // Certificate management
  // --------------------------------------------------

  async function handleUploadCertificate(record: TrainerQualification) {
    if (
      !user?.id ||
      uploadingId ||
      viewingId ||
      removingCertificateId
    ) {
      return;
    }

    setUploadingId(record.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    let uploadedPath: string | null = null;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      uploadedPath = await uploadTrainerCertificate(user.id, asset);

      await attachTrainerCertificate(
        user.id,
        record.id,
        uploadedPath,
      );

      // The new certificate is attached. Keep it if later cleanup fails.
      const newCertificatePath = uploadedPath;
      uploadedPath = null;

      // Remove the previous file only after the new file is attached.
      if (
        record.certificate_path &&
        record.certificate_path !== newCertificatePath
      ) {
        try {
          await deleteTrainerCertificateFile(record.certificate_path);
        } catch (cleanupError) {
          console.error(
            '[Trainer Qualifications] Previous certificate cleanup failed:',
            cleanupError,
          );
        }
      }

      const updatedRecords = await getTrainerQualifications(user.id);
      setRecords(updatedRecords);
      setSuccessMessage('Certificate uploaded successfully.');
    } catch (error) {
      console.error(
        '[Trainer Qualifications] Certificate upload failed:',
        error,
      );

      // If attaching failed, remove the newly uploaded orphaned file.
      if (uploadedPath) {
        try {
          await deleteTrainerCertificateFile(uploadedPath);
        } catch (cleanupError) {
          console.error(
            '[Trainer Qualifications] Uploaded file cleanup failed:',
            cleanupError,
          );
        }
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to upload this certificate. Please try again.',
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function handleViewCertificate(record: TrainerQualification) {
    if (
      !record.certificate_path ||
      viewingId ||
      uploadingId ||
      removingCertificateId
    ) {
      return;
    }

    setViewingId(record.id);
    setErrorMessage(null);

    try {
      const signedUrl = await getTrainerCertificateUrl(
        record.certificate_path,
      );

      await Linking.openURL(signedUrl);
    } catch (error) {
      console.error(
        '[Trainer Qualifications] Certificate viewing failed:',
        error,
      );

      setErrorMessage(
        'Unable to open this certificate. Please try again.',
      );
    } finally {
      setViewingId(null);
    }
  }

  function confirmRemoveCertificate(record: TrainerQualification) {
    if (!record.certificate_path) return;

    Alert.alert(
      'Remove certificate',
      `Are you sure you want to remove the certificate for "${record.qualification_name}"? Your qualification record will remain.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (
              !user?.id ||
              removingCertificateId ||
              uploadingId ||
              viewingId
            ) {
              return;
            }

            setRemovingCertificateId(record.id);
            setErrorMessage(null);
            setSuccessMessage(null);

            try {
              await removeTrainerCertificate(user.id, record.id);

              const updatedRecords = await getTrainerQualifications(
                user.id,
              );
              setRecords(updatedRecords);

              setSuccessMessage('Certificate removed successfully.');
            } catch (error) {
              console.error(
                '[Trainer Qualifications] Certificate removal failed:',
                error,
              );

              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to remove this certificate. Please try again.',
              );
            } finally {
              setRemovingCertificateId(null);
            }
          },
        },
      ],
    );
  }

  function renderCertificateActions(record: TrainerQualification) {
    const isUploading = uploadingId === record.id;
    const isViewing = viewingId === record.id;
    const isRemoving = removingCertificateId === record.id;

    const isBusy =
      isUploading ||
      isViewing ||
      isRemoving ||
      uploadingId !== null ||
      viewingId !== null ||
      removingCertificateId !== null;

    if (!record.certificate_path) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Upload certificate for ${record.qualification_name}`}
          accessibilityState={{
            disabled: isBusy,
            busy: isUploading,
          }}
          disabled={isBusy}
          onPress={() => void handleUploadCertificate(record)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            alignSelf: 'flex-start',
            paddingVertical: spacing.xs,
            opacity: isBusy && !isUploading ? 0.5 : 1,
          }}
        >
          {isUploading ? (
            <ActivityIndicator
              size="small"
              color={colors.brand.red}
            />
          ) : (
            <Upload size={16} color={colors.brand.red} />
          )}

          <AppText variant="button" color={colors.brand.red}>
            {isUploading ? 'UPLOADING...' : 'UPLOAD CERTIFICATE'}
          </AppText>
        </Pressable>
      );
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" color={colors.text.secondary}>
          Certificate attached
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View certificate for ${record.qualification_name}`}
            accessibilityState={{
              disabled: isBusy,
              busy: isViewing,
            }}
            disabled={isBusy}
            onPress={() => void handleViewCertificate(record)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.xs,
              opacity: isBusy && !isViewing ? 0.5 : 1,
            }}
          >
            {isViewing ? (
              <ActivityIndicator
                size="small"
                color={colors.brand.red}
              />
            ) : (
              <Eye size={16} color={colors.brand.red} />
            )}

            <AppText variant="button" color={colors.brand.red}>
              VIEW
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Replace certificate for ${record.qualification_name}`}
            accessibilityState={{
              disabled: isBusy,
              busy: isUploading,
            }}
            disabled={isBusy}
            onPress={() => void handleUploadCertificate(record)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.xs,
              opacity: isBusy && !isUploading ? 0.5 : 1,
            }}
          >
            {isUploading ? (
              <ActivityIndicator
                size="small"
                color={colors.brand.red}
              />
            ) : (
              <Upload size={16} color={colors.brand.red} />
            )}

            <AppText variant="button" color={colors.brand.red}>
              {isUploading ? 'UPLOADING...' : 'REPLACE'}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove certificate for ${record.qualification_name}`}
            accessibilityState={{
              disabled: isBusy,
              busy: isRemoving,
            }}
            disabled={isBusy}
            onPress={() => confirmRemoveCertificate(record)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.xs,
              opacity: isBusy && !isRemoving ? 0.5 : 1,
            }}
          >
            {isRemoving ? (
              <ActivityIndicator
                size="small"
                color={colors.text.error}
              />
            ) : (
              <Trash2 size={16} color={colors.text.error} />
            )}

            <AppText variant="button" color={colors.text.error}>
              REMOVE
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // Qualification / certification record card
  // --------------------------------------------------

  function renderRecord(record: TrainerQualification) {
    return (
      <View
        key={record.id}
        style={{
          padding: spacing.lg,
          gap: spacing.md,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border.default,
          backgroundColor: colors.background.secondary,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="h3" color={colors.text.primary}>
            {record.qualification_name}
          </AppText>

          {record.issuing_organisation ? (
            <AppText variant="bodySmall" color={colors.text.secondary}>
              {record.issuing_organisation}
            </AppText>
          ) : null}

          {record.date_obtained ? (
            <AppText variant="caption" color={colors.text.tertiary}>
              Obtained: {formatDateForDisplay(record.date_obtained)}
            </AppText>
          ) : null}

          {record.expiry_date ? (
            <AppText variant="caption" color={colors.text.tertiary}>
              Expires: {formatDateForDisplay(record.expiry_date)}
            </AppText>
          ) : null}
        </View>

        {renderCertificateActions(record)}

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border.default,
            paddingTop: spacing.md,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${record.qualification_name}`}
            disabled={
              deletingId === record.id ||
              uploadingId !== null ||
              viewingId !== null ||
              removingCertificateId !== null
            }
            onPress={() => openEdit(record)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.xs,
              paddingRight: spacing.md,
            }}
          >
            <Pencil size={16} color={colors.brand.red} />

            <AppText variant="button" color={colors.brand.red}>
              EDIT
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${record.qualification_name}`}
            disabled={
              deletingId === record.id ||
              uploadingId !== null ||
              viewingId !== null ||
              removingCertificateId !== null
            }
            onPress={() => confirmDelete(record)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.xs,
            }}
          >
            {deletingId === record.id ? (
              <ActivityIndicator
                size="small"
                color={colors.text.error}
              />
            ) : (
              <Trash2 size={16} color={colors.text.error} />
            )}

            <AppText variant="button" color={colors.text.error}>
              DELETE
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // Qualification / certification sections
  // --------------------------------------------------

  function renderSection(
    category: TrainerQualificationCategory,
    title: string,
    description: string,
  ) {
    const sectionRecords = records.filter(
      (record) => record.category === category,
    );

    return (
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="h2" color={colors.text.primary}>
            {title}
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            {description}
          </AppText>
        </View>

        {sectionRecords.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {sectionRecords.map(renderRecord)}
          </View>
        ) : (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border.default,
              borderStyle: 'dashed',
              gap: spacing.xs,
            }}
          >
            <AppText variant="body" color={colors.text.secondary}>
              No{' '}
              {category === 'qualification'
                ? 'qualifications'
                : 'certifications'}{' '}
              added yet.
            </AppText>

            <AppText variant="caption" color={colors.text.tertiary}>
              Add your details to help gym-goers understand your
              professional background.
            </AppText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${category}`}
          disabled={isSaving || isLoading}
          onPress={() => openCreate(category)}
          style={({ pressed }) => ({
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.brand.red,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Plus size={18} color={colors.brand.red} />

          <AppText variant="button" color={colors.brand.red}>
            ADD{' '}
            {category === 'qualification'
              ? 'QUALIFICATION'
              : 'CERTIFICATION'}
          </AppText>
        </Pressable>
      </View>
    );
  }

  // --------------------------------------------------
  // Screen
  // --------------------------------------------------

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Header - Consistent with Trainer Specialities */}
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
          Qualifications
        </AppText>
      </View>

      {/* Main Content */}
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
            TRAINER PROFILE
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Manage your credentials.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Showcase your professional education, qualifications and
            certifications. Keep your credentials up to date to help
            gym-goers understand your experience and expertise.
          </AppText>
        </View>

        {/* Error Message */}
        {errorMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.text.error,
              backgroundColor: colors.background.secondary,
              gap: spacing.sm,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => void loadRecords()}
              style={{
                alignSelf: 'flex-start',
                paddingTop: spacing.xs,
              }}
            >
              <AppText variant="button" color={colors.brand.red}>
                TRY AGAIN
              </AppText>
            </Pressable>
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

        {/* Loading State */}
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

            <AppText variant="body" color={colors.text.secondary}>
              Loading your qualifications...
            </AppText>
          </View>
        ) : (
          <>
            {/* Qualifications */}
            {renderSection(
              'qualification',
              'QUALIFICATIONS',
              'Add your education, professional training and relevant qualifications.',
            )}

            <View
              style={{
                height: 1,
                backgroundColor: colors.border.default,
              }}
            />

            {/* Certifications */}
            {renderSection(
              'certification',
              'CERTIFICATIONS',
              'List your professional certifications and recognised training credentials.',
            )}
          </>
        )}
      </ScrollView>

      {/* Add / Edit Record Modal */}
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
              <View style={{ gap: spacing.xs }}>
                <AppText variant="caption" color={colors.brand.red}>
                  TRAINER PROFILE
                </AppText>

                <AppText variant="h1" color={colors.text.primary}>
                  {editingRecord ? 'Edit record.' : 'Add a record.'}
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Enter the details of your qualification or certification.
                </AppText>
              </View>

              {renderCategorySelector()}

              {renderField(
                'qualificationName',
                'Qualification or Certification Name',
                'e.g. Personal Training Level 3',
                { maxLength: 200 },
              )}

              {renderField(
                'issuingOrganisation',
                'Issuing Organisation',
                'e.g. YMCA Awards',
                { maxLength: 200 },
              )}

              {renderDateField('dateObtained')}

              {renderDateField('expiryDate')}

              {/* iOS Native Date Picker */}
              {Platform.OS === 'ios' &&
                isIOSDatePickerVisible &&
                datePickerField && (
                  <View
                    style={{
                      padding: spacing.md,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      backgroundColor: colors.background.secondary,
                      gap: spacing.sm,
                    }}
                  >
                    <AppText variant="body" color={colors.text.primary}>
                      Select{' '}
                      {DATE_FIELD_LABELS[
                        datePickerField
                      ].toLowerCase()}
                    </AppText>

                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onValueChange={handleDateValueChange}
                      onDismiss={handleDateDismiss}
                      style={{ alignSelf: 'stretch' }}
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          if (datePickerField) {
                            clearDate(datePickerField);
                          }
                        }}
                        style={{ padding: spacing.sm }}
                      >
                        <AppText
                          variant="button"
                          color={colors.text.error}
                        >
                          CLEAR
                        </AppText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={confirmIOSDate}
                        style={{ padding: spacing.sm }}
                      >
                        <AppText
                          variant="button"
                          color={colors.brand.red}
                        >
                          DONE
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                )}

              <AppText variant="caption" color={colors.text.tertiary}>
                Select dates using your device&apos;s native date picker.
                Expiry date is optional.
              </AppText>

              {/* Modal Error */}
              {errorMessage ? (
                <AppText
                  variant="bodySmall"
                  color={colors.text.error}
                  accessibilityRole="alert"
                >
                  {errorMessage}
                </AppText>
              ) : null}

              {/* Save Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isSaving,
                  busy: isSaving,
                }}
                disabled={isSaving}
                onPress={() => void handleSave()}
                style={({ pressed }) => ({
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: colors.brand.red,
                  opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                })}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppText variant="button" color="#FFFFFF">
                    {editingRecord ? 'SAVE CHANGES' : 'ADD RECORD'}
                  </AppText>
                )}
              </Pressable>

              {/* Cancel Button */}
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
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

      {/* Android Native Date Dialog */}
      {Platform.OS === 'android' &&
        isModalVisible &&
        datePickerField && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onValueChange={handleDateValueChange}
            onDismiss={handleDateDismiss}
          />
        )}
    </SafeAreaView>
  );
}
