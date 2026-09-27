import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { useTrainrTheme } from "../../theme/ThemeProvider";

type Props = {
  uri?: string;
  name?: string;
  size?: number;
};

export function Avatar({ uri, name = "?", size = 48 }: Props) {
  const theme = useTrainrTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityRole="image"
        accessibilityLabel={`${name} profile photo`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} avatar`}
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceSecondary,
        },
      ]}
    >
      <Text variant="bodyMedium">{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
