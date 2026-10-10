import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type UserRole = 'gym-goer' | 'personal-trainer';

export default function HomeScreen() {
  const { colors, spacing, radius } = useTrainrTheme();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const roles: {
    id: UserRole;
    title: string;
    description: string;
  }[] = [
    {
      id: 'gym-goer',
      title: "I'M A GYM-GOER",
      description: 'Discover trainers and work towards your fitness goals.',
    },
    {
      id: 'personal-trainer',
      title: "I'M A PERSONAL TRAINER",
      description: 'Build your profile and connect with potential clients.',
    },
  ];

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
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="h1" color={colors.text.primary}>
            TRAINR
          </AppText>

          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="displayLarge" color={colors.text.primary}>
            BUILD YOUR
          </AppText>

          <AppText variant="displayLarge" color={colors.brand.red}>
            STRONGER SELF.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: spacing.xs }}
          >
            Whether you want to reach your fitness goals or help others reach theirs, your
            next chapter starts here.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <AppText variant="h2" color={colors.text.primary}>
            HOW WILL YOU TRAIN?
          </AppText>

          {roles.map((role) => {
            const isSelected = selectedRole === role.id;

            return (
              <Pressable
                key={role.id}
                accessibilityRole="button"
                accessibilityLabel={role.title}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedRole(role.id)}
                style={({ pressed }) => ({
                  padding: spacing.lg,
                  minHeight: 112,
                  gap: spacing.sm,
                  justifyContent: 'center',
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.brand.red : colors.border.default,
                  backgroundColor: isSelected
                    ? colors.surface.muted
                    : colors.surface.subtle,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <AppText
                  variant="h3"
                  color={isSelected ? colors.brand.red : colors.text.primary}
                >
                  {role.title}
                </AppText>

                <AppText variant="body" color={colors.text.secondary}>
                  {role.description}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {selectedRole && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              padding: spacing.lg,
              gap: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.surface.muted,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {selectedRole === 'gym-goer'
                ? "LET'S REACH YOUR GOALS."
                : 'LET’S BUILD YOUR TRAINING BUSINESS.'}
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {selectedRole === 'gym-goer'
                ? 'You selected the gym-goer experience. Your fitness onboarding is the next step.'
                : 'You selected the personal trainer experience. Your professional onboarding is the next step.'}
            </AppText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
