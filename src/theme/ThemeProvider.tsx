import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, ThemeColors } from "@/theme/colors";

import { typography } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { radius } from "@/theme/radius";
import { sizes } from "@/theme/sizes";
import { motion } from "@/theme/motion";

export type ThemeMode = "dark" | "light" | "system";

export type TrainrTheme = {
  mode: Exclude<ThemeMode, "system">;
  colors: ThemeColors;
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

export function ThemeProvider({ children, mode = "system" }: Props) {
  const systemScheme = useColorScheme();

  const resolvedMode: Exclude<ThemeMode, "system"> =
    mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const theme = useMemo<TrainrTheme>(
    () => ({
      mode: resolvedMode,

      colors: resolvedMode === "dark" ? darkColors : lightColors,

      typography,
      spacing,
      radius,
      sizes,
      motion,
    }),
    [resolvedMode],
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTrainrTheme(): TrainrTheme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error("useTrainrTheme must be used inside ThemeProvider");
  }

  return theme;
}
