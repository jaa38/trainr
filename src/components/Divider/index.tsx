import React from "react";
import { StyleSheet, View } from "react-native";

import { useTrainrTheme } from "../../theme/ThemeProvider";

export function Divider() {
  const theme = useTrainrTheme();

  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: theme.colors.border.default,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
});
