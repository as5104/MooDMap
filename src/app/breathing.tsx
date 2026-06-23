/**
 * MoodMap - Breathing Exercise
 */


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done';

const INHALE_DURATION = 4000;
const HOLD_DURATION = 7000;
const EXHALE_DURATION = 8000;
const TOTAL_CYCLES = 4;

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Ready to begin',
  inhale: 'Breathe In',
  hold: 'Hold',
  exhale: 'Breathe Out',
  done: 'Well done',
};

const PHASE_COLORS: Record<Phase, string> = {
  idle: Colors.text.secondary,
  inhale: '#6BCB77',
  hold: '#FFBE6A',
  exhale: '#74B9FF',
  done: Colors.accent.primary,
};

export default function BreathingScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [cycle, setCycle] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated circle scale
  const circleScale = useSharedValue(0.5);
  const circleOpacity = useSharedValue(0.3);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const runPhase = useCallback((currentPhase: Phase, currentCycle: number) => {
    if (currentPhase === 'done') {
      setPhase('done');
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      circleScale.value = withTiming(0.7, { duration: 500, easing: Easing.out(Easing.cubic) });
      circleOpacity.value = withTiming(0.6, { duration: 500 });
      return;
    }

    setPhase(currentPhase);
    triggerHaptic();

    if (currentPhase === 'inhale') {
      startCountdown(4);
      circleScale.value = withTiming(1, { duration: INHALE_DURATION, easing: Easing.inOut(Easing.cubic) });
      circleOpacity.value = withTiming(0.7, { duration: INHALE_DURATION });
      timerRef.current = setTimeout(() => runPhase('hold', currentCycle), INHALE_DURATION);
    } else if (currentPhase === 'hold') {
      startCountdown(7);
      timerRef.current = setTimeout(() => runPhase('exhale', currentCycle), HOLD_DURATION);
    } else if (currentPhase === 'exhale') {
      startCountdown(8);
      circleScale.value = withTiming(0.5, { duration: EXHALE_DURATION, easing: Easing.inOut(Easing.cubic) });
      circleOpacity.value = withTiming(0.3, { duration: EXHALE_DURATION });
      const nextCycle = currentCycle + 1;
      timerRef.current = setTimeout(() => {
        if (nextCycle >= TOTAL_CYCLES) {
          runPhase('done', nextCycle);
        } else {
          setCycle(nextCycle);
          runPhase('inhale', nextCycle);
        }
      }, EXHALE_DURATION);
    }
  }, [circleScale, circleOpacity, triggerHaptic, startCountdown]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRunning(true);
    setCycle(0);
    circleScale.value = 0.5;
    circleOpacity.value = 0.3;
    runPhase('inhale', 0);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPhase('idle');
    setCycle(0);
    setIsRunning(false);
    setCountdown(0);
    circleScale.value = withTiming(0.5, { duration: 300 });
    circleOpacity.value = withTiming(0.3, { duration: 300 });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const phaseColor = PHASE_COLORS[phase];

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Breathing</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Main Content */}
        <View style={styles.center}>
          {/* Cycle Counter */}
          {isRunning && phase !== 'done' && (
            <Text style={styles.cycleText}>Cycle {cycle + 1} of {TOTAL_CYCLES}</Text>
          )}

          {/* Animated Circle */}
          <View style={styles.circleWrapper}>
            {/* Outer glow ring */}
            <Animated.View style={[styles.glowRing, { borderColor: `${phaseColor}30` }, circleStyle]} />
            {/* Main circle */}
            <Animated.View style={[styles.breathCircle, { backgroundColor: `${phaseColor}15`, borderColor: `${phaseColor}40` }, circleStyle]}>
              <View style={styles.circleInner}>
                {countdown > 0 && phase !== 'idle' && phase !== 'done' ? (
                  <Text style={[styles.countdownText, { color: phaseColor }]}>{countdown}</Text>
                ) : (
                  <Feather name="wind" size={36} color={phaseColor} />
                )}
              </View>
            </Animated.View>
          </View>

          {/* Phase Label */}
          <Text style={[styles.phaseLabel, { color: phaseColor }]}>{PHASE_LABELS[phase]}</Text>

          {phase === 'idle' && (
            <Text style={styles.instruction}>
              4 seconds inhale{'\n'}7 seconds hold{'\n'}8 seconds exhale
            </Text>
          )}

          {phase === 'done' && (
            <Text style={styles.instruction}>
              You completed {TOTAL_CYCLES} breathing cycles.{'\n'}Feel the calm settle in.
            </Text>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          {phase === 'idle' && (
            <Button title="Start Breathing" variant="primary" size="lg" fullWidth onPress={handleStart} />
          )}
          {isRunning && phase !== 'done' && (
            <Button title="Stop" variant="ghost" size="md" fullWidth onPress={handleReset} />
          )}
          {phase === 'done' && (
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

const CIRCLE_SIZE = 220;

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SCREEN_PADDING },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxl,
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  cycleText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xxl,
  },
  circleWrapper: {
    width: CIRCLE_SIZE + 40,
    height: CIRCLE_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 40,
    height: CIRCLE_SIZE + 40,
    borderRadius: (CIRCLE_SIZE + 40) / 2,
    borderWidth: 2,
  },
  breathCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontFamily: Fonts.heading,
    fontSize: 48,
    lineHeight: 54,
  },
  phaseLabel: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h2,
    marginTop: Spacing.xxxl,
    textAlign: 'center',
  },
  instruction: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.lg,
    maxWidth: 260,
  },

  bottom: {
    paddingTop: Spacing.lg,
  },
  doneActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
