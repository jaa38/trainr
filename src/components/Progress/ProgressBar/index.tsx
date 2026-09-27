import React from "react";
import { View } from "react-native";
import { useTrainrTheme } from "../../../theme/ThemeProvider";

type Props = {
  progress: number;
  height?: number;
  color?: string;
};

export function ProgressBar({ progress, height = 6, color }: Props) {
  const theme = useTrainrTheme();
  const value = Math.max(0, Math.min(1, progress));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{
        height,
        width: "100%",
        overflow: "hidden",
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          width: `${value * 100}%`,
          height: "100%",
          borderRadius: theme.radius.pill,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}
