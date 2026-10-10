import React from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';
import { AppText } from '../AppText';

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
  accessibilityLabel,
  ...props
}: Props) {
  const theme = useTrainrTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText
          variant="label"
          color={theme.colors.text.primary}
          style={{ marginBottom: theme.spacing.sm }}
        >
          {label}
        </AppText>
      ) : null}

      <View
        style={{
          minHeight: theme.sizes.inputHeight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: error
            ? theme.colors.error
            : focused
              ? theme.colors.border.focus
              : theme.colors.border.default,
          backgroundColor: theme.colors.surface.default,
        }}
      >
        {leading}

        <TextInput
          {...props}
          accessibilityLabel={accessibilityLabel ?? label}
          allowFontScaling
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.text.placeholder}
          selectionColor={theme.colors.primary}
          style={[
            {
              flex: 1,
              minHeight: theme.sizes.inputHeight - 2,
              color: theme.colors.text.primary,
              fontFamily: theme.typography.body.fontFamily,
              fontSize: theme.typography.body.fontSize,
              marginLeft: leading ? theme.spacing.sm : 0,
              marginRight: trailing ? theme.spacing.sm : 0,
            },
            style,
          ]}
        />

        {trailing}
      </View>

      {error ? (
        <AppText
          variant="caption"
          color={theme.colors.text.error}
          style={{ marginTop: theme.spacing.xs }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : helperText ? (
        <AppText
          variant="caption"
          color={theme.colors.text.secondary}
          style={{ marginTop: theme.spacing.xs }}
        >
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}
