import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from "react-native";

import { TypographyVariant } from "../../theme/typography";
import { useTrainrTheme } from "../../theme/ThemeProvider";

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle["textAlign"];
  weight?: TextStyle["fontWeight"];
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = "body",
  color,
  align,
  weight,
  style,
  ...props
}: TextProps) {
  const theme = useTrainrTheme();

  return (
    <RNText
      {...props}
      allowFontScaling
      style={[
        styles.base,
        theme.typography[variant],
        {
          color: color ?? theme.colors.text.primary,
          textAlign: align,
          fontWeight: weight,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: "Inter",
  },
});
