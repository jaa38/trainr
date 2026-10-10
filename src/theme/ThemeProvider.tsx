import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '@/theme/colors';
import { motion } from '@/theme/motion';
import { radius } from '@/theme/radius';
import { sizes } from '@/theme/sizes';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type ThemeMode = 'dark' | 'light' | 'system';

export type TrainrTheme = {
  mode: Exclude<ThemeMode, 'system'>;
  colors: typeof lightColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
  motion: typeof motion;
};

const ThemeContext = createContext<TrainrTheme | null>(null);

type Props = {
  children: React.ReactNode;
  mode?: ThemeMode;
};

export function TrainrThemeProvider({ children, mode = 'system' }: Props) {
  const systemScheme = useColorScheme();

  const resolvedMode: Exclude<ThemeMode, 'system'> =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const theme = useMemo<TrainrTheme>(
    () => ({
      mode: resolvedMode,
      colors: resolvedMode === 'dark' ? darkColors : lightColors,
      typography,
      spacing,
      radius,
      sizes,
      motion,
    }),
    [resolvedMode],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTrainrTheme(): TrainrTheme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTrainrTheme must be used inside TrainrThemeProvider');
  }

  return theme;
}
