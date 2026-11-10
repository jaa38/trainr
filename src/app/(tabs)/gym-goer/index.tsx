
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  Minus,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Line,
  Path,
} from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useAuth } from '@/providers/AuthProvider';
import {
  getBodyWeightHistory,
  type FitnessProgress,
} from '@/services/fitness-progress';
import { useTrainrTheme } from '@/theme';

function formatWeightDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DashboardWeightChart({
  records,
  unit,
  colors,
}: {
  records: FitnessProgress[];
  unit: 'kg' | 'lb';
  colors: ReturnType<typeof useTrainrTheme>['colors'];
}) {
  const [chartWidth, setChartWidth] = useState(0);

  const chartHeight = 125;
  const horizontalPadding = 12;
  const verticalPadding = 16;

  const chartRecords = useMemo(
    () =>
      [...records]
        .filter((record) => record.unit === unit)
        .reverse()
        .slice(-7),
    [records, unit],
  );

  if (chartRecords.length < 2) {
    return (
      <View
        style={{
          minHeight: 90,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TrendingUp
          size={24}
          color={colors.text.tertiary}
        />

        <AppText
          variant="caption"
          color={colors.text.secondary}
        >
          Record another measurement to see your weight trend.
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
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ');

  return (
    <View
      onLayout={(event) =>
        setChartWidth(event.nativeEvent.layout.width)
      }
      style={{ width: '100%' }}
    >
      {chartWidth > 0 ? (
        <Svg
          width={chartWidth}
          height={chartHeight}
        >
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
              r={4}
              fill={colors.brand.red}
              stroke={colors.background.secondary}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

export default function HomeTabScreen() {
  const { colors, spacing, mode } = useTrainrTheme();
  const { user } = useAuth();

  const [weightRecords, setWeightRecords] = useState<FitnessProgress[]>([]);
  const [isLoadingWeight, setIsLoadingWeight] = useState(true);
  const [weightError, setWeightError] = useState<string | null>(null);

  const loadWeightProgress = useCallback(async () => {
    if (!user?.id) {
      setWeightRecords([]);
      setIsLoadingWeight(false);
      return;
    }

    setIsLoadingWeight(true);
    setWeightError(null);

    try {
      const result = await getBodyWeightHistory();
      setWeightRecords(result);
    } catch (error) {
      console.error(
        '[Home] Unable to load weight progress:',
        error,
      );

      setWeightError(
        error instanceof Error
          ? error.message
          : 'Unable to load your weight progress.',
      );
    } finally {
      setIsLoadingWeight(false);
    }
  }, [user?.id]);

  // Refresh progress whenever the Home screen regains focus.
  useFocusEffect(
    useCallback(() => {
      void loadWeightProgress();
    }, [loadWeightProgress]),
  );

  const currentWeight = weightRecords[0] ?? null;
  const previousWeight = weightRecords[1] ?? null;

  const weightDifference =
    currentWeight &&
      previousWeight &&
      currentWeight.unit === previousWeight.unit
      ? currentWeight.value - previousWeight.value
      : null;

  const appIcon =
    mode === 'dark'
      ? require('../../../../assets/images/icons/darkModeAppIcon.png')
      : require('../../../../assets/images/icons/lightModeAppIcon.png');

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xxxl,
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              YOUR FITNESS. YOUR JOURNEY.
            </AppText>
          </View>

          {/* Theme-aware App Icon */}
          <Image
            source={appIcon}
            accessibilityLabel="TRAINR app icon"
            resizeMode="contain"
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
            }}
          />
        </View>

        {/* Welcome Section */}
        <View
          style={{
            gap: spacing.sm,
            marginBottom: spacing.xl,
          }}
        >
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            YOUR NEXT CHAPTER
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            WELCOME
          </AppText>

          <AppText variant="displayLarge" color={colors.brand.red}>
            BACK.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{
              lineHeight: 24,
              marginTop: spacing.xs,
            }}
          >
            Your fitness journey continues here. Stay focused, keep showing up, and make
            every session count.
          </AppText>
        </View>

        {/* Fitness Progress */}
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <AppText
                variant="caption"
                color={colors.brand.red}
              >
                YOUR JOURNEY
              </AppText>

              <AppText
                variant="h2"
                color={colors.text.primary}
              >
                FITNESS PROGRESS
              </AppText>
            </View>

            <Scale
              size={23}
              color={colors.brand.red}
            />
          </View>

          <Card
            variant="outlined"
            style={{
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            {isLoadingWeight ? (
              <AppText
                variant="bodySmall"
                color={colors.text.secondary}
              >
                Loading your fitness progress...
              </AppText>
            ) : weightError ? (
              <View style={{ gap: spacing.md }}>
                <AppText
                  variant="bodySmall"
                  color={colors.text.error}
                >
                  {weightError}
                </AppText>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadWeightProgress()}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <AppText
                    variant="button"
                    color={colors.brand.red}
                  >
                    Try again
                  </AppText>
                </Pressable>
              </View>
            ) : currentWeight ? (
              <>
                {/* Current Weight */}
                <View style={{ gap: spacing.xs }}>
                  <AppText
                    variant="caption"
                    color={colors.text.secondary}
                  >
                    CURRENT WEIGHT
                  </AppText>

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
                </View>

                {/* Weight Difference */}
                {weightDifference !== null ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    {weightDifference > 0 ? (
                      <TrendingUp size={17} color={colors.brand.red} />
                    ) : weightDifference < 0 ? (
                      <TrendingDown size={17} color={colors.text.secondary} />
                    ) : (
                      <Minus size={17} color={colors.text.tertiary} />
                    )}

                    <AppText
                      variant="bodySmall"
                      color={colors.text.secondary}
                    >
                      {weightDifference > 0 ? '+' : ''}
                      {weightDifference.toFixed(1)} {currentWeight.unit} since previous measurement
                    </AppText>
                  </View>
                ) : null}

                {/* Weight Trend */}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border.default,
                    paddingTop: spacing.md,
                    gap: spacing.sm,
                  }}
                >
                  <AppText
                    variant="caption"
                    color={colors.text.secondary}
                  >
                    WEIGHT TREND
                  </AppText>

                  <DashboardWeightChart
                    records={weightRecords}
                    unit={currentWeight.unit as 'kg' | 'lb'}
                    colors={colors}
                  />
                </View>
              </>
            ) : (
              /* Empty State */
              <View style={{ gap: spacing.sm }}>
                <AppText
                  variant="h3"
                  color={colors.text.primary}
                >
                  START TRACKING YOUR PROGRESS
                </AppText>

                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                >
                  Record your first weight measurement to see your fitness progress here.
                </AppText>
              </View>
            )}

            {/* Weight History Navigation */}
            {!isLoadingWeight && !weightError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View weight history"
                onPress={() =>
                  router.push('/(tabs)/gym-goer-weight/history')
                }
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border.default,
                  paddingTop: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText
                  variant="button"
                  color={colors.brand.red}
                >
                  {currentWeight ? 'View Weight History' : 'Record Your Weight'}
                </AppText>

                <ArrowRight
                  size={19}
                  color={colors.brand.red}
                />
              </Pressable>
            ) : null}
          </Card>
        </View>

        {/* Fitness Feature Card */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.md,
            marginBottom: spacing.xl,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.brand.red,
            }}
          />

          <AppText variant="h2" color={colors.text.primary}>
            BUILT THROUGH GRIT.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ lineHeight: 24 }}
          >
            Every challenge builds resilience. Every session moves you closer to your
            potential.
          </AppText>

          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              backgroundColor: colors.brand.red,
            }}
          >
            <AppText variant="button" color="#FFFFFF">
              KEEP MOVING
            </AppText>
          </View>
        </View>

        {/* Sign Out Section */}
        <View
          style={{
            paddingTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{ textAlign: 'center' }}
          >
            KEEP SHOWING UP. YOUR WORK ADDS UP.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
