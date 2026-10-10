import React from 'react';
import { View } from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';
import { AppText } from '../AppText';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

type Props = {
  children: React.ReactNode;
  tone?: BadgeTone;
  accessibilityLabel?: string;
};

export function Badge({ children, tone = 'neutral', accessibilityLabel }: Props) {
  const theme = useTrainrTheme();

  const colorMap: Record<BadgeTone, string> = {
    neutral: theme.colors.textSecondary,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
    info: theme.colors.info,
  };

  const color = colorMap[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor:
          tone === 'neutral' ? theme.colors.surfaceSecondary : `${color}1A`,
      }}
    >
      <AppText variant="caption" color={color}>
        {children}
      </AppText>
    </View>
  );
}
