import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';
import { AppText } from '../AppText';
import { Row } from '../Layout';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export type ButtonSize = 'small' | 'medium' | 'large';

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
  variant = 'primary',
  size = 'medium',
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

  const isFilled = variant === 'primary' || variant === 'destructive';

  const backgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'destructive'
        ? theme.colors.error
        : variant === 'secondary'
          ? theme.colors.surfaceSecondary
          : 'transparent';

  const borderColor = variant === 'outline' ? theme.colors.borderStrong : 'transparent';

  const textColor = isFilled
    ? theme.colors.text.inverse
    : variant === 'ghost'
      ? theme.colors.primary
      : theme.colors.text.primary;

  const height =
    theme.sizes[
      size === 'small' ? 'buttonSmall' : size === 'large' ? 'buttonLarge' : 'buttonMedium'
    ];

  const textVariant = size === 'large' ? 'buttonLarge' : 'button';

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
        {
          minHeight: height,
          paddingHorizontal: size === 'small' ? theme.spacing.md : theme.spacing.lg,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Row gap={theme.spacing.sm}>
          {leftIcon}

          <AppText variant={textVariant} color={textColor} align="center">
            {children}
          </AppText>

          {rightIcon}
        </Row>
      )}
    </Pressable>
  );
}
