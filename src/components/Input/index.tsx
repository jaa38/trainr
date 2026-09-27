import React from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { Text } from "../Text";
import { useTrainrTheme } from "../../theme/ThemeProvider";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({
  label,
  error,
  helperText,
  leading,
  trailing,
  containerStyle,
  style,
  ...props
}: Props) {
  const theme = useTrainrTheme();

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          variant="label"
          style={styles.label}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          minHeight: theme.sizes.inputHeight,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,

          borderColor: error
            ? theme.colors.error
            : theme.colors.border.default,

          backgroundColor: theme.colors.surface.default,
        }}
      >
        {leading}

        <TextInput
          {...props}
          accessibilityLabel={
            props.accessibilityLabel ?? label
          }
          allowFontScaling
          placeholderTextColor={
            theme.colors.text.placeholder
          }
          selectionColor={theme.colors.primary}
          style={[
            styles.input,
            {
              color: theme.colors.text.primary,
              marginLeft: leading
                ? theme.spacing.sm
                : 0,
              marginRight: trailing
                ? theme.spacing.sm
                : 0,
            },
            style,
          ]}
        />

        {trailing}
      </View>

      {error ? (
        <Text
          variant="caption"
          color={theme.colors.text.error}
          style={styles.help}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          variant="caption"
          color={theme.colors.text.secondary}
          style={styles.help}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },

  input: {
    flex: 1,
    minHeight: 46,
    fontSize: 16,
  },

  help: {
    marginTop: 6,
  },
});
