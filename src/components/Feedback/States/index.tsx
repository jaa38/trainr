import { ActivityIndicator, View } from 'react-native';
import { useTrainrTheme } from '../../../theme/ThemeProvider';
import { AppText } from '../../AppText';
import { Button } from '../../Button';
import { Stack } from '../../Layout';

export function Loading({ label = 'Loading' }: { label?: string }) {
  const theme = useTrainrTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <AppText
        variant="bodySmall"
        color={theme.colors.textSecondary}
        style={{ marginTop: 12 }}
      >
        {label}
      </AppText>
    </View>
  );
}

type StateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: StateProps) {
  const theme = useTrainrTheme();

  return (
    <Stack
      gap={theme.spacing.sm}
      style={{ alignItems: 'center', padding: theme.spacing.xxl }}
    >
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="bodySmall" color={theme.colors.textSecondary} align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="outline" size="medium" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}

export function ErrorState({
  title,
  message,
  actionLabel = 'Try Again',
  onAction,
}: StateProps) {
  const theme = useTrainrTheme();

  return (
    <Stack
      gap={theme.spacing.sm}
      style={{ alignItems: 'center', padding: theme.spacing.xxl }}
    >
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="bodySmall" color={theme.colors.textSecondary} align="center">
          {message}
        </AppText>
      ) : null}
      {onAction ? (
        <Button variant="primary" size="medium" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
