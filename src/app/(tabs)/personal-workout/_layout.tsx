import { Stack } from 'expo-router';

export default function PersonalWorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="goals/new" />
      <Stack.Screen name="goals/[id]" />
      <Stack.Screen name="goals/edit/[id]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
