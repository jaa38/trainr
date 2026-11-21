import { Stack } from 'expo-router';

export default function GymGoerProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="personal-information" />
      <Stack.Screen name="fitness-goals" />
    </Stack>
  );
}
