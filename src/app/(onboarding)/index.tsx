/**
 * MoodMap — Onboarding Flow
 * 3 slides: Welcome → Features → Setup → Home
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
import { GradientBackground, Button, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  features?: { icon: string; label: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    emoji: '🗺️',
    title: 'Welcome to\nMoodMap',
    subtitle: 'Your personal mood companion.\nTrack how you feel, discover patterns,\nand grow every day.',
  },
  {
    id: '2',
    emoji: '✨',
    title: 'Track · Reflect · Grow',
    subtitle: 'Everything you need to understand\nyour emotional world.',
    features: [
      { icon: '😊', label: 'Daily mood check-in' },
      { icon: '📖', label: 'Guided journaling' },
      { icon: '📊', label: 'Insights & patterns' },
      { icon: '🎵', label: 'Calming activities' },
      { icon: '🏆', label: 'Streaks & achievements' },
    ],
  },
  {
    id: '3',
    emoji: '🚀',
    title: 'Let\'s Get Started',
    subtitle: 'You\'re all set! Start logging your\nfirst mood and begin your journey.',
  },
];

export default function OnboardingScreen() {
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

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <Text style={styles.slideEmoji}>{item.emoji}</Text>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

      {item.features && (
        <View style={styles.featureList}>
          {item.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <GradientBackground withGlow>
      <View style={styles.container}>
        {/* Skip button */}
        {!isLastSlide && (
          <AnimatedPressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </AnimatedPressable>
        )}

        {/* Slides */}
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
        />

        {/* Dots & Action */}
        <View style={styles.footer}>
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
    paddingTop: 60,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
  },

  // Slides
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  slideEmoji: {
    fontSize: 72,
    marginBottom: Spacing.xxl,
  },
  slideTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 36,
  },
  slideSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  featureList: {
    marginTop: Spacing.xxxl,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: Spacing.lg,
  },
  featureLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.tertiary,
  },
  dotActive: {
    backgroundColor: Colors.accent.primary,
    width: 24,
  },
  ctaButton: {
    marginTop: Spacing.sm,
  },
});
