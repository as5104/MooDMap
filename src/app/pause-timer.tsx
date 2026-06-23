/**
 * MoodMap — Mindful Pause Timer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';

const DURATIONS = [
  { label: '1 min', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
];

const RING_SIZE = 220;
const RING_RADIUS = 95;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function PauseTimerScreen() {
  const insets = useSafeAreaInsets();
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[1]); // Default 3 min
  const [remaining, setRemaining] = useState(DURATIONS[1].seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = 1 - remaining / selectedDuration.seconds;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRunning(true);
    setIsDone(false);
  }, []);

  const pauseTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
    setIsDone(false);
    setRemaining(selectedDuration.seconds);
  }, [selectedDuration]);

  const selectDuration = (d: typeof DURATIONS[number]) => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDuration(d);
    setRemaining(d.seconds);
    setIsDone(false);
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsDone(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Pause Timer</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Duration Selector */}
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => {
            const isActive = d.seconds === selectedDuration.seconds;
            return (
              <Pressable
                key={d.seconds}
                style={[styles.durationPill, isActive && styles.durationPillActive]}
                onPress={() => selectDuration(d)}
              >
                <Text style={[styles.durationText, isActive && styles.durationTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Main Content */}
        <View style={styles.center}>
          {!isDone ? (
            <>
              {/* Timer Ring */}
              <View style={styles.ringWrapper}>
                <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                  {/* Track */}
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={8}
                    fill="none"
                  />
                  {/* Glow underlay */}
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke={Colors.accent.coral}
                    strokeWidth={14}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.12}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                  {/* Progress arc */}
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke={Colors.accent.coral}
                    strokeWidth={8}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                </Svg>
                <View style={styles.ringCenter}>
                  <Text style={styles.timerText}>{formatTime(remaining)}</Text>
                  <Text style={styles.timerLabel}>
                    {isRunning ? 'Pausing...' : 'Ready'}
                  </Text>
                </View>
              </View>

              <Text style={styles.tipText}>
                Close your eyes and focus on your breath
              </Text>
            </>
          ) : (
            <Animated.View entering={FadeInDown.duration(500)} style={styles.doneContent}>
              <View style={styles.doneCircle}>
                <Feather name="check" size={36} color={Colors.accent.primary} />
              </View>
              <Text style={styles.doneTitle}>Time&apos;s up</Text>
              <Text style={styles.doneSubtitle}>
                You took {selectedDuration.label} for yourself.{'\n'}How do you feel now?
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          {!isDone && !isRunning && remaining === selectedDuration.seconds && (
            <Button title="Start" variant="primary" size="lg" fullWidth onPress={startTimer} />
          )}
          {isRunning && (
            <Button title="Pause" variant="ghost" size="lg" fullWidth onPress={pauseTimer} />
          )}
          {!isDone && !isRunning && remaining < selectedDuration.seconds && (
            <View style={styles.actionRow}>
              <Button title="Reset" variant="ghost" size="md" style={{ flex: 1 }} onPress={resetTimer} />
              <Button title="Resume" variant="primary" size="md" style={{ flex: 1 }} onPress={startTimer} />
            </View>
          )}
          {isDone && (
            <View style={styles.actionRow}>
              <Button title="Again" variant="ghost" size="md" style={{ flex: 1 }} onPress={resetTimer} />
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

  durationRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.pill,
    padding: 3,
    marginBottom: Spacing.xxxl,
  },
  durationPill: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  durationPillActive: {
    backgroundColor: Colors.accent.coral,
  },
  durationText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  durationTextActive: {
    color: Colors.text.onAccent,
    fontFamily: Fonts.bodySemiBold,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  timerText: {
    fontFamily: Fonts.heading,
    fontSize: 48,
    color: Colors.text.primary,
    lineHeight: 54,
  },
  timerLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  tipText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },

  doneContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${Colors.accent.primary}15`,
    borderWidth: 2, borderColor: `${Colors.accent.primary}30`,
    alignItems: 'center', justifyContent: 'center',
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
