import { useTrainrTheme } from '@/theme';

export function useTheme() {
  const { colors } = useTrainrTheme();

  return {
    // Legacy-compatible properties
    text: colors.text.primary,
    background: colors.background.primary,
    backgroundElement: colors.surface.subtle,
    backgroundSelected: colors.surface.muted,
    textSecondary: colors.text.secondary,

    // TRAINR theme properties
    primary: colors.primary,
    primaryDark: colors.primaryPressed,
    primaryLight: colors.primarySoft,
    border: colors.border.default,
    borderStrong: colors.border.strong,

    // Extended palette for future components
    surface: colors.surface,
    textColors: colors.text,
    backgrounds: colors.background,
    borders: colors.border,
    semantic: colors.semantic,
    fitness: colors.fitness,
  };
}
