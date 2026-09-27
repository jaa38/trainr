import React from "react";
import {
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

import { useTrainrTheme } from "../../theme/ThemeProvider";

type Variant =
  | "default"
  | "elevated"
  | "outlined"
  | "interactive";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  variant = "default",
  onPress,
  style,
}: Props) {
  const theme = useTrainrTheme();

  const content = (
    <View
      style={[
        {
          padding: theme.spacing.lg,
          borderRadius: theme.radius.lg,

          backgroundColor:
            variant === "default"
              ? theme.colors.surface.default
              : variant === "elevated"
                ? theme.colors.surface.elevated
                : variant === "outlined" ||
                    variant === "interactive"
                  ? "transparent"
                  : theme.colors.surface.default,

          borderWidth:
            variant === "outlined" ||
            variant === "interactive"
              ? 1
              : 0,

          borderColor: theme.colors.border.default,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
