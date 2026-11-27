import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/providers/AuthProvider';
import {
  createFitnessProgress,
  deleteFitnessProgress,
  getFitnessProgress,
  updateFitnessProgress,
  type CreateFitnessProgressInput,
  type FitnessMetricType,
  type FitnessMetricUnit,
  type FitnessProgress,
} from '@/services/fitness-progress';
import { useTrainrTheme } from '@/theme';

type MeasurementOption = {
  label: string;
  value: FitnessMetricType;
  units: FitnessMetricUnit[];
};

type ChartPeriod = '7d' | '30d' | '90d' | 'all';

const MEASUREMENTS: MeasurementOption[] = [
  { label: 'Body weight', value: 'body_weight', units: ['kg', 'lb'] },
  { label: 'Chest', value: 'chest', units: ['cm', 'in'] },
  { label: 'Waist', value: 'waist', units: ['cm', 'in'] },
  { label: 'Hips', value: 'hips', units: ['cm', 'in'] },
  { label: 'Arms', value: 'arm', units: ['cm', 'in'] },
  { label: 'Thighs', value: 'thigh', units: ['cm', 'in'] },
];

const PERIODS: { label: string; value: ChartPeriod; days: number | null }[] = [
  { label: '7D', value: '7d', days: 7 },
  { label: '30D', value: '30d', days: 30 },
  { label: '90D', value: '90d', days: 90 },
  { label: 'All', value: 'all', days: null },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function metricLabel(metric: FitnessMetricType) {
  return MEASUREMENTS.find((item) => item.value === metric)?.label ?? metric;
}

function convertMeasurementUnit(
  value: number,
  from: FitnessMetricUnit,
  to: FitnessMetricUnit,
): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'lb') return value * 2.2046226218;
  if (from === 'lb' && to === 'kg') return value / 2.2046226218;
  if (from === 'cm' && to === 'in') return value / 2.54;
  if (from === 'in' && to === 'cm') return value * 2.54;
  return value;
}

