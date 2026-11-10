
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Plus,
  Scale,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, {
  Circle,
  Line,
  Path,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/providers/AuthProvider';
import {
  createFitnessProgress,
  getBodyWeightHistory,
  updateBodyWeight,
  type FitnessProgress,
} from '@/services/fitness-progress';
import { useTrainrTheme } from '@/theme';

type WeightUnit = 'kg' | 'lb';

function formatWeightDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function WeightTrendChart({
  records,
  unit,
  colors,
  spacing,
}: {
  records: FitnessProgress[];
  unit: WeightUnit;
  colors: ReturnType<typeof useTrainrTheme>['colors'];
  spacing: ReturnType<typeof useTrainrTheme>['spacing'];
}) {
  const [chartWidth, setChartWidth] = useState(0);

  const chartHeight = 190;
  const horizontalPadding = 18;
  const verticalPadding = 24;

  const chartRecords = useMemo(
    () =>
      [...records]
        .reverse()
        .filter((record) => record.unit === unit)
        .slice(-7),
    [records, unit],
  );

  if (chartRecords.length < 2) {
    return (
      <View
        style={{
          minHeight: 150,
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
          Record at least two measurements in {unit} to see your weight trend.
        </AppText>
      </View>
    );
  }

  const values = chartRecords.map((record) => record.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const points = chartRecords.map((record, index) => {
    const x =
      horizontalPadding +
      (index / (chartRecords.length - 1)) *
        Math.max(chartWidth - horizontalPadding * 2, 1);

    const y =
      chartHeight -
      verticalPadding -
      ((record.value - minValue) / valueRange) *
        (chartHeight - verticalPadding * 2);

    return { x, y };
  });

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ');

  return (
    <View
      onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      style={{ width: '100%' }}
    >
      {chartWidth > 0 ? (
        <>
          <Svg width={chartWidth} height={chartHeight}>
            {[0, 0.5, 1].map((position) => {
              const y =
                verticalPadding +
                position * (chartHeight - verticalPadding * 2);

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
            <AppText
              variant="caption"
              color={colors.text.tertiary}
            >
              {formatWeightDate(chartRecords[0].recorded_at)}
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
            >
              {formatWeightDate(
                chartRecords[chartRecords.length - 1].recorded_at,
              )}
            </AppText>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function WeightHistoryScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [records, setRecords] = useState<FitnessProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<FitnessProgress | null>(null);

  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [recordedDate, setRecordedDate] = useState(
    formatInputDate(new Date()),
  );
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const currentWeight = records[0] ?? null;
  const previousWeight = records[1] ?? null;

  const weightDifference =
    currentWeight &&
    previousWeight &&
    currentWeight.unit === previousWeight.unit
      ? currentWeight.value - previousWeight.value
      : null;

  const loadHistory = useCallback(async () => {
    if (!user?.id) {
      setErrorMessage('Please sign in to view your weight history.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getBodyWeightHistory();
      setRecords(result);
    } catch (error) {
      console.error('[Weight History] Unable to load history:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load your weight history.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  function openAddModal() {
    setEditingRecord(null);
    setWeight('');
    setUnit(currentWeight?.unit === 'lb' ? 'lb' : 'kg');
    setRecordedDate(formatInputDate(new Date()));
    setNotes('');
    setShowDatePicker(false);
    setIsModalVisible(true);
  }

  function openEditModal(record: FitnessProgress) {
    setEditingRecord(record);
    setWeight(String(record.value));
    setUnit(record.unit as WeightUnit);
    setRecordedDate(formatInputDate(new Date(record.recorded_at)));
    setNotes(record.notes ?? '');
    setShowDatePicker(false);
    setIsModalVisible(true);
  }

  async function handleSaveWeight() {
    if (isSaving) return;

    const parsedWeight = Number(weight);

    if (
      !weight.trim() ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0
    ) {
      Alert.alert(
        'Invalid weight',
        'Please enter a valid weight greater than zero.',
      );
      return;
    }

    if (notes.trim().length > 1000) {
      Alert.alert(
        'Notes too long',
        'Notes must be 1,000 characters or fewer.',
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const input = {
        value: parsedWeight,
        unit,
        recordedAt: recordedDate,
        notes: notes.trim() || null,
      };

      if (editingRecord) {
        await updateBodyWeight(editingRecord.id, input);
      } else {
        await createFitnessProgress({
          metricType: 'body_weight',
          ...input,
        });
      }

      setIsModalVisible(false);
      setEditingRecord(null);

      await loadHistory();

      Alert.alert(
        editingRecord ? 'Weight updated' : 'Weight recorded',
        editingRecord
          ? 'Your weight measurement has been updated.'
          : 'Your new weight measurement has been saved.',
      );
    } catch (error) {
      console.error('[Weight History] Unable to save weight:', error);

      Alert.alert(
        'Unable to save weight',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const borderColor = colors.border.default;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.xs,
            }}
          >
            <ArrowLeft size={20} color={colors.text.primary} />

            <AppText
              variant="bodySmall"
              color={colors.text.secondary}
            >
              Back
            </AppText>
          </Pressable>

          <View style={{ gap: spacing.xs }}>
            <AppText
              variant="caption"
              color={colors.brand.red}
            >
              YOUR PROGRESS
            </AppText>

            <AppText
              variant="displayLarge"
              color={colors.text.primary}
            >
              WEIGHT HISTORY.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
            >
              Monitor your weight changes and track your fitness journey.
            </AppText>
          </View>
        </View>

        {/* Loading State */}
        {isLoading ? (
          <Card variant="outlined" style={{ padding: spacing.lg }}>
            <AppText
              variant="body"
              color={colors.text.secondary}
            >
              Loading your weight history...
            </AppText>
          </Card>
        ) : errorMessage ? (
          /* Error State */
          <Card
            variant="outlined"
            style={{ padding: spacing.lg, gap: spacing.md }}
          >
            <AppText
              variant="body"
              color={colors.text.error}
            >
              {errorMessage}
            </AppText>

            <Button
              variant="outline"
              onPress={() => void loadHistory()}
              fullWidth
            >
              Try again
            </Button>
          </Card>
        ) : (
          <>
            {/* Current Weight */}
            <Card
              variant="outlined"
              style={{
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText
                  variant="caption"
                  color={colors.text.secondary}
                >
                  CURRENT WEIGHT
                </AppText>

                <Scale size={20} color={colors.brand.red} />
              </View>

              {currentWeight ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      gap: spacing.sm,
                    }}
                  >
                    <AppText
                      variant="displayLarge"
                      color={colors.text.primary}
                    >
                      {currentWeight.value}
                    </AppText>

                    <AppText
                      variant="h3"
                      color={colors.text.secondary}
                    >
                      {currentWeight.unit}
                    </AppText>
                  </View>

                  <AppText
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    Last recorded {formatWeightDate(currentWeight.recorded_at)}
                  </AppText>

                  {weightDifference !== null ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                      }}
                    >
                      <TrendingUp
                        size={16}
                        color={
                          weightDifference === 0
                            ? colors.text.secondary
                            : colors.brand.red
                        }
                      />

                      <AppText
                        variant="bodySmall"
                        color={colors.text.secondary}
                      >
                        {weightDifference > 0 ? '+' : ''}
                        {weightDifference.toFixed(1)} {currentWeight.unit} since previous measurement
                      </AppText>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <AppText
                    variant="h3"
                    color={colors.text.primary}
                  >
                    No weight recorded yet
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                  >
                    Add your first measurement to start tracking your progress.
                  </AppText>
                </View>
              )}
            </Card>

            {/* Weight Trend */}
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText
                  variant="h2"
                  color={colors.text.primary}
                >
                  WEIGHT TREND
                </AppText>

                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                >
                  Your latest seven measurements in the selected unit.
                </AppText>
              </View>

              <Card
                variant="outlined"
                style={{
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                {records.length > 0 ? (
                  <WeightTrendChart
                    records={records}
                    unit={currentWeight?.unit === 'lb' ? 'lb' : 'kg'}
                    colors={colors}
                    spacing={spacing}
                  />
                ) : (
                  <View
                    style={{
                      minHeight: 140,
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <TrendingUp
                      size={30}
                      color={colors.text.tertiary}
                    />

                    <AppText
                      variant="bodySmall"
                      color={colors.text.secondary}
                      style={{ textAlign: 'center' }}
                    >
                      Your weight trend will appear here once you record measurements.
                    </AppText>
                  </View>
                )}
              </Card>
            </View>

            {/* Weight Records */}
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText
                  variant="h2"
                  color={colors.text.primary}
                >
                  ALL MEASUREMENTS
                </AppText>

                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                >
                  Review and edit your previous weight records.
                </AppText>
              </View>

              {records.length === 0 ? (
                <Card
                  variant="outlined"
                  style={{
                    alignItems: 'center',
                    padding: spacing.xl,
                    gap: spacing.md,
                  }}
                >
                  <Scale size={34} color={colors.text.tertiary} />

                  <AppText
                    variant="h3"
                    color={colors.text.primary}
                  >
                    NO MEASUREMENTS YET
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                    style={{ textAlign: 'center' }}
                  >
                    Your recorded weight measurements will appear here.
                  </AppText>
                </Card>
              ) : (
                records.map((record) => (
                  <Card
                    key={record.id}
                    variant="outlined"
                    style={{
                      padding: spacing.lg,
                      gap: spacing.md,
                    }}
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
                        <AppText
                          variant="h3"
                          color={colors.text.primary}
                        >
                          {record.value} {record.unit}
                        </AppText>

                        <AppText
                          variant="caption"
                          color={colors.text.secondary}
                        >
                          {formatWeightDate(record.recorded_at)}
                        </AppText>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit weight record from ${formatWeightDate(record.recorded_at)}`}
                        onPress={() => openEditModal(record)}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.background.secondary,
                        }}
                      >
                        <Pencil
                          size={17}
                          color={colors.brand.red}
                        />
                      </Pressable>
                    </View>

                    {record.notes ? (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: borderColor,
                          paddingTop: spacing.md,
                        }}
                      >
                        <AppText
                          variant="bodySmall"
                          color={colors.text.secondary}
                        >
                          {record.notes}
                        </AppText>
                      </View>
                    ) : null}
                  </Card>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed Add Weight Action */}
      {!isLoading && !errorMessage ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
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
            style={{ minHeight: 56, borderRadius: 12 }}
          >
            Record Weight
          </Button>
        </View>
      ) : null}

      {/* Add / Edit Measurement Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView
          edges={['top', 'bottom']}
          style={{
            flex: 1,
            backgroundColor: colors.background.primary,
          }}
        >
          {/* Scrollable Form Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: spacing.xs }}>
              <AppText
                variant="caption"
                color={colors.brand.red}
              >
                FITNESS PROGRESS
              </AppText>

              <AppText
                variant="h1"
                color={colors.text.primary}
              >
                {editingRecord ? 'EDIT WEIGHT' : 'RECORD WEIGHT'}
              </AppText>

              <AppText
                variant="bodySmall"
                color={colors.text.secondary}
              >
                Enter your measurement and the date it was recorded.
              </AppText>
            </View>

            {/* Weight Input */}
            <Input
              label="Weight"
              placeholder="Enter your weight"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              helperText="Enter a positive number."
            />

            {/* Unit Selection */}
            <View style={{ gap: spacing.sm }}>
              <AppText
                variant="label"
                color={colors.text.primary}
              >
                Unit
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                }}
              >
                {(['kg', 'lb'] as const).map((option) => {
                  const selected = unit === option;

                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setUnit(option)}
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
                          ? colors.brand.redLight
                          : colors.background.secondary,
                      }}
                    >
                      <AppText
                        variant="button"
                        color={
                          selected
                            ? colors.brand.red
                            : colors.text.secondary
                        }
                      >
                        {option.toUpperCase()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Measurement Date */}
            <View style={{ gap: spacing.sm }}>
              <AppText
                variant="label"
                color={colors.text.primary}
              >
                Measurement date
              </AppText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose measurement date"
                onPress={() => setShowDatePicker(true)}
                style={{
                  minHeight: 54,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <AppText
                  variant="body"
                  color={colors.text.primary}
                >
                  {formatWeightDate(
                    parseInputDate(recordedDate).toISOString(),
                  )}
                </AppText>

                <CalendarDays
                  size={19}
                  color={colors.text.secondary}
                />
              </Pressable>

              {showDatePicker ? (
                <DateTimePicker
                  value={parseInputDate(recordedDate)}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);

                    if (event.type === 'set' && selectedDate) {
                      setRecordedDate(formatInputDate(selectedDate));
                    }
                  }}
                />
              ) : null}
            </View>

            {/* Notes */}
            <Input
              label="Notes (optional)"
              placeholder="Add any notes about this measurement..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              maxLength={1000}
              textAlignVertical="top"
              style={{
                minHeight: 100,
                paddingTop: spacing.md,
              }}
            />
          </ScrollView>

          {/* Fixed Bottom Actions */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              gap: spacing.sm,
              backgroundColor: colors.background.primary,
              borderTopWidth: 1,
              borderTopColor: colors.border.default,
            }}
          >
            <Button
              variant="primary"
              size="large"
              fullWidth
              loading={isSaving}
              disabled={isSaving}
              onPress={() => void handleSaveWeight()}
              style={{
                minHeight: 56,
                borderRadius: 12,
              }}
            >
              {editingRecord ? 'Save Changes' : 'Save Weight'}
            </Button>

            <Button
              variant="ghost"
              size="large"
              fullWidth
              disabled={isSaving}
              onPress={() => setIsModalVisible(false)}
              style={{
                minHeight: 48,
              }}
            >
              Cancel
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
