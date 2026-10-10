import { TextStyle } from 'react-native';

/**
 * TRAINR Typography System
 *
 * Brand typography:
 * - Barlow Condensed → display, performance, editorial, metrics
 * - Inter → functional UI and readable content
 *
 * TRAINR typography is intentionally split into:
 *
 * 1. Display / Performance
 *    Barlow Condensed
 *
 * 2. Functional UI
 *    Inter
 *
 * The goal is to make TRAINR feel like a premium
 * performance brand rather than a generic fitness SaaS product.
 */

/* -------------------------------------------------------------------------- */
/* Font Families                                                              */
/* -------------------------------------------------------------------------- */

export const fontFamily = {
  display: {
    bold: 'BarlowCondensed-Bold',
    extraBold: 'BarlowCondensed-ExtraBold',
    black: 'BarlowCondensed-Black',
  },

  ui: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Typography Tokens                                                          */
/* -------------------------------------------------------------------------- */

export const typography = {
  /* ---------------------------------------------------------------------- */
  /* Display                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Major brand statements and hero typography.
   *
   * Example:
   * TRAIN
   * HARDER.
   */
  displayXL: {
    fontFamily: fontFamily.display.black,
    fontSize: 72,
    lineHeight: 72,
    fontWeight: '900',
    letterSpacing: -1.5,
  },

  /**
   * Large editorial headlines.
   */
  displayLarge: {
    fontFamily: fontFamily.display.black,
    fontSize: 60,
    lineHeight: 60,
    fontWeight: '900',
    letterSpacing: -1.25,
  },

  /**
   * Large screen titles and major promotional messaging.
   */
  displayMedium: {
    fontFamily: fontFamily.display.extraBold,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },

  /* ---------------------------------------------------------------------- */
  /* Headings                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Primary screen headings.
   *
   * Example:
   * FIND YOUR TRAINER
   */
  h1: {
    fontFamily: fontFamily.display.extraBold,
    fontSize: 40,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.75,
  },

  /**
   * Major section headings.
   */
  h2: {
    fontFamily: fontFamily.display.bold,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  /**
   * Sub-section headings.
   */
  h3: {
    fontFamily: fontFamily.display.bold,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.25,
  },

  /**
   * Smaller display heading.
   */
  h4: {
    fontFamily: fontFamily.display.bold,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0,
  },

  /* ---------------------------------------------------------------------- */
  /* Body                                                                    */
  /* ---------------------------------------------------------------------- */

  bodyLarge: {
    fontFamily: fontFamily.ui.regular,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0,
  },

  body: {
    fontFamily: fontFamily.ui.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },

  bodyMedium: {
    fontFamily: fontFamily.ui.medium,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0,
  },

  bodySmall: {
    fontFamily: fontFamily.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },

  caption: {
    fontFamily: fontFamily.ui.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  buttonLarge: {
    fontFamily: fontFamily.ui.bold,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  button: {
    fontFamily: fontFamily.ui.semiBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.15,
  },

  label: {
    fontFamily: fontFamily.ui.semiBold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  navigation: {
    fontFamily: fontFamily.ui.semiBold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },

  /* ---------------------------------------------------------------------- */
  /* Fitness Metrics                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Extremely large performance number.
   *
   * Example:
   * 12,450
   * TOTAL STEPS
   */
  metricXL: {
    fontFamily: fontFamily.display.black,
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '900',
    letterSpacing: -1,
  },

  /**
   * Large performance statistic.
   *
   * Example:
   * 85 KG
   */
  metricLarge: {
    fontFamily: fontFamily.display.extraBold,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -0.75,
  },

  /**
   * Standard performance metric.
   *
   * Example:
   * 4.8 KM
   */
  metricMedium: {
    fontFamily: fontFamily.display.bold,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
} satisfies Record<string, TextStyle>;

/* -------------------------------------------------------------------------- */
/* Typography Variant                                                         */
/* -------------------------------------------------------------------------- */

export type TypographyVariant = keyof typeof typography;
