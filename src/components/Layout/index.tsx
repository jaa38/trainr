import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useTrainrTheme } from "../../theme/ThemeProvider";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export function Stack({ children, gap, style }: StackProps) {
  const theme = useTrainrTheme();

  return (
    <View
      style={[{ flexDirection: "column", gap: gap ?? theme.spacing.lg }, style]}
    >
      {children}
    </View>
  );
}

export function Row({ children, gap, style }: StackProps) {
  const theme = useTrainrTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: gap ?? theme.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({
  size = "lg",
}: {
  size?: keyof ReturnType<typeof useTrainrTheme>["spacing"];
}) {
  const theme = useTrainrTheme();
  return <View style={{ height: theme.spacing[size] }} />;
}
