/**
 * MoodMap — 5-4-3-2-1 Grounding Exercise
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';

interface GroundingStep {
  count: number;
  sense: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  description: string;
}

const STEPS: GroundingStep[] = [
  { count: 5, sense: 'See', icon: 'eye', color: '#6BCB77', description: 'Look around and notice 5 things you can see. Take in the colors, shapes, and details.' },
  { count: 4, sense: 'Touch', icon: 'move', color: '#FFBE6A', description: 'Notice 4 things you can physically feel. The texture of your clothes, the surface beneath you.' },
  { count: 3, sense: 'Hear', icon: 'headphones', color: '#74B9FF', description: 'Listen carefully for 3 sounds. Perhaps distant traffic, birds, or your own breathing.' },
  { count: 2, sense: 'Smell', icon: 'wind', color: '#C59CFF', description: 'Identify 2 things you can smell. Fresh air, food, or the scent of something nearby.' },
  { count: 1, sense: 'Taste', icon: 'coffee', color: '#FF7A6E', description: 'Notice 1 thing you can taste. The lingering taste in your mouth or take a sip of water.' },
];

export default function GroundingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const step = STEPS[currentStep];
  const progress = isDone ? 1 : currentStep / STEPS.length;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep(0);
    setIsDone(false);
  };

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Grounding</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: isDone ? Colors.accent.primary : step?.color }]} />
        </View>

        {/* Step indicators */}
        {!isDone && (
          <View style={styles.stepIndicators}>
            {STEPS.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  i <= currentStep && { backgroundColor: STEPS[i].color, borderColor: STEPS[i].color },
                ]}
              />
            ))}
          </View>
        )}

        {/* Main Content */}
        <View style={styles.center}>
          {!isDone ? (
            <Animated.View key={currentStep} entering={FadeInDown.duration(400)} exiting={FadeOutUp.duration(200)} style={styles.stepContent}>
              {/* Large count */}
              <View style={[styles.countCircle, { backgroundColor: `${step.color}12`, borderColor: `${step.color}30` }]}>
                <Text style={[styles.countNumber, { color: step.color }]}>{step.count}</Text>
              </View>

              {/* Sense label */}
              <View style={styles.senseRow}>
                <Feather name={step.icon} size={18} color={step.color} />
                <Text style={[styles.senseLabel, { color: step.color }]}>
                  {step.count} thing{step.count > 1 ? 's' : ''} you can {step.sense}
                </Text>
              </View>

              {/* Description */}
              <Text style={styles.description}>{step.description}</Text>

              {/* Step label */}
              <Text style={styles.stepLabel}>Step {currentStep + 1} of {STEPS.length}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.doneContent}>
              <View style={[styles.doneCircle]}>
                <Feather name="check" size={42} color={Colors.accent.primary} />
              </View>
              <Text style={styles.doneTitle}>You&apos;re grounded</Text>
              <Text style={styles.doneSubtitle}>
                Take a moment to notice how you feel right now. You&apos;ve reconnected with the present moment.
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          {!isDone ? (
            <Button
              title={currentStep < STEPS.length - 1 ? 'Next' : 'Complete'}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleNext}
            />
          ) : (
            <View style={styles.doneActions}>
              <Button title="Do Again" variant="ghost" size="md" style={{ flex: 1 }} onPress={handleReset} />
              <Button title="Done" variant="primary" size="md" style={{ flex: 1 }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} />
            </View>
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SCREEN_PADDING },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  headerTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },

  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  stepContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  countCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
  },
  countNumber: {
    fontFamily: Fonts.heading,
    fontSize: 56,
    lineHeight: 64,
  },
  senseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  senseLabel: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
  },
  description: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  stepLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  doneContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  doneCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: `${Colors.accent.primary}15`,
    borderWidth: 2,
    borderColor: `${Colors.accent.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  doneTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  doneSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottom: {
    paddingTop: Spacing.lg,
  },
  doneActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
