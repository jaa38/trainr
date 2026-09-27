import React from "react";
import { View } from "react-native";
import { Text } from "../Text";
import { useTrainrTheme } from "../../theme/ThemeProvider";

type Props = {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "error" | "info";
};

export function Badge({ children, tone = "neutral" }: Props) {
  const theme = useTrainrTheme();

  const colorMap = {
    neutral: theme.colors.textSecondary,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
    info: theme.colors.info,
  };

  const color = colorMap[tone];

  return (
    <View
      accessible
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor:
          tone === "neutral" ? theme.colors.surfaceSecondary : `${color}1A`,
      }}
    >
      <Text variant="caption" color={color}>
        {children}
      </Text>
    </View>
  );
}
