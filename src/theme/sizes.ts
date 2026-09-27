export const sizes = {
  screenPadding: 16,

  buttonSmall: 40,
  buttonMedium: 48,
  buttonLarge: 56,

  inputHeight: 48,

  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  iconXLarge: 32,

  avatarSmall: 32,
  avatarMedium: 40,
  avatarLarge: 56,
  avatarXLarge: 80,

  touchTarget: 44,
} as const;

export type SizeToken = keyof typeof sizes;
