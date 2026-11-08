
import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="exercise-library" />
      <Stack.Screen name="workout-plans" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
