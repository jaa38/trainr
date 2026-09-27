import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { useTrainrTheme } from "../../theme/ThemeProvider";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  children,
  onPress,
  size = 44,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useTrainrTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: Math.max(size, theme.sizes.touchTarget),
          height: Math.max(size, theme.sizes.touchTarget),
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
