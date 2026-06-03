/**
 * MoodMap - Onboarding Flow
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Dimensions,
  type ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground, Button, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 700;
const SLIDE_ICON_SIZE = IS_COMPACT_HEIGHT ? 68 : 82;

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  titleFlow?: string[];
  subtitle: string;
  features?: { icon: keyof typeof Feather.glyphMap; label: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'map',
    title: 'Welcome to\nMoodMap',
    subtitle: 'Your personal mood companion.\nTrack how you feel, discover patterns,\nand grow every day.',
  },
  {
    id: '2',
    icon: 'star',
    title: 'Track Reflect Grow',
    titleFlow: ['Track', 'Reflect', 'Grow'],
    subtitle: 'Everything you need to understand\nyour emotional world.',
    features: [
      { icon: 'smile', label: 'Daily mood check-in' },
      { icon: 'book-open', label: 'Guided journaling' },
      { icon: 'bar-chart-2', label: 'Insights & patterns' },
      { icon: 'music', label: 'Calming activities' },
      { icon: 'award', label: 'Streaks & achievements' },
    ],
  },
  {
    id: '3',
    icon: 'zap',
    title: 'Let\'s Get Started',
    subtitle: 'You\'re all set! Start logging your\nfirst mood and begin your journey.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setCurrentIndex(Number(viewableItems[0].index));
      }
    }
  ).current;

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

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.slideIconWrap}>
        <Feather name={item.icon} size={IS_COMPACT_HEIGHT ? 32 : 36} color={Colors.accent.olive} />
      </View>
      {renderSlideTitle(item)}
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

      {item.features && (
        <View style={styles.featureList}>
          {item.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather name={f.icon} size={20} color={Colors.accent.olive} style={styles.featureIcon} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <GradientBackground variant="glow">
      <View style={styles.container}>
        {!isLastSlide && (
          <AnimatedPressable style={[styles.skipButton, { top: insets.top + Spacing.lg }]} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </AnimatedPressable>
        )}

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          bounces={false}
          style={styles.slider}
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
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
              fullWidth
              style={styles.ctaButton}
            />
          ) : (
            <Button
              title="Next"
              onPress={handleNext}
              size="lg"
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
  slideIconWrap: {
    width: SLIDE_ICON_SIZE,
    height: SLIDE_ICON_SIZE,
    borderRadius: SLIDE_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.md : Spacing.xl,
  },
  slideTitle: {
    fontFamily: Fonts.heading,
    fontSize: IS_COMPACT_HEIGHT ? FontSizes.h2 : FontSizes.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.md : Spacing.lg,
    lineHeight: IS_COMPACT_HEIGHT ? 31 : 36,
  },
  titleFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.md : Spacing.lg,
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
  },
  featureList: {
    marginTop: IS_COMPACT_HEIGHT ? Spacing.lg : Spacing.xxl,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.md,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    paddingVertical: IS_COMPACT_HEIGHT ? Spacing.sm : Spacing.md,
    paddingHorizontal: IS_COMPACT_HEIGHT ? Spacing.md : Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  featureIcon: {
    marginRight: Spacing.md,
  },
  featureLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: IS_COMPACT_HEIGHT ? FontSizes.caption : FontSizes.body,
    color: Colors.text.primary,
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
  },
});
