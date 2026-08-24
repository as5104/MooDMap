/**
 * MoodMap — Breathing Studio
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BreathPattern {
  id: string;
  name: string;
  badge: string;
  subtitle: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  phases: {
    label: string;
    durationMs: number;
    targetScale: number;
    color: string;
    instructions: string;
  }[];
  cycles: number;
}

const PATTERNS: BreathPattern[] = [
  {
    id: '478',
    name: '4-7-8 Deep Calm',
    badge: 'Sleep & Calm',
    subtitle: 'Clinical breathwork for deep parasympathetic calm & sleep',
    color: '#10B981',
    icon: 'moon',
    cycles: 4,
    phases: [
      { label: 'Inhale', durationMs: 4000, targetScale: 1.0, color: '#10B981', instructions: 'Inhale quietly through your nose' },
      { label: 'Hold', durationMs: 7000, targetScale: 1.0, color: '#F59E0B', instructions: 'Hold your breath gently' },
      { label: 'Exhale', durationMs: 8000, targetScale: 0.5, color: '#6366F1', instructions: 'Exhale completely with a whoosh sound' },
    ],
  },
  {
    id: 'box',
    name: 'Box Breathing',
    badge: 'Focus',
    subtitle: 'Navy SEAL method for instant mental clarity',
    color: '#06B6D4',
    icon: 'square',
    cycles: 4,
    phases: [
      { label: 'Inhale', durationMs: 4000, targetScale: 1.0, color: '#06B6D4', instructions: 'Breathe in slowly to 4 counts' },
      { label: 'Hold', durationMs: 4000, targetScale: 1.0, color: '#F59E0B', instructions: 'Hold breath gently to 4 counts' },
      { label: 'Exhale', durationMs: 4000, targetScale: 0.5, color: '#3B82F6', instructions: 'Exhale smoothly to 4 counts' },
      { label: 'Hold Empty', durationMs: 4000, targetScale: 0.5, color: '#8B5CF6', instructions: 'Stay still and calm to 4 counts' },
    ],
  },
  {
    id: 'sigh',
    name: 'Physiological Sigh',
    badge: 'Panic SOS',
    subtitle: 'Fast biological reset to drop acute stress in 30 seconds',
    color: '#EC4899',
    icon: 'zap',
    cycles: 5,
    phases: [
      { label: 'Deep Inhale', durationMs: 3000, targetScale: 0.85, color: '#EC4899', instructions: 'Deep inhale through your nose' },
      { label: 'Top-up Inhale', durationMs: 1500, targetScale: 1.05, color: '#F43F5E', instructions: 'Extra sharp sniff at the top' },
      { label: 'Long Exhale', durationMs: 6500, targetScale: 0.5, color: '#8B5CF6', instructions: 'Slow, sighing exhale all the way out' },
    ],
  },
  {
    id: 'coherence',
    name: 'Coherence 4-2-4',
    badge: 'Heart Balance',
    subtitle: 'Synchronize heart rate variability & blood pressure',
    color: '#8B5CF6',
    icon: 'heart',
    cycles: 6,
    phases: [
      { label: 'Inhale', durationMs: 4000, targetScale: 1.0, color: '#8B5CF6', instructions: 'Smooth inhale to 4 counts' },
      { label: 'Pause', durationMs: 2000, targetScale: 1.0, color: '#A855F7', instructions: 'Soft pause at the top' },
      { label: 'Exhale', durationMs: 4000, targetScale: 0.5, color: '#06B6D4', instructions: 'Gentle exhale to 4 counts' },
    ],
  },
];

export default function BreathingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();

  const initialPattern = PATTERNS.find(p => p.id === params.mode) || PATTERNS[0];
  const [selectedPattern, setSelectedPattern] = useState<BreathPattern>(initialPattern);

  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated visualizer
  const circleScale = useSharedValue(0.5);
  const auraScale = useSharedValue(0.5);
  const circleOpacity = useSharedValue(0.35);

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));

  const auraAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraScale.value }],
  }));

  const currentPhase = selectedPattern.phases[currentPhaseIndex];

  const stopAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (hapticTickIntervalRef.current) clearInterval(hapticTickIntervalRef.current);
  }, []);

  const runPhaseStep = useCallback(
    (pattern: BreathPattern, cycleIndex: number, phaseIdx: number) => {
      const phase = pattern.phases[phaseIdx];
      setCurrentPhaseIndex(phaseIdx);

      const durationSec = Math.round(phase.durationMs / 1000);
      setCountdown(durationSec);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (hapticTickIntervalRef.current) clearInterval(hapticTickIntervalRef.current);
      hapticTickIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 1000);

      circleScale.value = withTiming(phase.targetScale, {
        duration: phase.durationMs,
        easing: Easing.inOut(Easing.quad),
      });
      auraScale.value = withTiming(phase.targetScale * 1.25, {
        duration: phase.durationMs,
        easing: Easing.inOut(Easing.quad),
      });
      circleOpacity.value = withTiming(phase.targetScale > 0.7 ? 0.75 : 0.35, {
        duration: phase.durationMs,
      });

      let remaining = durationSec;
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        }
      }, 1000);

      timerRef.current = setTimeout(() => {
        if (hapticTickIntervalRef.current) clearInterval(hapticTickIntervalRef.current);

        const nextPhaseIdx = phaseIdx + 1;
        if (nextPhaseIdx < pattern.phases.length) {
          runPhaseStep(pattern, cycleIndex, nextPhaseIdx);
        } else {
          const nextCycle = cycleIndex + 1;
          if (nextCycle >= pattern.cycles) {
            stopAllTimers();
            setIsRunning(false);
            setIsDone(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            circleScale.value = withSpring(0.7, { damping: 14 });
            circleOpacity.value = withTiming(0.6);
          } else {
            setCurrentCycle(nextCycle);
            runPhaseStep(pattern, nextCycle, 0);
          }
        }
      }, phase.durationMs);
    },
    [circleScale, circleOpacity, auraScale, stopAllTimers]
  );

  const handleStart = () => {
    stopAllTimers();
    setIsRunning(true);
    setIsDone(false);
    setCurrentCycle(0);
    setCurrentPhaseIndex(0);
    circleScale.value = 0.5;
    auraScale.value = 0.5;
    circleOpacity.value = 0.35;
    runPhaseStep(selectedPattern, 0, 0);
  };

  const handleReset = () => {
    stopAllTimers();
    setIsRunning(false);
    setIsDone(false);
    setCurrentCycle(0);
    setCurrentPhaseIndex(0);
    setCountdown(0);
    circleScale.value = withTiming(0.5, { duration: 300 });
    auraScale.value = withTiming(0.5, { duration: 300 });
    circleOpacity.value = withTiming(0.35, { duration: 300 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectPattern = (pattern: BreathPattern) => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPattern(pattern);
    setIsDone(false);
  };

  useEffect(() => {
    return () => {
      stopAllTimers();
    };
  }, [stopAllTimers]);

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => {
              stopAllTimers();
              router.back();
            }}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Breathing</Text>
            <Text style={styles.headerSubtitle}>Mindful Respiratory Practice</Text>
          </View>
          <View style={[styles.badgePill, { backgroundColor: `${selectedPattern.color}20` }]}>
            <Text style={[styles.badgePillText, { color: selectedPattern.color }]}>
              {selectedPattern.badge}
            </Text>
          </View>
        </View>

        {/* PATTERN SELECTION PILLS */}
        {!isRunning && !isDone && (
          <View style={styles.patternScrollContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patternRow}>
              {PATTERNS.map((p) => {
                const isSelected = p.id === selectedPattern.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.patternChip,
                      isSelected && { backgroundColor: p.color, borderColor: p.color },
                    ]}
                    onPress={() => handleSelectPattern(p)}
                  >
                    <Feather
                      name={p.icon}
                      size={14}
                      color={isSelected ? '#0A0A0C' : Colors.text.secondary}
                    />
                    <Text
                      style={[
                        styles.patternChipText,
                        isSelected && { color: '#0A0A0C', fontFamily: Fonts.bodyBold },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ACTIVE BREATHING VISUALIZER */}
        <View style={styles.visualizerSection}>
          {/* Outer Glowing Aura */}
          <Animated.View
            style={[
              styles.auraCircle,
              { backgroundColor: currentPhase?.color || selectedPattern.color },
              auraAnimatedStyle,
            ]}
          />

          {/* Main Breathing Center Sphere */}
          <Animated.View
            style={[
              styles.mainCircle,
              { backgroundColor: currentPhase?.color || selectedPattern.color },
              circleAnimatedStyle,
            ]}
          />

          {/* Center Info Overlay */}
          <View style={styles.centerOverlay} pointerEvents="none">
            {isRunning ? (
              <>
                <Text style={styles.phaseLabel}>{currentPhase.label}</Text>
                <Text style={styles.countdownText}>{countdown}s</Text>
                <Text style={styles.cycleLabel}>
                  Cycle {currentCycle + 1} of {selectedPattern.cycles}
                </Text>
              </>
            ) : isDone ? (
              <>
                <Feather name="check" size={38} color="#FFFFFF" />
                <Text style={styles.completedTitle}>Session Complete</Text>
                <Text style={styles.completedSub}>Parasympathetic balance restored</Text>
              </>
            ) : (
              <>
                <Feather name="wind" size={36} color="#FFFFFF" />
                <Text style={styles.idleTitle}>{selectedPattern.name}</Text>
                <Text style={styles.idleSub}>{selectedPattern.cycles} Calming Cycles</Text>
              </>
            )}
          </View>
        </View>

        {/* INSTRUCTION CARD */}
        {isRunning && (
          <View style={styles.liveInstructionCard}>
            <Text style={styles.liveInstructionText}>{currentPhase.instructions}</Text>
          </View>
        )}

        {/* BOTTOM CONTROLS */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + Spacing.md }]}>
          {!isRunning && !isDone ? (
            <View style={styles.idleDetailsCard}>
              <Text style={styles.patternDescTitle}>{selectedPattern.subtitle}</Text>
              <Button
                title="Start Practice"
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleStart}
              />
            </View>
          ) : isRunning ? (
            <Button
              title="Stop Practice"
              variant="ghost"
              size="md"
              fullWidth
              onPress={handleReset}
            />
          ) : (
            <View style={styles.doneActions}>
              <Button
                title="Do Another Set"
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
                onPress={handleStart}
              />
              <Button
                title="Complete"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                onPress={() => router.back()}
              />
            </View>
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 48,
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    left: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  badgePill: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    zIndex: 10,
  },
  badgePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
  },

  patternScrollContainer: {
    marginVertical: Spacing.xs,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  patternChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  patternChipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  // Visualizer Sphere
  visualizerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  auraCircle: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    opacity: 0.16,
  },
  mainCircle: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  centerOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  phaseLabel: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: '#FFFFFF',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  countdownText: {
    fontFamily: Fonts.heading,
    fontSize: 48,
    color: '#FFFFFF',
    marginVertical: 4,
  },
  cycleLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  idleTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 2,
  },
  idleSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  completedTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 2,
  },
  completedSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },

  liveInstructionCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  liveInstructionText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    textAlign: 'center',
  },

  bottomSection: {
    width: '100%',
  },
  idleDetailsCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: Spacing.md,
  },
  patternDescTitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall + 1,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
