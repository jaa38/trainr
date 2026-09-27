/**
 * TRAINR Colour System
 *
 * Brand-first, semantic, theme-aware colour tokens.
 *
 * Light mode and dark mode use different semantic mappings,
 * while the underlying neutral scale remains consistent.
 */

export const colors = {
  brand: {
    black: "#0B0B0B",
    white: "#FFFFFF",

    light: {
      red: "#D71920",
      redDark: "#B91C1C",
      redLight: "#FDE8E9",
    },

    dark: {
      red: "#F0111A",
      redDark: "#C90D14",
      redLight: "#3A0E11",
    },
  },

  neutral: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#0B0B0B",

    white: "#FFFFFF",
    black: "#000000",
  },

  semantic: {
    light: {
      success: "#22C55E",
      warning: "#F59E0B",
      error: "#EF4444",
      info: "#3B82F6",
    },

    dark: {
      success: "#4ADE80",
      warning: "#FBBF24",
      error: "#F87171",
      info: "#60A5FA",
    },
  },

  fitness: {
    light: {
      overallProgress: "#D71920",
      strength: "#0B0B0B",
      endurance: "#3B82F6",
      recovery: "#22C55E",
      nutrition: "#8B5CF6",
      calories: "#F59E0B",
    },

    dark: {
      overallProgress: "#F0111A",
      strength: "#FFFFFF",
      endurance: "#60A5FA",
      recovery: "#4ADE80",
      nutrition: "#A78BFA",
      calories: "#FBBF24",
    },
  },
} as const;

/**
 * Theme background colours
 */
export type ThemeBackgrounds = {
  primary: string;
  secondary: string;
  tertiary: string;
  elevated: string;
  brand: string;
  accent: string;
};

/**
 * Theme surface colours
 */
export type ThemeSurfaces = {
  default: string;
  subtle: string;
  muted: string;
  elevated: string;
  brand: string;
  dark: string;
};

/**
 * Theme text colours
 */
export type ThemeText = {
  primary: string;
  secondary: string;
  tertiary: string;
  placeholder: string;
  disabled: string;
  inverse: string;
  brand: string;
  error: string;
};

/**
 * Theme border colours
 */
export type ThemeBorders = {
  subtle: string;
  default: string;
  strong: string;
  focus: string;
  brand: string;
};

/**
 * Semantic status colours
 */
export type ThemeSemanticColors = {
  success: string;
  warning: string;
  error: string;
  info: string;
};

/**
 * Fitness metric colours
 */
export type ThemeFitnessColors = {
  overallProgress: string;
  strength: string;
  endurance: string;
  recovery: string;
  nutrition: string;
  calories: string;
};

/**
 * Complete TRAINR theme colour contract.
 */
export type ThemeColors = {
  background: ThemeBackgrounds;
  surface: ThemeSurfaces;
  text: ThemeText;
  border: ThemeBorders;
  semantic: ThemeSemanticColors;
  fitness: ThemeFitnessColors;

  /**
   * Brand colours for the currently active theme.
   */
  brand: {
    black: string;
    white: string;
    red: string;
    redDark: string;
    redLight: string;
  };

  /**
   * Backwards-compatible aliases.
   *
   * These allow existing components to continue using:
   * theme.colors.primary
   * theme.colors.surface
   * theme.colors.text
   * etc.
   */
  primary: string;
  primaryPressed: string;
  primarySoft: string;

  surfaceDefault: string;
  surfaceElevated: string;
  surfaceSecondary: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;

  borderDefault: string;
  borderStrong: string;

  success: string;
  warning: string;
  error: string;
  info: string;
};

/**
 * TRAINR LIGHT THEME
 */
export const lightColors: ThemeColors = {
  brand: {
    black: "#0B0B0B",
    white: "#FFFFFF",
    red: "#D71920",
    redDark: "#B91C1C",
    redLight: "#FDE8E9",
  },

  background: {
    primary: "#FFFFFF",
    secondary: "#FAFAFA",
    tertiary: "#F5F5F5",
    elevated: "#FFFFFF",
    brand: "#0B0B0B",
    accent: "#FDE8E9",
  },

  surface: {
    default: "#FFFFFF",
    subtle: "#FAFAFA",
    muted: "#F5F5F5",
    elevated: "#FAFAFA",
    brand: "#D71920",
    dark: "#0B0B0B",
  },

  text: {
    primary: "#0B0B0B",
    secondary: "#525252",
    tertiary: "#737373",
    placeholder: "#A3A3A3",
    disabled: "#A3A3A3",
    inverse: "#FFFFFF",
    brand: "#D71920",
    error: "#B91C1C",
  },

  border: {
    subtle: "#F5F5F5",
    default: "#E5E5E5",
    strong: "#D4D4D4",
    focus: "#D71920",
    brand: "#D71920",
  },

  semantic: {
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },

  fitness: {
    overallProgress: "#D71920",
    strength: "#0B0B0B",
    endurance: "#3B82F6",
    recovery: "#22C55E",
    nutrition: "#8B5CF6",
    calories: "#F59E0B",
  },

  // Backwards-compatible aliases
  primary: "#D71920",
  primaryPressed: "#B91C1C",
  primarySoft: "#FDE8E9",

  surfaceDefault: "#FFFFFF",
  surfaceElevated: "#FAFAFA",
  surfaceSecondary: "#FAFAFA",

  textPrimary: "#0B0B0B",
  textSecondary: "#525252",
  textTertiary: "#737373",
  textDisabled: "#A3A3A3",

  borderDefault: "#E5E5E5",
  borderStrong: "#D4D4D4",

  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

/**
 * TRAINR DARK THEME
 */
export const darkColors: ThemeColors = {
  brand: {
    black: "#000000",
    white: "#FFFFFF",
    red: "#F0111A",
    redDark: "#C90D14",
    redLight: "#3A0E11",
  },

  background: {
    primary: "#000000",
    secondary: "#0A0A0A",
    tertiary: "#111111",
    elevated: "#171717",
    brand: "#FFFFFF",
    accent: "#3A0E11",
  },

  surface: {
    default: "#111111",
    subtle: "#0A0A0A",
    muted: "#171717",
    elevated: "#222222",
    brand: "#F0111A",
    dark: "#000000",
  },

  text: {
    primary: "#FFFFFF",
    secondary: "#E5E5E5",
    tertiary: "#A3A3A3",
    placeholder: "#737373",
    disabled: "#525252",
    inverse: "#000000",
    brand: "#F0111A",
    error: "#F87171",
  },

  border: {
    subtle: "#1A1A1A",
    default: "#262626",
    strong: "#333333",
    focus: "#F0111A",
    brand: "#F0111A",
  },

  semantic: {
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",
  },

  fitness: {
    overallProgress: "#F0111A",
    strength: "#FFFFFF",
    endurance: "#60A5FA",
    recovery: "#4ADE80",
    nutrition: "#A78BFA",
    calories: "#FBBF24",
  },

  // Backwards-compatible aliases
  primary: "#F0111A",
  primaryPressed: "#C90D14",
  primarySoft: "#3A0E11",

  surfaceDefault: "#111111",
  surfaceElevated: "#222222",
  surfaceSecondary: "#0A0A0A",

  textPrimary: "#FFFFFF",
  textSecondary: "#E5E5E5",
  textTertiary: "#A3A3A3",
  textDisabled: "#525252",

  borderDefault: "#262626",
  borderStrong: "#333333",

  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
};
