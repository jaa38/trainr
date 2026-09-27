import { Stack } from "expo-router";
import { ThemeProvider } from "../src";

export default function RootLayout() {
  return (
    <ThemeProvider mode="system">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000000" },
        }}
      />
    </ThemeProvider>
  );
}