function ProgressChart({
  records,
  period,
  displayUnit,
  colors,
  spacing,
}: {
  records: FitnessProgress[];
  period: ChartPeriod;
  displayUnit: FitnessMetricUnit | null;
  colors: ReturnType<typeof useTrainrTheme>['colors'];
  spacing: ReturnType<typeof useTrainrTheme>['spacing'];
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const selectedPeriod = PERIODS.find((item) => item.value === period);
  const cutoff = selectedPeriod?.days
    ? Date.now() - selectedPeriod.days * 24 * 60 * 60 * 1000
    : null;

  const chartRecords = useMemo(
    () =>
      [...records]
        .filter((record) => !cutoff || new Date(record.recorded_at).getTime() >= cutoff)
        .map((record) => ({
          ...record,
          value:
            displayUnit && record.unit !== displayUnit
              ? convertMeasurementUnit(record.value, record.unit, displayUnit)
              : record.value,
        }))
        .sort(
          (a, b) =>
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
        )
        .slice(-30),
    [records, cutoff, displayUnit],
  );

  const chartHeight = 180;
  const horizontalPadding = 18;
  const verticalPadding = 22;

  if (chartRecords.length < 2) {
    return (
      <View
        style={{
          minHeight: 145,
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
        }}
      >
        <TrendingUp size={28} color={colors.text.tertiary} />
        <AppText
          variant="bodySmall"
          color={colors.text.secondary}
          style={{ textAlign: 'center' }}
        >
          Record at least two measurements in this period to see your trend.
        </AppText>
      </View>
    );
  }

  const values = chartRecords.map((record) => record.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const points = chartRecords.map((record, index) => ({
    x:
      horizontalPadding +
      (index / (chartRecords.length - 1)) *
        Math.max(chartWidth - horizontalPadding * 2, 1),
    y:
      chartHeight -
      verticalPadding -
      ((record.value - minValue) / valueRange) *
        (chartHeight - verticalPadding * 2),
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
      {chartWidth > 0 ? (
        <>
          <Svg width={chartWidth} height={chartHeight}>
            {[0, 0.5, 1].map((position) => {
              const y =
                verticalPadding + position * (chartHeight - verticalPadding * 2);

              return (
                <Line
                  key={position}
                  x1={horizontalPadding}
                  y1={y}
                  x2={chartWidth - horizontalPadding}
                  y2={y}
                  stroke={colors.border.default}
                  strokeWidth={1}
                  strokeDasharray="4 5"
                />
              );
            })}
            <Path
              d={linePath}
              fill="none"
              stroke={colors.brand.red}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point, index) => (
              <Circle
                key={chartRecords[index].id}
                cx={point.x}
                cy={point.y}
                r={5}
                fill={colors.brand.red}
                stroke={colors.background.secondary}
                strokeWidth={2}
              />
            ))}
          </Svg>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.xs,
            }}
          >
            <AppText variant="caption" color={colors.text.tertiary}>
              {formatDate(chartRecords[0].recorded_at)}
            </AppText>
            <AppText variant="caption" color={colors.text.tertiary}>
              {formatDate(chartRecords[chartRecords.length - 1].recorded_at)}
            </AppText>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function PersonalProgressScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<FitnessProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedMetric, setSelectedMetric] =
    useState<FitnessMetricType>('body_weight');
  const [period, setPeriod] = useState<ChartPeriod>('30d');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FitnessProgress | null>(null);
  const [metricType, setMetricType] =
    useState<FitnessMetricType>('body_weight');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<FitnessMetricUnit>('kg');
  const [recordedDate, setRecordedDate] = useState(toDateInput(new Date()));
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!user?.id) {
      setErrorMessage('Please sign in to view your fitness progress.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      setRecords(await getFitnessProgress());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load your fitness progress.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress]),
  );

  const metricRecords = useMemo(
    () => records.filter((record) => record.metric_type === selectedMetric),
    [records, selectedMetric],
  );

  const latestRecord = metricRecords[0] ?? null;

  function openAddModal() {
    const option = MEASUREMENTS.find((item) => item.value === selectedMetric)!;
    setEditingRecord(null);
    setMetricType(selectedMetric);
    setValue('');
    setUnit(option.units[0]);
    setRecordedDate(toDateInput(new Date()));
    setNotes('');
    setShowDatePicker(false);
    setIsModalVisible(true);
  }

  function openEditModal(record: FitnessProgress) {
    setEditingRecord(record);
    setMetricType(record.metric_type);
    setValue(String(record.value));
    setUnit(record.unit);
    setRecordedDate(toDateInput(new Date(record.recorded_at)));
    setNotes(record.notes ?? '');
    setShowDatePicker(false);
    setIsModalVisible(true);
  }

  function handleMetricChange(nextMetric: FitnessMetricType) {
    setMetricType(nextMetric);
    const option = MEASUREMENTS.find((item) => item.value === nextMetric)!;
    setUnit(option.units[0]);
  }

  async function handleSave() {
    if (isSaving) return;

    const parsedValue = Number(value);
    if (!value.trim() || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      Alert.alert('Invalid measurement', 'Enter a number greater than zero.');
      return;
    }

    if (notes.trim().length > 1000) {
      Alert.alert('Notes too long', 'Notes must be 1,000 characters or fewer.');
      return;
    }

    setIsSaving(true);

    try {
      const input: CreateFitnessProgressInput = {
        metricType,
        value: parsedValue,
        unit,
        recordedAt: recordedDate,
        notes: notes.trim() || null,
      };

      if (editingRecord) {
        await updateFitnessProgress(editingRecord.id, input);
      } else {
        await createFitnessProgress(input);
      }

      setIsModalVisible(false);
      setEditingRecord(null);
      await loadProgress();

      Alert.alert(
        editingRecord ? 'Measurement updated' : 'Measurement recorded',
        'Your fitness progress has been saved.',
      );
    } catch (error) {
      Alert.alert(
        'Unable to save measurement',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(record: FitnessProgress) {
    Alert.alert(
      'Delete measurement?',
      `Delete your ${metricLabel(record.metric_type).toLowerCase()} record from ${formatDate(record.recorded_at)}? This cannot be undone.`,
      [
        { text: 'Keep record', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFitnessProgress(record.id);
              await loadProgress();
            } catch (error) {
              Alert.alert(
                'Unable to delete measurement',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  const selectedOption = MEASUREMENTS.find((item) => item.value === metricType)!;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
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
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>
        <AppText variant="h2" color={colors.text.primary}>
          My Progress
        </AppText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl + insets.bottom + 100,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL FITNESS
          </AppText>
          <AppText variant="h1" color={colors.text.primary}>
            Track your progress.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Record body measurements and follow your changes over time.
          </AppText>
        </View>

        {isLoading ? (
          <Card variant="outlined" style={{ padding: spacing.xl, gap: spacing.md }}>
            <ActivityIndicator color={colors.brand.red} />
            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading your measurements...
            </AppText>
          </Card>
        ) : errorMessage ? (
          <Card variant="outlined" style={{ padding: spacing.lg, gap: spacing.md }}>
            <AppText variant="body" color={colors.text.error}>
              {errorMessage}
            </AppText>
            <Button variant="outline" onPress={() => void loadProgress()} fullWidth>
              Try again
            </Button>
          </Card>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="h3" color={colors.text.primary}>
                MEASUREMENTS
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {MEASUREMENTS.map((item) => {
                  const selected = selectedMetric === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedMetric(item.value)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.brand.red
                          : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.red
                          : colors.background.secondary,
                      }}
                    >
                      <AppText
                        variant="bodySmall"
                        color={selected ? '#FFFFFF' : colors.text.primary}
                      >
                        {item.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Card variant="outlined" style={{ padding: spacing.lg, gap: spacing.sm }}>
              <AppText variant="caption" color={colors.text.secondary}>
                LATEST {metricLabel(selectedMetric).toUpperCase()}
              </AppText>
              {latestRecord ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                    <AppText variant="displayLarge" color={colors.text.primary}>
                      {latestRecord.value}
                    </AppText>
                    <AppText variant="h3" color={colors.text.secondary}>
                      {latestRecord.unit}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.text.tertiary}>
                    Recorded {formatDate(latestRecord.recorded_at)}
                  </AppText>
                </>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="h3" color={colors.text.primary}>
                    No measurement yet
                  </AppText>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Record your first {metricLabel(selectedMetric).toLowerCase()} measurement to start tracking.
                  </AppText>
                </View>
              )}
            </Card>

            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="h3" color={colors.text.primary}>
                  PROGRESS TREND
                </AppText>
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Measurements are shown in their recorded units. Select a period to review your history.
                </AppText>
              </View>
              <Card variant="outlined" style={{ padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {PERIODS.map((item) => {
                    const selected = period === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setPeriod(item.value)}
                        style={{
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.xs,
                          borderRadius: 18,
                          backgroundColor: selected
                            ? colors.brand.red
                            : colors.background.secondary,
                        }}
                      >
                        <AppText
                          variant="caption"
                          color={selected ? '#FFFFFF' : colors.text.secondary}
                        >
                          {item.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <ProgressChart
                  records={metricRecords}
                  period={period}
                  displayUnit={latestRecord?.unit ?? null}
                  colors={colors}
                  spacing={spacing}
                />
                {latestRecord ? (
                  <AppText variant="caption" color={colors.text.tertiary}>
                    Chart values are converted to {latestRecord.unit} for comparison.
                  </AppText>
                ) : null}
              </Card>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="h3" color={colors.text.primary}>
                  MEASUREMENT HISTORY
                </AppText>
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Review, edit or remove your previous records.
                </AppText>
              </View>

              {metricRecords.length === 0 ? (
                <Card
                  variant="outlined"
                  style={{
                    padding: spacing.xl,
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <Scale size={32} color={colors.text.tertiary} />
                  <AppText variant="bodyMedium" color={colors.text.primary}>
                    No records yet
                  </AppText>
                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                    style={{ textAlign: 'center' }}
                  >
                    Your {metricLabel(selectedMetric).toLowerCase()} measurements will appear here.
                  </AppText>
                </Card>
              ) : (
                metricRecords.map((record) => (
                  <Card
                    key={record.id}
                    variant="outlined"
                    style={{ padding: spacing.lg, gap: spacing.md }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing.md,
                      }}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText variant="h3" color={colors.text.primary}>
                          {record.value} {record.unit}
                        </AppText>
                        <AppText variant="caption" color={colors.text.secondary}>
                          {formatDate(record.recorded_at)}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit measurement from ${formatDate(record.recorded_at)}`}
                          onPress={() => openEditModal(record)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.background.secondary,
                          }}
                        >
                          <Pencil size={17} color={colors.brand.red} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete measurement from ${formatDate(record.recorded_at)}`}
                          onPress={() => confirmDelete(record)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.background.secondary,
                          }}
                        >
                          <Trash2 size={17} color={colors.text.error} />
                        </Pressable>
                      </View>
                    </View>
                    {record.notes ? (
                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {record.notes}
                      </AppText>
                    ) : null}
                  </Card>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {!isLoading && !errorMessage ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: colors.background.primary,
            borderTopWidth: 1,
            borderTopColor: colors.border.default,
          }}
        >
          <Button
            variant="primary"
            size="large"
            fullWidth
            leftIcon={<Plus size={19} color="#FFFFFF" />}
            onPress={openAddModal}
          >
            Record measurement
          </Button>
        </View>
      ) : null}

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView
          edges={['top', 'bottom']}
          style={{ flex: 1, backgroundColor: colors.background.primary }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: spacing.xs }}>
              <AppText variant="caption" color={colors.brand.red}>
                FITNESS PROGRESS
              </AppText>
              <AppText variant="h1" color={colors.text.primary}>
                {editingRecord ? 'EDIT MEASUREMENT' : 'RECORD MEASUREMENT'}
              </AppText>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Select a measurement, enter its value and choose the date recorded.
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Measurement type
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {MEASUREMENTS.map((item) => {
                  const selected = metricType === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => handleMetricChange(item.value)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.brand.red
                          : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.red
                          : colors.background.secondary,
                      }}
                    >
                      <AppText
                        variant="bodySmall"
                        color={selected ? '#FFFFFF' : colors.text.primary}
                      >
                        {item.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label={selectedOption.label}
              placeholder="Enter measurement"
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              helperText="Enter a positive number."
            />

            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Unit
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {selectedOption.units.map((item) => {
                  const selected = unit === item;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setUnit(item)}
                      style={{
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.brand.red
                          : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.red
                          : colors.background.secondary,
                      }}
                    >
                      <AppText
                        variant="bodyMedium"
                        color={selected ? '#FFFFFF' : colors.text.primary}
                      >
                        {item}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Date recorded
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowDatePicker((current) => !current)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  borderRadius: 12,
                  padding: spacing.md,
                }}
              >
                <AppText variant="body" color={colors.text.primary}>
                  {formatDate(recordedDate)}
                </AppText>
                <CalendarDays size={19} color={colors.text.secondary} />
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={parseDateInput(recordedDate)}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setRecordedDate(toDateInput(selectedDate));
                    }
                  }}
                />
              ) : null}
            </View>

            <Input
              label="Notes (optional)"
              placeholder="Add any details about this measurement"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <Button
              variant="primary"
              size="large"
              fullWidth
              loading={isSaving}
              disabled={isSaving}
              onPress={() => void handleSave()}
            >
              {editingRecord ? 'Save changes' : 'Save measurement'}
            </Button>
            <Button
              variant="outline"
              size="large"
              fullWidth
              disabled={isSaving}
              onPress={() => setIsModalVisible(false)}
            >
              Cancel
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
