import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "../../Button";
import { Text } from "../../Text";
import { Stack } from "../../Layout";
import { useTrainrTheme } from "../../../theme/ThemeProvider";

export function Loading({ label = "Loading" }: { label?: string }) {
  const theme = useTrainrTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing.xxl,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <Text
        variant="bodySmall"
        color={theme.colors.textSecondary}
        style={{ marginTop: 12 }}
      >
        {label}
      </Text>
    </View>
  );
}

type StateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: StateProps) {
  const theme = useTrainrTheme();

  return (
    <Stack
      gap={theme.spacing.sm}
      style={{ alignItems: "center", padding: theme.spacing.xxl }}
    >
      <Text variant="h3" align="center">
        {title}
      </Text>
      {message ? (
        <Text
          variant="bodySmall"
          color={theme.colors.textSecondary}
          align="center"
        >
          {message}
        </Text>
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
  actionLabel = "Try Again",
  onAction,
}: StateProps) {
  const theme = useTrainrTheme();

  return (
    <Stack
      gap={theme.spacing.sm}
      style={{ alignItems: "center", padding: theme.spacing.xxl }}
    >
      <Text variant="h3" align="center">
        {title}
      </Text>
      {message ? (
        <Text
          variant="bodySmall"
          color={theme.colors.textSecondary}
          align="center"
        >
          {message}
        </Text>
      ) : null}
      {onAction ? (
        <Button variant="primary" size="medium" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
