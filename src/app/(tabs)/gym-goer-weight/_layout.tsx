import { Stack } from 'expo-router';

export default function GymGoerWeightLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="history" />
        </Stack>
    );
}
