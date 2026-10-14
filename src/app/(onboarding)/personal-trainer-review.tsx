import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { getProfileImageUrl } from '@/services/profile-images';
import { useTrainrTheme } from '@/theme';

type TrainerProfile = {
  professional_bio: string | null;
  location: string | null;
  coaching_approach: string | null;
  specialities: string[] | null;
  qualifications: string[] | null;
  certifications: string[] | null;
  years_experience: number | null;
  availability: { days?: string[] } | null;
  is_published: boolean;
};

type TrainerPricing = {
  session_rate: number;
  currency: string;
  session_duration_minutes: number;
};

type TrainingPackage = {
  id: string;
  name: string;
  description: string | null;
  sessions_count: number;
  price: number;
  currency: string;
};

type ProfileDetails = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ChecklistItem = {
  label: string;
  complete: boolean;
};

export default function PersonalTrainerReviewScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, completeOnboardingLocally } = useAuth();

  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [pricing, setPricing] = useState<TrainerPricing | null>(null);
  const [packages, setPackages] = useState<TrainingPackage[]>([]);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReviewData() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const [profileResult, trainerResult, pricingResult, packagesResult] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url')
              .eq('id', user.id)
              .single(),

            supabase
              .from('trainer_profiles')
              .select(
                'professional_bio, location, coaching_approach, specialities, qualifications, certifications, years_experience, availability, is_published',
              )
              .eq('user_id', user.id)
              .maybeSingle(),

            supabase
              .from('trainer_pricing')
              .select('session_rate, currency, session_duration_minutes')
              .eq('user_id', user.id)
              .maybeSingle(),

            supabase
              .from('trainer_packages')
              .select('id, name, description, sessions_count, price, currency')
              .eq('trainer_id', user.id)
              .order('created_at', { ascending: true }),
          ]);

        if (profileResult.error) throw profileResult.error;
        if (trainerResult.error) throw trainerResult.error;
        if (pricingResult.error) throw pricingResult.error;
        if (packagesResult.error) throw packagesResult.error;

        if (!isMounted) return;

        setProfile(profileResult.data);
        setTrainer(trainerResult.data);
        setPricing(pricingResult.data);
        setPackages(packagesResult.data ?? []);

        try {
          const imageUrl = await getProfileImageUrl(profileResult.data.avatar_url);

          if (isMounted) {
            setProfileImageUrl(imageUrl);
          }
        } catch (imageError) {
          console.error('[Trainer Review] Failed to load profile image:', imageError);

          if (isMounted) {
            setProfileImageUrl(null);
          }
        }
      } catch (error) {
        console.error('[Trainer Review] Failed to load profile:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load your profile for review.',
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadReviewData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const fullName = [profile?.first_name, profile?.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');

  const checklist: ChecklistItem[] = [
    {
      label: 'Full name',
      complete: Boolean(fullName.trim()),
    },
    {
      label: 'Professional bio',
      complete: Boolean(trainer?.professional_bio?.trim()),
    },
    {
      label: 'Location',
      complete: Boolean(trainer?.location?.trim()),
    },
    {
      label: 'Coaching approach',
      complete: Boolean(trainer?.coaching_approach?.trim()),
    },
    {
      label: 'At least one speciality',
      complete: Boolean(trainer?.specialities?.length),
    },
    {
      label: 'Qualifications',
      complete: Boolean(trainer?.qualifications?.some((item) => item.trim())),
    },
    {
      label: 'Certifications',
      complete: Boolean(trainer?.certifications?.some((item) => item.trim())),
    },
    {
      label: 'Years of experience',
      complete:
        trainer?.years_experience !== null &&
        trainer?.years_experience !== undefined &&
        trainer.years_experience >= 0,
    },
    {
      label: 'Session pricing',
      complete: Boolean(
        pricing &&
        Number.isFinite(Number(pricing.session_rate)) &&
        Number(pricing.session_rate) > 0 &&
        pricing.session_duration_minutes > 0,
      ),
    },
    {
      label: 'Weekly availability',
      complete: Boolean(trainer?.availability?.days?.length),
    },
  ];

  const completedItems = checklist.filter((item) => item.complete).length;
  const canPublish = checklist.every((item) => item.complete);

  function renderSection(title: string, children: React.ReactNode) {
    return (
      <View
        style={{
          gap: spacing.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border.default,
          borderRadius: 14,
          backgroundColor: colors.background.primary,
        }}
      >
        <AppText variant="h3" color={colors.text.primary}>
          {title}
        </AppText>
        {children}
      </View>
    );
  }

  function renderValue(label: string, value: string) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodySmall" color={colors.text.secondary}>
          {label}
        </AppText>
        <AppText variant="body" color={colors.text.primary}>
          {value || 'Not provided yet'}
        </AppText>
      </View>
    );
  }

  function renderTagList(items: string[] | null | undefined) {
    const values = items?.filter((item) => item.trim()) ?? [];

    if (values.length === 0) {
      return (
        <AppText variant="body" color={colors.text.secondary}>
          Not provided yet
        </AppText>
      );
    }

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {values.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 20,
              backgroundColor: colors.background.secondary,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.primary}>
              {item}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  async function handleSaveDraft() {
    if (!user || isSavingDraft || isPublishing || isLoading) return;

    setIsSavingDraft(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // The preceding onboarding screens already save their data.
      // Explicitly preserve the unpublished state without completing onboarding.
      const { error } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: user.id,
          is_published: false,
          published_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      console.log('[Trainer Review] Draft saved');

      setSuccessMessage('Your profile is saved as a draft. It has not been published.');
    } catch (error) {
      console.error('[Trainer Review] Failed to save draft:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your draft. Please try again.',
      );
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handlePublish() {
    if (!user || isSavingDraft || isPublishing || isLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!canPublish) {
      setErrorMessage('Complete every required item in the checklist before publishing.');
      return;
    }

    setIsPublishing(true);

    try {
      const publishedAt = new Date().toISOString();

      const { error: trainerError } = await supabase
        .from('trainer_profiles')
        .update({
          is_published: true,
          published_at: publishedAt,
          updated_at: publishedAt,
        })
        .eq('user_id', user.id);

      if (trainerError) throw trainerError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          updated_at: publishedAt,
        })
        .eq('id', user.id);

      if (profileError) {
        // Avoid leaving the trainer profile published if onboarding completion fails.
        const { error: rollbackError } = await supabase
          .from('trainer_profiles')
          .update({
            is_published: false,
            published_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (rollbackError) {
          console.error(
            '[Trainer Review] Failed to roll back publication:',
            rollbackError,
          );
        }

        throw profileError;
      }

      console.log('[Trainer Review] Profile published');

      // Update local auth state instead of refreshing the profile and
      // triggering an onboarding redirect.
      completeOnboardingLocally();

      router.replace('/(tabs)/personal-trainer');
    } catch (error) {
      console.error('[Trainer Review] Failed to publish profile:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to publish your profile. Please try again.',
      );
    } finally {
      setIsPublishing(false);
    }
  }

  const isBusy = isLoading || isSavingDraft || isPublishing;

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" color={colors.brand.red}>
          PERSONAL TRAINER SETUP · STEP 5 OF 5
        </AppText>

        <AppText variant="h1" color={colors.text.primary}>
          Review your profile.
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          Check your information before publishing. You can keep your profile as a draft
          and return to finish it later.
        </AppText>

        {isLoading ? (
          <AppText variant="body" color={colors.text.secondary}>
            Loading your saved profile…
          </AppText>
        ) : (
          <>
            {renderSection(
              'Public profile preview',
              <>
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.background.secondary,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    overflow: 'hidden',
                  }}
                >
                  {profileImageUrl ? (
                    <Image
                      source={{ uri: profileImageUrl }}
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                      accessibilityLabel={`${fullName || 'Trainer'} profile photo`}
                    />
                  ) : (
                    <AppText variant="h1" color={colors.brand.red}>
                      {fullName
                        .split(' ')
                        .filter(Boolean)
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || '?'}
                    </AppText>
                  )}
                </View>

                <AppText variant="h3" color={colors.text.primary}>
                  {fullName || 'Your name'}
                </AppText>

                {renderValue('Location', trainer?.location ?? '')}
                {renderValue('Professional bio', trainer?.professional_bio ?? '')}
                {renderValue('Coaching approach', trainer?.coaching_approach ?? '')}

                {!profile?.avatar_url ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Profile photo has not been added yet.
                  </AppText>
                ) : (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    A profile photo is saved to your account.
                  </AppText>
                )}
              </>,
            )}

            {renderSection(
              'Expertise and credentials',
              <>
                {renderValue(
                  'Years of experience',
                  trainer?.years_experience == null
                    ? ''
                    : `${trainer.years_experience} ${
                        trainer.years_experience === 1 ? 'year' : 'years'
                      }`,
                )}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Specialities
                  </AppText>
                  {renderTagList(trainer?.specialities)}
                </View>

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Qualifications
                  </AppText>
                  {renderTagList(trainer?.qualifications)}
                </View>

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Certifications
                  </AppText>
                  {renderTagList(trainer?.certifications)}
                </View>
              </>,
            )}

            {renderSection(
              'Session pricing',
              <>
                {renderValue(
                  'Rate per session',
                  pricing
                    ? `${pricing.currency} ${Number(
                        pricing.session_rate,
                      ).toLocaleString()}`
                    : '',
                )}

                {renderValue(
                  'Session duration',
                  pricing ? `${pricing.session_duration_minutes} minutes` : '',
                )}

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Training packages
                  </AppText>

                  {packages.length === 0 ? (
                    <AppText variant="body" color={colors.text.secondary}>
                      No packages added. You can add these later.
                    </AppText>
                  ) : (
                    packages.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          gap: spacing.xs,
                          paddingVertical: spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border.default,
                        }}
                      >
                        <AppText variant="body" color={colors.text.primary}>
                          {item.name}
                        </AppText>
                        {item.description
                          ? renderValue('Details', item.description)
                          : null}
                        <AppText variant="bodySmall" color={colors.text.secondary}>
                          {item.sessions_count} sessions · {item.currency}{' '}
                          {Number(item.price).toLocaleString()}
                        </AppText>
                      </View>
                    ))
                  )}
                </View>
              </>,
            )}

            {renderSection(
              'Weekly availability',
              <>
                {trainer?.availability?.days?.length ? (
                  renderTagList(trainer.availability.days)
                ) : (
                  <AppText variant="body" color={colors.text.secondary}>
                    No availability days selected.
                  </AppText>
                )}
              </>,
            )}

            {renderSection(
              'Profile completeness',
              <>
                <AppText variant="body" color={colors.text.secondary}>
                  {completedItems} of {checklist.length} required items complete
                </AppText>

                {checklist.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <AppText
                      variant="body"
                      color={item.complete ? colors.brand.red : colors.text.secondary}
                    >
                      {item.complete ? '✓' : '○'}
                    </AppText>

                    <AppText
                      variant="body"
                      color={item.complete ? colors.text.primary : colors.text.secondary}
                    >
                      {item.label}
                    </AppText>
                  </View>
                ))}

                {!canPublish ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Complete the outstanding items before publishing. You can save your
                    draft in the meantime.
                  </AppText>
                ) : (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    All required information is complete and ready for publication.
                  </AppText>
                )}
              </>,
            )}
          </>
        )}

        {errorMessage ? (
          <AppText
            variant="bodySmall"
            color={colors.text.error}
            accessibilityRole="alert"
          >
            {errorMessage}
          </AppText>
        ) : null}

        {successMessage ? (
          <AppText variant="bodySmall" color={colors.text.secondary}>
            {successMessage}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: isBusy,
            busy: isSavingDraft,
          }}
          disabled={isBusy}
          onPress={handleSaveDraft}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.brand.red,
            opacity: isBusy ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="buttonLarge" color={colors.brand.red}>
            {isSavingDraft ? 'SAVING DRAFT…' : 'SAVE DRAFT'}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: isBusy || !canPublish,
            busy: isPublishing,
          }}
          disabled={isBusy || !canPublish}
          onPress={handlePublish}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: colors.brand.red,
            opacity: isBusy || !canPublish ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="buttonLarge" color="#FFFFFF">
            {isPublishing ? 'PUBLISHING…' : 'PUBLISH PROFILE'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
