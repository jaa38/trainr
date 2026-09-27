import { TextStyle } from "react-native";

export const typography = {
  displayXL: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "800",
  },

  displayL: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "800",
  },

  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
  },

  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },

  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },

  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "400",
  },

  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },

  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },

  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },

  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
