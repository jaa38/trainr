import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

const welcomeSlides = [
  {
    id: 'bold',
    title: 'Your journey. Your rules.',
    subtitle: 'Training built around you.',
    lightImage: require('../../assets/images/welcome/boldLight.png'),
    darkImage: require('../../assets/images/welcome/boldDark.png'),
    accessibilityLabel: 'Personal trainer coaching an athlete',
  },
  {
    id: 'focused',
    title: 'FIND YOUR FOCUS.',
    subtitle:
      'Build discipline, sharpen your mindset, and turn your fitness goals into progress.',
    lightImage: require('../../assets/images/welcome/focusedLight.png'),
    darkImage: require('../../assets/images/welcome/focusedDark.png'),
    accessibilityLabel: 'Athlete training with focus and determination',
  },
  {
    id: 'relentless',
    title: 'BUILT THROUGH GRIT.',
    subtitle:
      'Every challenge builds resilience. Every session moves you closer to your potential.',
    lightImage: require('../../assets/images/welcome/relentlessLight.png'),
    darkImage: require('../../assets/images/welcome/relentlessDark.png'),
    accessibilityLabel: 'Athlete training with determination and resilience',
  },
];

const SLIDE_DURATION = 5000;
const TRANSITION_DURATION = 700;
const SLIDE_DISTANCE = 40;

export default function HomeScreen() {
  const { colors, spacing, mode } = useTrainrTheme();

  const [activeSlide, setActiveSlide] = useState(0);

  // Initialise animation values lazily without reading refs during render.
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));

  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTransitioning = useRef(false);

  const currentSlide = welcomeSlides[activeSlide];

  const welcomeImage = mode === 'dark' ? currentSlide.darkImage : currentSlide.lightImage;

  const appIcon =
    mode === 'dark'
      ? require('../../assets/images/icons/darkModeAppIcon.png')
      : require('../../assets/images/icons/lightModeAppIcon.png');

  useEffect(() => {
    let isMounted = true;

    const scheduleNextSlide = () => {
      slideTimer.current = setTimeout(() => {
        animateSlide();
      }, SLIDE_DURATION);
    };

    const animateSlide = () => {
      if (!isMounted || isTransitioning.current) {
        return;
      }

      isTransitioning.current = true;

      // Move the current slide out to the left.
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: TRANSITION_DURATION / 2,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -SLIDE_DISTANCE,
          duration: TRANSITION_DURATION / 2,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !isMounted) {
          isTransitioning.current = false;
          return;
        }

        // Update the slide content.
        setActiveSlide((previous) => (previous + 1) % welcomeSlides.length);

        // Position the incoming slide to the right.
        translateX.setValue(SLIDE_DISTANCE);

        // Slide the new content into view.
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: TRANSITION_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: TRANSITION_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(({ finished: enterFinished }) => {
          isTransitioning.current = false;

          if (isMounted && enterFinished) {
            scheduleNextSlide();
          }
        });
      });
    };

    scheduleNextSlide();

    return () => {
      isMounted = false;

      if (slideTimer.current) {
        clearTimeout(slideTimer.current);
        slideTimer.current = null;
      }

      fadeAnim.stopAnimation();
      translateX.stopAnimation();
      isTransitioning.current = false;
    };
  }, [fadeAnim, translateX]);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xl,
          }}
        >
          <Image
            source={appIcon}
            style={{
              width: 48,
              height: 48,
              resizeMode: 'contain',
            }}
            accessibilityLabel="TRAINR app icon"
          />

          <View style={{ gap: 2 }}>
            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              YOUR FITNESS. YOUR JOURNEY.
            </AppText>
          </View>
        </View>

        {/* Main Hero Heading */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="displayLarge" color={colors.text.primary}>
            BUILD YOUR
          </AppText>

          <AppText variant="displayLarge" color={colors.brand.red}>
            STRONGER SELF.
          </AppText>
        </View>

        {/* Animated Welcome Image and Caption */}
        <Animated.View
          style={{
            marginTop: spacing.lg,
            marginBottom: spacing.md,
            opacity: fadeAnim,
            transform: [{ translateX }],
          }}
        >
          {/* Featured Training Image */}
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: 20,
            }}
          >
            <Image
              source={welcomeImage}
              style={{
                width: '100%',
                height: 300,
                resizeMode: 'contain',
              }}
              accessibilityLabel={currentSlide.accessibilityLabel}
              accessible
            />
          </View>

          {/* Animated Caption */}
          <View
            style={{
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.md,
              paddingHorizontal: spacing.xs,
              minHeight: 100,
            }}
          >
            <AppText
              variant="h2"
              color={currentSlide.id === 'bold' ? colors.text.primary : colors.brand.red}
              style={{
                textAlign: 'center',
              }}
            >
              {currentSlide.title}
            </AppText>

            <AppText
              variant="bodySmall"
              color={colors.text.secondary}
              style={{
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {currentSlide.subtitle}
            </AppText>
          </View>
        </Animated.View>

        {/* Slide Indicators */}
        <View
          accessibilityLabel={`Welcome slide ${activeSlide + 1} of ${welcomeSlides.length}`}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: welcomeSlides.length,
            now: activeSlide + 1,
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            marginBottom: spacing.lg,
          }}
        >
          {welcomeSlides.map((slide, index) => (
            <View
              key={slide.id}
              style={{
                width: activeSlide === index ? 24 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  activeSlide === index ? colors.brand.red : colors.border.default,
              }}
            />
          ))}
        </View>

        {/* Authentication Actions */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: 'auto',
            paddingTop: spacing.md,
          }}
        >
          {/* Primary Action */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started and create an account"
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity: pressed ? 0.82 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <AppText variant="buttonLarge" color="#FFFFFF">
              Get Started
            </AppText>
          </Pressable>

          {/* Secondary Action */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to your account"
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.primary,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <AppText variant="buttonLarge" color={colors.text.primary}>
              Sign In
            </AppText>
          </Pressable>
        </View>

        {/* Footer */}
        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{
            textAlign: 'center',
            marginTop: spacing.md,
          }}
        >
          YOUR NEXT CHAPTER STARTS HERE.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
