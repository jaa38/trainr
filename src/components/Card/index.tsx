import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

type Props = {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  const theme = useTrainrTheme();

  const outlined = variant === 'outlined' || variant === 'interactive';

  const cardStyle = {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor:
      variant === 'default'
        ? theme.colors.surface.default
        : variant === 'elevated'
          ? theme.colors.surface.elevated
          : 'transparent',
    borderWidth: outlined ? 1 : 0,
    borderColor: theme.colors.border.default,
  } as const;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: false }}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && {
            backgroundColor:
              variant === 'interactive'
                ? theme.colors.surface.muted
                : cardStyle.backgroundColor,
            opacity: 0.82,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
