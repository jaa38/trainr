import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { typography } from '@/theme/typography';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: 'text' | 'textSecondary' | 'primary';
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  const color =
    themeColor === 'primary'
      ? theme.primary
      : themeColor === 'textSecondary'
        ? theme.textSecondary
        : theme.text;

  const textStyle = {
    default: typography.body,
    title: typography.h1,
    small: typography.bodySmall,
    smallBold: {
      ...typography.bodySmall,
      fontWeight: '700' as const,
    },
    subtitle: typography.h2,
    link: typography.button,
    linkPrimary: {
      ...typography.button,
      color: theme.primary,
    },
    code: {
      fontFamily: 'monospace',
      fontSize: 12,
      lineHeight: 16,
    },
  }[type];

  return <Text style={[styles.base, textStyle, { color }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
