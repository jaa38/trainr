import { StyleSheet, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  ProgressBar,
  ProgressRing,
  Screen,
  Stack,
  Text,
} from "@/components";

import { useTrainrTheme } from "@/theme";

export default function HomeScreen() {
  const theme = useTrainrTheme();

  return (
    <Screen scroll>
      <Stack gap={theme.spacing.xl} style={styles.container}>
        {/* Header */}
        <View>
          <Text variant="h1">TRAINR</Text>

          <Text
            variant="body"
            color={theme.colors.text.secondary}
            style={styles.subtitle}
          >
            Your fitness journey starts here.
          </Text>
        </View>

        {/* Design System Card */}
        <Card variant="elevated">
          <Stack gap={theme.spacing.md}>
            <Badge tone="primary">TRAINR DESIGN SYSTEM</Badge>

            <Text variant="h2">Built to train.</Text>

            <Text variant="bodySmall" color={theme.colors.text.secondary}>
              Dark-mode-first, accessible and component-driven.
            </Text>

            <ProgressBar progress={0.72} />

            <Text variant="caption" color={theme.colors.text.secondary}>
              Weekly goal · 72%
            </Text>
          </Stack>
        </Card>

        {/* Weekly Progress */}
        <View style={styles.ringRow}>
          <ProgressRing
            progress={0.72}
            value="72%"
            label="Weekly Goal"
            size={120}
          />
        </View>

        {/* Primary Action */}
        <Button variant="primary" size="large" fullWidth>
          Start Training
        </Button>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 48,
  },

  subtitle: {
    marginTop: 6,
  },

  ringRow: {
    alignItems: "center",
  },
});
