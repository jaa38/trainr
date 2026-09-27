import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/Text";
import { useTrainrTheme } from "@/theme/ThemeProvider";

type Props = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  value?: string;
  color?: string;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  label,
  value,
  color,
}: Props) {
  const theme = useTrainrTheme();

  const safeProgress = Math.max(0, Math.min(1, progress));

  const radius = (size - strokeWidth) / 2;

  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(safeProgress * 100),
      }}
      style={{
        width: size,
        height: size,
      }}
    >
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceSecondary}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - safeProgress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          {value ? <Text variant="h3">{value}</Text> : null}

          {label ? (
            <Text
              variant="caption"
              color={theme.colors.textSecondary}
              align="center"
            >
              {label}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
