
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

export default function TrainerMoreScreen() {
    const router = useRouter();
    const { colors, spacing } = useTrainrTheme();

    const sections = [
        {
            title: 'EXERCISE LIBRARY',
            description:
                'Build and manage your exercise collection. Organise movements by muscle group, equipment and category.',
            label: 'EXERCISE MANAGEMENT',
            route: '/(tabs)/personal-trainer/more/exercise-library',
        },
        {
            title: 'WORKOUT PLANS',
            description:
                'Create personalised training programmes and assign workout plans to your clients.',
            label: 'TRAINING PROGRAMMES',
            route: '/(tabs)/personal-trainer/more/workout-plans',
        },
        {
            title: 'PROFILE',
            description:
                'Manage your professional information, qualifications, training specialities and account settings.',
            label: 'ACCOUNT SETTINGS',
            route: '/(tabs)/personal-trainer/more/profile',
        },
    ] as const;

    return (
        <SafeAreaView
            edges={['top']}
            style={{
                flex: 1,
                backgroundColor: colors.background.primary,
            }}
        >
            <ScrollView
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: spacing.huge + spacing.xxxl,
                    gap: spacing.lg,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Page heading */}
                <View style={{ gap: spacing.sm }}>
                    <AppText variant="caption" color={colors.brand.red}>
                        TRAINER WORKSPACE
                    </AppText>

                    <AppText
                        variant="displayLarge"
                        color={colors.text.primary}
                    >
                        MORE.
                    </AppText>

                    <AppText
                        variant="body"
                        color={colors.text.secondary}
                    >
                        Your tools. Your programmes. Your professional workspace.
                    </AppText>
                </View>

                {/* Workspace introduction */}
                <View
                    style={{
                        padding: spacing.xl,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                        gap: spacing.md,
                    }}
                >
                    <AppText
                        variant="caption"
                        color={colors.brand.red}
                    >
                        YOUR WORKSPACE
                    </AppText>

                    <AppText
                        variant="h2"
                        color={colors.text.primary}
                    >
                        Everything you need to train smarter.
                    </AppText>

                    <AppText
                        variant="body"
                        color={colors.text.secondary}
                    >
                        Access your exercise collection, build training programmes and manage your professional identity.
                    </AppText>
                </View>

                {/* Navigation sections */}
                <View style={{ gap: spacing.md }}>
                    <AppText
                        variant="h3"
                        color={colors.text.primary}
                    >
                        WORKSPACE TOOLS
                    </AppText>

                    {sections.map((section) => (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${section.title}`}
                            onPress={() => router.push(section.route)}
                            style={({ pressed }) => ({
                                padding: spacing.lg,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                backgroundColor: colors.background.secondary,
                                gap: spacing.md,
                                opacity: pressed ? 0.75 : 1,
                            })}
                        >
                            {/* Number and arrow */}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >


                                <AppText
                                    variant="h3"
                                    color={colors.brand.red}
                                >
                                    ↗
                                </AppText>
                            </View>

                            {/* Title and description */}
                            <View style={{ gap: spacing.sm }}>
                                <AppText
                                    variant="h3"
                                    color={colors.text.primary}
                                >
                                    {section.title}
                                </AppText>

                                <AppText
                                    variant="body"
                                    color={colors.text.secondary}
                                >
                                    {section.description}
                                </AppText>
                            </View>

                            {/* Section label */}
                            <View
                                style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: spacing.sm,
                                    borderRadius: 999,
                                    backgroundColor: colors.brand.redLight,
                                }}
                            >
                                <AppText
                                    variant="caption"
                                    color={colors.brand.red}
                                >
                                    {section.label}
                                </AppText>
                            </View>
                        </Pressable>
                    ))}
                </View>

                {/* Footer */}
                <View
                    style={{
                        alignItems: 'center',
                        paddingTop: spacing.md,
                    }}
                >
                    <AppText
                        variant="caption"
                        color={colors.text.tertiary}
                        align="center"
                    >
                        TRAINR · TRAIN SMARTER. PERFORM BETTER.
                    </AppText>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
