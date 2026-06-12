/**
 * MoodMap - Onboarding Flow
 */

import { AnimatedPressable, Button, GradientBackground } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/layout';
import { Fonts, FontSizes } from '@/constants/typography';
import { useAppStore } from '@/stores/appStore';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 700;

interface OnboardingSlide {
  id: string;
  title: string;
  titleFlow?: string[];
  subtitle: string;
  features?: { icon: keyof typeof Feather.glyphMap; label: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to\nMoodMap',
    subtitle: 'Your personal mood companion.\nTrack how you feel, discover patterns,\nand grow every day.',
  },
  {
    id: '2',
    title: 'Track Reflect Grow',
    titleFlow: ['Track', 'Reflect', 'Grow'],
    subtitle: 'Everything you need to understand\nyour emotional world.',
    features: [
      { icon: 'smile', label: 'Daily mood check-in' },
      { icon: 'book-open', label: 'Guided journaling' },
      { icon: 'bar-chart-2', label: 'Insights & patterns' },
      { icon: 'music', label: 'Calming activities' },
      { icon: 'award', label: 'Streaks & achievements' },
      { icon: 'lock', label: 'Private & secure' },
    ],
  },
  {
    id: '3',
    title: "Let's Get Started",
    subtitle: "You're all set! Start logging your\nfirst mood and begin your journey.",
  },
];

// Animated Abstract SVG Background
interface AbstractBackgroundProps {
  scrollX: Animated.Value;
}

