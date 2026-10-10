import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';

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
  const targetSize = Math.max(size, theme.sizes.touchTarget);

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
          width: targetSize,
          height: targetSize,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          backgroundColor: pressed ? theme.colors.surface.muted : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
