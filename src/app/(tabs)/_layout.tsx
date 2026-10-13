import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="gym-goer" />
      <Stack.Screen name="personal-trainer" />


      <Stack.Screen name="trainer-profile/[id]" />
      <Stack.Screen name="booking/[trainerId]" />
    </Stack>
  );
}