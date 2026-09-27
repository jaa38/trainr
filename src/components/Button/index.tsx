import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { Text } from "../Text";
import { Row } from "../Layout";
import { useTrainrTheme } from "../../theme/ThemeProvider";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "small" | "medium" | "large";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
}: Props) {
  const theme = useTrainrTheme();
  const isDisabled = disabled || loading;

  const background =
    variant === "primary"
      ? theme.colors.primary
      : variant === "destructive"
        ? theme.colors.error
        : variant === "secondary"
          ? theme.colors.surfaceSecondary
          : "transparent";

  const borderColor =
    variant === "outline"
      ? theme.colors.borderStrong
      : "transparent";

  const textColor =
    variant === "primary" || variant === "destructive"
      ? theme.colors.text.inverse
      : variant === "secondary"
        ? theme.colors.text.primary
        : variant === "outline"
          ? theme.colors.text.primary
          : theme.colors.primary;

  const height =
    theme.sizes[
      size === "small"
        ? "buttonSmall"
        : size === "large"
          ? "buttonLarge"
          : "buttonMedium"
    ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          minWidth: height,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.md,
          backgroundColor: background,
          borderColor,
          borderWidth: variant === "outline" ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Row gap={theme.spacing.sm}>
          {leftIcon}

          <Text
            variant="bodyMedium"
            color={textColor}
            style={styles.label}
          >
            {children}
          </Text>

          {rightIcon}
        </Row>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },

  fullWidth: {
    width: "100%",
  },

  label: {
    textAlign: "center",
  },
});