const AbstractBackground: React.FC<AbstractBackgroundProps> = ({ scrollX }) => {
  // Slide 1 interpolations
  const slide1Opacity = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const slide1TranslateY = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [0, -60],
    extrapolate: 'clamp',
  });
  const slide1Scale = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  // Slide 2 interpolations
  const slide2Opacity = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const slide2TranslateX = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [80, 0, -80],
    extrapolate: 'clamp',
  });
  const slide2Scale = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [0.9, 1, 0.9],
    extrapolate: 'clamp',
  });

  // Slide 3 interpolations
  const slide3Opacity = scrollX.interpolate({
    inputRange: [SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const slide3TranslateY = scrollX.interpolate({
    inputRange: [SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [60, 0],
    extrapolate: 'clamp',
  });
  const slide3Scale = scrollX.interpolate({
    inputRange: [SCREEN_WIDTH, SCREEN_WIDTH * 2],
    outputRange: [0.85, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Slide 1 background blobs */}
      <Animated.View
        style={[
          styles.svgContainer,
          {
            opacity: slide1Opacity,
            transform: [{ translateY: slide1TranslateY }, { scale: slide1Scale }],
          },
        ]}
      >
        <Svg width={500} height={500} viewBox="0 0 500 500" style={styles.topLeftBlob}>
          <Defs>
            <LinearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.accent.primary} stopOpacity="0.22" />
              <Stop offset="50%" stopColor="#4ECDC4" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M400,150 C450,220 420,320 350,380 C280,440 170,460 120,400 C70,340 80,200 130,130 C180,60 270,80 340,90 C410,100 350,80 400,150 Z"
            fill="url(#grad1)"
          />
        </Svg>
        <Svg width={300} height={300} viewBox="0 0 300 300" style={styles.bottomLeftBlob}>
          <Defs>
            <LinearGradient id="grad1Sub" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.accent.lavender} stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Circle cx={150} cy={150} r={120} fill="url(#grad1Sub)" />
        </Svg>
      </Animated.View>

      {/* Slide 2 background curves */}
      <Animated.View
        style={[
          styles.svgContainer,
          {
            opacity: slide2Opacity,
            transform: [{ translateX: slide2TranslateX }, { scale: slide2Scale }],
          },
        ]}
      >
        <Svg width={400} height={400} viewBox="0 0 400 400" style={styles.centerRightCurves}>
          <Defs>
            <LinearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.accent.lavender} stopOpacity="0.18" />
              <Stop offset="50%" stopColor={Colors.accent.primary} stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M50,320 C120,280 90,120 220,100 C350,80 290,290 350,250"
            fill="none"
            stroke="url(#grad2)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="10, 12"
          />
          <Circle cx={220} cy={100} r={24} fill="url(#grad2)" opacity={0.5} />
          <Circle cx={350} cy={250} r={12} fill="url(#grad2)" opacity={0.7} />
          <Circle cx={50} cy={320} r={16} fill="url(#grad2)" opacity={0.3} />
        </Svg>
      </Animated.View>

      {/* Slide 3 background: Mindful Sunrise & Waves */}
      <Animated.View
        style={[
          styles.svgContainer,
          {
            opacity: slide3Opacity,
            transform: [{ translateY: slide3TranslateY }, { scale: slide3Scale }],
          },
        ]}
      >
        <Svg width={450} height={450} viewBox="0 0 450 450" style={styles.bottomCenterRings}>
          <Defs>
            <LinearGradient id="sunriseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={Colors.accent.primary} stopOpacity="0.28" />
              <Stop offset="100%" stopColor={Colors.accent.lavender} stopOpacity="0.04" />
            </LinearGradient>
            <LinearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.14" />
              <Stop offset="100%" stopColor={Colors.accent.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          {/* Rising Sun */}
          <Circle cx={225} cy={180} r={70} fill="url(#sunriseGrad)" />
          {/* Sun Rays / Aura Circles */}
          <Circle cx={225} cy={180} r={110} fill="none" stroke={Colors.accent.primary} strokeWidth={1} strokeDasharray="6, 12" opacity={0.25} />
          <Circle cx={225} cy={180} r={150} fill="none" stroke={Colors.accent.lavender} strokeWidth={1.5} opacity={0.12} />

          {/* Smooth waves */}
          <Path
            d="M -50 310 Q 120 250 280 320 T 500 280 L 500 450 L -50 450 Z"
            fill="url(#waveGrad)"
          />
          <Path
            d="M -50 340 Q 100 290 230 350 T 500 320 L 500 450 L -50 450 Z"
            fill="url(#waveGrad)"
            opacity={0.6}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList>(null);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setCurrentIndex(Number(viewableItems[0].index));
      }
    },
    []
  );

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleGetStarted = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const renderSlideTitle = (item: OnboardingSlide) => {
    if (!item.titleFlow) {
      return <Text style={styles.slideTitle}>{item.title}</Text>;
    }

    return (
      <View style={styles.titleFlow} accessibilityLabel={item.titleFlow.join(' to ')}>
        {item.titleFlow.map((label, index) => (
          <React.Fragment key={label}>
            <Text style={styles.titleFlowText}>{label}</Text>
            {index < item.titleFlow!.length - 1 && (
              <Feather
                name="arrow-right"
                size={20}
                color={Colors.accent.olive}
                style={styles.titleFlowIcon}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp',
    });

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [20, 0, -20],
      extrapolate: 'clamp',
    });

    const isFinalSlide = item.id === '3';

    return (
      <View style={styles.slide}>
        {isFinalSlide ? (
          <>
            <View style={styles.slideTextContainer}>
              {renderSlideTitle(item)}
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
            <Animated.View
              style={[
                styles.illustrationContainerFinal,
                {
                  opacity,
                  transform: [{ scale }, { translateY }],
                },
              ]}
            >
              <Image
                source={require('../../../assets/images/mountain_bike_bro.svg')}
                style={styles.illustrationFinal}
                contentFit="contain"
              />
            </Animated.View>
          </>
        ) : (
          <>
            <Animated.View
              style={[
                item.id === '1' ? styles.illustrationContainerSlide1 : styles.illustrationContainer,
                {
                  opacity,
                  transform: [{ scale }, { translateY }],
                },
              ]}
            >
              {/* Subtle radial glow beneath Slide 1 illustration */}
              {item.id === '1' && (
                <View style={styles.illustrationGlow}>
                  <Svg width={200} height={60} viewBox="0 0 200 60">
                    <Defs>
                      <RadialGradient id="glowGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0%" stopColor={Colors.accent.primary} stopOpacity="0.18" />
                        <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
                      </RadialGradient>
                    </Defs>
                    <Ellipse cx={100} cy={30} rx={100} ry={30} fill="url(#glowGrad)" />
                  </Svg>
                </View>
              )}
              <Image
                source={
                  item.id === '1'
                    ? require('../../../assets/images/olive_tree_rafiki.svg')
                    : require('../../../assets/images/its_friday_cuate.svg')
                }
                style={styles.illustration}
                contentFit="contain"
              />
            </Animated.View>
            {renderSlideTitle(item)}
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

            {item.features && (
              <View style={styles.featureGrid}>
                {item.features.map((f, i) => (
                  <View key={i} style={styles.featureGridItem}>
                    <View style={styles.featureIconWrap}>
                      <Feather name={f.icon} size={16} color={Colors.accent.olive} />
                    </View>
                    <Text style={styles.featureGridLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <GradientBackground variant="glow">
      <View style={styles.container}>
        <AbstractBackground scrollX={scrollX} />

        {!isLastSlide && (
          <AnimatedPressable style={[styles.skipButton, { top: insets.top + Spacing.lg }]} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </AnimatedPressable>
        )}

        <Animated.FlatList
          ref={flatListRef as any}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item: any) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          bounces={false}
          style={styles.slider}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xxl) + 16 }]}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {isLastSlide ? (
            <Button
              title="Get Started"
              onPress={handleGetStarted}
              size="lg"
              variant="olive"
              fullWidth
              style={styles.ctaButton}
            />
          ) : (
            <Button
              title="Next"
              onPress={handleNext}
              size="lg"
              variant="olive"
              fullWidth
              style={styles.ctaButton}
            />
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
  },

  slider: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: IS_COMPACT_HEIGHT ? Spacing.xxl : 40,
    paddingTop: IS_COMPACT_HEIGHT ? Spacing.xl : Spacing.xxxl,
    paddingBottom: IS_COMPACT_HEIGHT ? Spacing.xl : Spacing.xxxl,
  },
  illustrationContainerSlide1: {
    width: IS_COMPACT_HEIGHT ? 160 : 270,
    height: IS_COMPACT_HEIGHT ? 160 : 270,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.lg,
  },
  illustrationContainer: {
    width: IS_COMPACT_HEIGHT ? 160 : 240,
    height: IS_COMPACT_HEIGHT ? 160 : 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: IS_COMPACT_HEIGHT ? 16 : 40,
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.lg,
  },
  illustrationGlow: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  slideTitle: {
    fontFamily: Fonts.heading,
    fontSize: IS_COMPACT_HEIGHT ? FontSizes.h2 : FontSizes.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.xs : Spacing.md,
    lineHeight: IS_COMPACT_HEIGHT ? 31 : 36,
  },
  titleFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.xs : Spacing.md,
  },
  titleFlowText: {
    fontFamily: Fonts.heading,
    fontSize: IS_COMPACT_HEIGHT ? FontSizes.h2 : FontSizes.h1,
    lineHeight: IS_COMPACT_HEIGHT ? 31 : 36,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  titleFlowIcon: {
    marginHorizontal: IS_COMPACT_HEIGHT ? Spacing.xs : Spacing.sm,
  },
  slideSubtitle: {
    fontFamily: Fonts.body,
    fontSize: IS_COMPACT_HEIGHT ? FontSizes.caption : FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: IS_COMPACT_HEIGHT ? 20 : 26,
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: Spacing.sm,
    marginTop: IS_COMPACT_HEIGHT ? 4 : Spacing.sm,
  },
  featureGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    paddingVertical: IS_COMPACT_HEIGHT ? 8 : 12,
    paddingHorizontal: IS_COMPACT_HEIGHT ? 10 : 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  featureIconWrap: {
    marginRight: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 255, 108, 0.08)',
  },
  featureGridLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: IS_COMPACT_HEIGHT ? 11 : 13,
    color: Colors.text.primary,
    flex: 1,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.lg : Spacing.xxl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.tertiary,
  },
  dotActive: {
    backgroundColor: Colors.accent.olive,
    width: 24,
  },
  ctaButton: {
    marginTop: Spacing.sm,
    height: 56,
    borderRadius: 9999,
  },

  slideTextContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: IS_COMPACT_HEIGHT ? 10 : 30,
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.md,
  },
  illustrationContainerFinal: {
    width: SCREEN_WIDTH * 0.95,
    height: IS_COMPACT_HEIGHT ? 220 : SCREEN_HEIGHT * 0.42,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: IS_COMPACT_HEIGHT ? 10 : 16,
    marginBottom: IS_COMPACT_HEIGHT ? -20 : -30,
  },
  illustrationFinal: {
    width: '100%',
    height: '100%',
  },


  // SVGs Styling
  svgContainer: {
    ...(StyleSheet.absoluteFill as object),
  },
  topLeftBlob: {
    position: 'absolute',
    top: -50,
    right: -100,
  },
  bottomLeftBlob: {
    position: 'absolute',
    bottom: '12%',
    left: -100,
  },
  centerRightCurves: {
    position: 'absolute',
    top: '25%',
    right: -40,
  },
  bottomCenterRings: {
    position: 'absolute',
    bottom: IS_COMPACT_HEIGHT ? '-10%' : '-5%',
    alignSelf: 'center',
  },
});
