/**
 * MoodMap — Focus Timer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { GradientBackground, Button, GlassCard } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { getSetting, saveSetting } from '@/services/settingsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimerPreset {
  id: string;
  label: string;
  sublabel: string;
  seconds: number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const PRESETS: TimerPreset[] = [
  { id: '1m', label: '1m', sublabel: 'Micro Reset', seconds: 60, icon: 'zap', color: '#10B981' },
  { id: '3m', label: '3m', sublabel: 'Mindful Break', seconds: 180, icon: 'coffee', color: '#84CC16' },
  { id: '5m', label: '5m', sublabel: 'Decompress', seconds: 300, icon: 'moon', color: '#06B6D4' },
  { id: '15m', label: '15m', sublabel: 'Deep Zen', seconds: 900, icon: 'feather', color: '#8B5CF6' },
  { id: '25m', label: '25m', sublabel: 'Focus Flow', seconds: 1500, icon: 'target', color: '#EC4899' },
];

const QUICK_MINUTES = [2, 8, 10, 20, 30, 45, 60, 90];

const RING_SIZE = Math.min(SCREEN_WIDTH * 0.65, 230);
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PauseTimerScreen() {
  const insets = useSafeAreaInsets();

  // Load custom minutes from storage or fallback to 10
  const [customMinutes, setCustomMinutes] = useState<number>(() => {
    try {
      const saved = getSetting('pause_timer_custom_minutes', '10');
      const parsed = parseInt(saved, 10);
      return isNaN(parsed) || parsed <= 0 ? 10 : parsed;
    } catch {
      return 10;
    }
  });

  const [modalMinutes, setModalMinutes] = useState<number>(customMinutes);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState<TimerPreset>(PRESETS[1]);
  const [remaining, setRemaining] = useState(PRESETS[1].seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = 1 - remaining / selectedPreset.seconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const isCustomSelected = selectedPreset.id === 'custom';

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
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
    setRemaining(selectedPreset.seconds);
  }, [selectedPreset]);

  const selectPreset = (p: TimerPreset) => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPreset(p);
    setRemaining(p.seconds);
    setIsDone(false);
  };

  const openCustomModal = () => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalMinutes(customMinutes);
    setIsCustomModalOpen(true);
  };

  const applyCustomDuration = (mins: number) => {
    const validMins = Math.max(1, Math.min(180, mins));
    setCustomMinutes(validMins);
    try {
      saveSetting('pause_timer_custom_minutes', String(validMins));
    } catch (e) {
      console.error('[PauseTimer] Save custom minutes error:', e);
    }

    const customPresetObj: TimerPreset = {
      id: 'custom',
      label: `${validMins}m`,
      sublabel: 'Custom Timer',
      seconds: validMins * 60,
      icon: 'clock',
      color: Colors.accent.primary,
    };

    setSelectedPreset(customPresetObj);
    setRemaining(validMins * 60);
    setIsDone(false);
    setIsRunning(false);
    setIsCustomModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAdjustMinutes = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalMinutes((prev) => Math.max(1, Math.min(180, prev + delta)));
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
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Centered Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              router.back();
            }}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pause Timer</Text>
            <Text style={styles.headerSubtitle}>Mindful Pause & Focus</Text>
          </View>
          <View style={[styles.badgePill, { backgroundColor: `${selectedPreset.color}20` }]}>
            <Text style={[styles.badgePillText, { color: selectedPreset.color }]}>
              {selectedPreset.sublabel}
            </Text>
          </View>
        </View>

        {/* PRESET PILLS ROW WITH CUSTOM OPTION */}
        {!isRunning && !isDone && (
          <View style={styles.presetSection}>
            <View style={styles.presetsRow}>
              {PRESETS.map((p) => {
                const isSelected = p.id === selectedPreset.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.presetChip,
                      isSelected && { backgroundColor: p.color, borderColor: p.color },
                    ]}
                    onPress={() => selectPreset(p)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected && { color: '#0A0A0C', fontFamily: Fonts.bodyBold },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Custom Preset Chip */}
              <Pressable
                style={[
                  styles.presetChip,
                  styles.customChip,
                  isCustomSelected && {
                    backgroundColor: Colors.accent.primary,
                    borderColor: Colors.accent.primary,
                  },
                ]}
                onPress={() => {
                  if (isCustomSelected) {
                    openCustomModal();
                  } else {
                    applyCustomDuration(customMinutes);
                  }
                }}
              >
                <Feather
                  name="clock"
                  size={12}
                  color={isCustomSelected ? '#0A0A0C' : Colors.accent.primary}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    isCustomSelected && { color: '#0A0A0C', fontFamily: Fonts.bodyBold },
                  ]}
                >
                  {isCustomSelected ? `${customMinutes}m` : 'Custom'}
                </Text>
              </Pressable>
            </View>

            {/* Quick Edit Custom Hint when Custom is Selected */}
            {isCustomSelected && (
              <Pressable style={styles.editCustomHintBtn} onPress={openCustomModal}>
                <Feather name="sliders" size={12} color={Colors.accent.primary} />
                <Text style={styles.editCustomHintText}>Change custom duration ({customMinutes} min)</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* CIRCULAR TIMER STAGE */}
        <View style={styles.timerStage}>
          <View style={styles.timerCenterWrapper}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <Defs>
                <SvgLinearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={selectedPreset.color} />
                  <Stop offset="100%" stopColor="#A3E635" />
                </SvgLinearGradient>
              </Defs>

              {/* Background Track Ring */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={STROKE_WIDTH}
                fill="transparent"
              />

              {/* Active Progress Ring */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke="url(#timerGrad)"
                strokeWidth={STROKE_WIDTH}
                fill="transparent"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>

            {/* Ambient Center Overlay */}
            <View style={styles.timeOverlay} pointerEvents="none">
              {isDone ? (
                <>
                  <Feather name="check-circle" size={42} color={selectedPreset.color} />
                  <Text style={styles.doneTimeTitle}>Pause Completed</Text>
                  <Text style={styles.doneTimeSub}>Mind refreshed</Text>
                </>
              ) : (
                <>
                  <Text style={styles.timeDigits}>{formatTime(remaining)}</Text>
                  <Text style={styles.timePresetLabel}>{selectedPreset.sublabel}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* BOTTOM ACTION CONTROLS */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + Spacing.md }]}>
          {!isRunning && !isDone ? (
            <Button
              title="Start"
              variant="primary"
              size="lg"
              fullWidth
              onPress={startTimer}
            />
          ) : isRunning ? (
            <View style={styles.runningButtonsRow}>
              <Button
                title="Reset"
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
                onPress={resetTimer}
              />
              <Button
                title="Pause"
                variant="secondary"
                size="md"
                style={{ flex: 1 }}
                onPress={pauseTimer}
              />
            </View>
          ) : (
            <View style={styles.runningButtonsRow}>
              <Button
                title="Repeat"
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
                onPress={resetTimer}
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

        {/* CUSTOM DURATION MODAL */}
        <Modal
          visible={isCustomModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCustomModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <GlassCard intensity="strong" padding="none" style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.modalIconCircle}>
                    <Feather name="clock" size={16} color={Colors.accent.primary} />
                  </View>
                  <Text style={styles.modalTitle}>Custom Duration</Text>
                </View>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setIsCustomModalOpen(false)}
                  hitSlop={10}
                >
                  <Feather name="x" size={18} color="rgba(255, 255, 255, 0.6)" />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                {/* Large Display Counter */}
                <View style={styles.counterBox}>
                  <Text style={styles.counterDigits}>{modalMinutes}</Text>
                  <Text style={styles.counterUnit}>minutes</Text>
                </View>

                {/* Stepper Controls */}
                <View style={styles.stepperRow}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustMinutes(-5)}
                  >
                    <Text style={styles.stepperBtnText}>-5m</Text>
                  </Pressable>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustMinutes(-1)}
                  >
                    <Feather name="minus" size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustMinutes(1)}
                  >
                    <Feather name="plus" size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustMinutes(5)}
                  >
                    <Text style={styles.stepperBtnText}>+5m</Text>
                  </Pressable>
                </View>

                {/* Quick Presets Grid */}
                <Text style={styles.quickLabel}>Quick Jump</Text>
                <View style={styles.quickGrid}>
                  {QUICK_MINUTES.map((m) => {
                    const isSelected = modalMinutes === m;
                    return (
                      <Pressable
                        key={m}
                        style={[
                          styles.quickPill,
                          isSelected && styles.quickPillActive,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setModalMinutes(m);
                        }}
                      >
                        <Text
                          style={[
                            styles.quickPillText,
                            isSelected && styles.quickPillTextActive,
                          ]}
                        >
                          {m} min
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Set Button */}
                <Button
                  title={`Set Timer (${modalMinutes} min)`}
                  variant="primary"
                  size="lg"
                  fullWidth
                  style={styles.modalSetBtn}
                  onPress={() => applyCustomDuration(modalMinutes)}
                />
              </View>
            </GlassCard>
          </View>
        </Modal>
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
    marginBottom: Spacing.xs,
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

  presetSection: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderColor: 'rgba(190, 255, 108, 0.3)',
  },
  presetChipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  editCustomHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(190, 255, 108, 0.1)',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
  },
  editCustomHintText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.accent.primary,
  },

  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  timerCenterWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  timeOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigits: {
    fontFamily: Fonts.heading,
    fontSize: 46,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  timePresetLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  doneTimeTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginTop: 8,
  },
  doneTimeSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },

  bottomSection: {
    width: '100%',
  },
  runningButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#16161B',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 1,
    color: Colors.text.primary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  counterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: Spacing.md,
  },
  counterDigits: {
    fontFamily: Fonts.heading,
    fontSize: 54,
    color: Colors.accent.primary,
    lineHeight: 60,
  },
  counterUnit: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  stepperBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepperBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#FFFFFF',
  },
  quickLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs + 2,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickPillActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  quickPillText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickPillTextActive: {
    color: '#0A0A0C',
    fontFamily: Fonts.bodyBold,
  },
  modalSetBtn: {
    marginTop: Spacing.xs,
  },
});
