import { Stack } from 'expo-router';

export default function GymGoerWorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="session/[assignmentId]" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
