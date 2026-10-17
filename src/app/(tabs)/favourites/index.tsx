import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Heart, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

export default function FavouriteTrainersScreen() {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;
  const { user } = useAuth();

  const [trainers, setTrainers] = useState<PublishedTrainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removingTrainerId, setRemovingTrainerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFavourites = useCallback(
    async (refresh = false) => {
      if (!user) {
        setTrainers([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('trainer_favourites')
          .select('trainer_id, created_at')
          .eq('gym_goer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const favouriteIds = (data ?? []).map((item) => item.trainer_id);

        if (favouriteIds.length === 0) {
          setTrainers([]);
          return;
        }

        const publishedTrainers = await discoverPublishedTrainers();
        const favouriteTrainers = publishedTrainers.filter((trainer) =>
          favouriteIds.includes(trainer.trainer_id),
        );

        setTrainers(favouriteTrainers);
      } catch (error) {
        console.error('[Favourites] Unable to load saved trainers:', error);
        setErrorMessage('We couldn’t load your saved trainers. Please try again.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFavourites();
    }, [loadFavourites]),
  );

  const removeFavourite = useCallback(
    async (trainerId: string) => {
      if (!user || removingTrainerId) {
        return;
      }

      setRemovingTrainerId(trainerId);

      try {
        const { error } = await supabase
          .from('trainer_favourites')
          .delete()
          .eq('gym_goer_id', user.id)
          .eq('trainer_id', trainerId);

        if (error) {
          throw error;
        }

        setTrainers((current) =>
          current.filter((trainer) => trainer.trainer_id !== trainerId),
        );
      } catch (error) {
        console.error('[Favourites] Unable to remove trainer:', error);
        setErrorMessage('We couldn’t remove this trainer. Please try again.');
      } finally {
        setRemovingTrainerId(null);
      }
    },
    [user, removingTrainerId],
  );

  const formatRate = (trainer: PublishedTrainer) => {
    if (trainer.session_rate == null) {
      return 'Rate not set';
    }

    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(trainer.session_rate);

    return `${trainer.currency ?? ''} ${amount}${
      trainer.session_duration_minutes ? ` / ${trainer.session_duration_minutes} min` : ''
    }`.trim();
  };

  const openTrainerProfile = (trainerId: string) => {
    router.push({
      pathname: '/(tabs)/trainer-profile/[id]',
      params: { id: trainerId },
    });
  };

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
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadFavourites(true)}
            tintColor={colors.brand.red}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.sm }}>
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            YOUR COLLECTION
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            SAVED TRAINERS
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Keep your favourite coaches close so you can find them again whenever you need
            them.
          </AppText>
        </View>

        {!user ? (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              gap: spacing.md,
              borderRadius: 16,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Heart size={32} color={colors.brand.red} />
            <AppText variant="h3" color={colors.text.primary}>
              Sign in to save trainers
            </AppText>
            <AppText variant="body" color={colors.text.secondary}>
              Your saved trainers will be available here when you sign in.
            </AppText>
          </View>
        ) : isLoading ? (
          <View
            style={{
              minHeight: 220,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />
            <AppText variant="body" color={colors.text.secondary}>
              Loading saved trainers…
            </AppText>
          </View>
        ) : errorMessage ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 16,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              Something went wrong
            </AppText>
            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage}
            </AppText>
            <Button variant="primary" onPress={() => void loadFavourites()}>
              Try again
            </Button>
          </View>
        ) : trainers.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <Heart size={36} color={colors.brand.red} />
            <AppText variant="h3" color={colors.text.primary}>
              No saved trainers yet
            </AppText>
            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              Browse Discover and tap the heart on a trainer’s card to save them here.
            </AppText>
            <Button
              variant="primary"
              onPress={() => router.push('/(tabs)/gym-goer/discover')}
              rightIcon={<Search size={18} color="#FFFFFF" />}
            >
              Discover trainers
            </Button>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="h2" color={colors.text.primary}>
              {trainers.length} {trainers.length === 1 ? 'TRAINER' : 'TRAINERS'}
            </AppText>

            {trainers.map((trainer) => {
              const fullName = [trainer.first_name, trainer.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              return (
                <View
                  key={trainer.trainer_id}
                  style={{
                    padding: spacing.md,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.md,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View profile for ${fullName || 'TRAINR Coach'}`}
                    onPress={() => openTrainerProfile(trainer.trainer_id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    {trainer.avatar_url ? (
                      <Image
                        source={{ uri: trainer.avatar_url }}
                        accessibilityLabel={`Profile photo of ${fullName || 'TRAINR Coach'}`}
                        resizeMode="cover"
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: colors.background.primary,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.background.primary,
                          borderWidth: 1,
                          borderColor: colors.border.default,
                        }}
                      >
                        <AppText variant="h2" color={colors.brand.red}>
                          {fullName.charAt(0).toUpperCase() || 'T'}
                        </AppText>
                      </View>
                    )}

                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="h3" color={colors.text.primary}>
                        {fullName || 'TRAINR Coach'}
                      </AppText>

                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {trainer.location?.trim() || 'Personal trainer'}
                      </AppText>

                      <AppText variant="h3" color={colors.brand.red}>
                        {formatRate(trainer)}
                      </AppText>
                    </View>

                    <ArrowRight size={18} color={colors.text.secondary} />
                  </Pressable>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: colors.border.default,
                      paddingTop: spacing.md,
                      gap: spacing.md,
                    }}
                  >
                    <AppText variant="caption" color={colors.text.secondary}>
                      Saved trainer
                    </AppText>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${fullName || 'trainer'} from favourites`}
                      disabled={removingTrainerId === trainer.trainer_id}
                      onPress={() => void removeFavourite(trainer.trainer_id)}
                      style={{
                        minHeight: 40,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs,
                        paddingHorizontal: spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        opacity: removingTrainerId === trainer.trainer_id ? 0.5 : 1,
                      }}
                    >
                      {removingTrainerId === trainer.trainer_id ? (
                        <ActivityIndicator size="small" color={colors.brand.red} />
                      ) : (
                        <Heart
                          size={17}
                          color={colors.brand.red}
                          fill={colors.brand.red}
                        />
                      )}
                      <AppText variant="button" color={colors.text.primary}>
                        Remove
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
