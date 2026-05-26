/**
 * MoodMap — Mood Entry (Multi-Step Check-in)
 * Step 1: Select Mood → Step 2: Energy & Stress → Step 3: Tags → Step 4: Note → Step 5: Save
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MoodFace } from '@/components/ui/MoodFace';
import { Button, Chip } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { MOODS, type MoodDefinition, type MoodType } from '@/constants/moods';
import { TAGS } from '@/constants/tags';
import { useAppStore } from '@/stores/appStore';
import { saveMoodEntry, getWeeklyMoods, getMoodScore, getMoodStreak } from '@/services/moodService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 4;

// ─── Energy & Stress Labels ───
const ENERGY_LABELS = ['Very Low', 'Low', 'Normal', 'High', 'Very High'];
const ENERGY_EMOJIS = ['😴', '🔋', '⚡', '💪', '🚀'];
const STRESS_LABELS = ['Calm', 'Mild', 'Moderate', 'High', 'Extreme'];
const STRESS_EMOJIS = ['😌', '🙂', '😐', '😰', '😤'];

export default function MoodEntryScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const setTodayMood = useAppStore((s) => s.setTodayMood);
  const setWeeklyMoods = useAppStore((s) => s.setWeeklyMoods);
  const setMoodScore = useAppStore((s) => s.setMoodScore);
  const setMoodStreak = useAppStore((s) => s.setMoodStreak);
  const addXP = useAppStore((s) => s.addXP);
  const refreshData = useAppStore((s) => s.refreshData);

  const displayName = user?.user_metadata?.display_name ?? 'User';
  const firstName = displayName.split(' ')[0];

  // ─── State ───
  const [step, setStep] = useState(0);
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [stressLevel, setStressLevel] = useState(2);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [bgColor, setBgColor] = useState(MOODS[0].bgColor);

  const selectedMood = MOODS[selectedMoodIndex];

  // ─── Animations ───
  const selectMood = (index: number) => {
    setSelectedMoodIndex(index);
    // Quick fade out → change color → fade back in
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 120,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    // Set color immediately during the fade
    setTimeout(() => setBgColor(MOODS[index].bgColor), 100);
  };

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0.7, 1],
    outputRange: ['#2C2C2C', bgColor],
    extrapolate: 'clamp',
  });

  // ─── Navigation ───
  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  // ─── Tag Toggle ───
  const toggleTag = (key: string) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  // ─── Save ───
  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const entry = saveMoodEntry({
        moodType: selectedMood.type,
        moodScore: selectedMood.score,
        energyLevel,
        stressLevel,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        note: note.trim() || undefined,
        userId: user?.id,
      });

      // Update store
      setTodayMood({
        id: entry.id,
        moodType: entry.mood_type as MoodType,
        moodScore: entry.mood_score,
        energyLevel: entry.energy_level ?? undefined,
        stressLevel: entry.stress_level ?? undefined,
        tags: entry.tags ? JSON.parse(entry.tags) : undefined,
        note: entry.note ?? undefined,
        date: entry.date,
      });

      // Refresh cached data
      const weekly = getWeeklyMoods(user?.id);
      const score = getMoodScore(user?.id);
      const streak = getMoodStreak(user?.id);

      setWeeklyMoods(weekly);
      setMoodScore(score);
      setMoodStreak(streak.current);
      addXP(25);
      refreshData();

      setSaved(true);

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('[MoodEntry] Save error:', error);
      Alert.alert('Error', 'Failed to save mood. Please try again.');
      setSaving(false);
    }
  }, [selectedMood, energyLevel, stressLevel, selectedTags, note, user]);

  // ─── Success Screen ───
  if (saved) {
    return (
      <Animated.View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.successCenter}>
          <MoodFace
            expression={selectedMood.expression}
            bgColor={selectedMood.bgColor}
            faceColor={selectedMood.faceColor}
            size="xl"
          />
          <Text style={styles.successTitle}>Mood Logged!</Text>
          <Text style={styles.successSubtitle}>
            You're feeling {selectedMood.label.toLowerCase()} today
          </Text>
          <Text style={styles.successXP}>+25 XP ✨</Text>
        </View>
      </Animated.View>
    );
  }

  // ─── Render Steps ───
  const renderStep = () => {
    switch (step) {
      case 0:
        return renderMoodStep();
      case 1:
        return renderEnergyStressStep();
      case 2:
        return renderTagsStep();
      case 3:
        return renderNoteStep();
      default:
        return null;
    }
  };

  // ─── Step 1: Select Mood ───
  const renderMoodStep = () => (
    <>
      <Text style={styles.wave}>👋 Hey {firstName}!</Text>
      <Text style={styles.title}>How are you feeling{'\n'}this day?</Text>

      <View style={styles.faceContainer}>
        <MoodFace
          expression={selectedMood.expression}
          bgColor={selectedMood.bgColor}
          faceColor={selectedMood.faceColor}
          size="lg"
        />
      </View>

      <Text style={styles.moodLabel}>I'm Feeling {selectedMood.label}</Text>

      <View style={styles.moodGrid}>
        {MOODS.map((mood, i) => (
          <Pressable
            key={mood.type}
            onPress={() => selectMood(i)}
            style={[
              styles.moodOption,
              selectedMoodIndex === i && styles.moodOptionActive,
            ]}
          >
            <MoodFace
              expression={mood.expression}
              bgColor={mood.bgColor}
              faceColor={mood.faceColor}
              size="sm"
            />
            <Text style={[
              styles.moodOptionLabel,
              selectedMoodIndex === i && styles.moodOptionLabelActive,
            ]}>
              {mood.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  // ─── Step 2: Energy & Stress ───
  const renderEnergyStressStep = () => (
    <>
      <Text style={styles.stepTitle}>Energy & Stress</Text>
      <Text style={styles.stepSubtitle}>How's your energy and stress level?</Text>

      {/* Energy */}
      <View style={styles.sliderSection}>
        <Text style={styles.sliderLabel}>
          Energy Level {ENERGY_EMOJIS[energyLevel - 1]}
        </Text>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => setEnergyLevel(level)}
              style={[
                styles.sliderDot,
                level <= energyLevel && styles.sliderDotActive,
                level === energyLevel && styles.sliderDotCurrent,
              ]}
            >
              <Text style={[
                styles.sliderDotText,
                level <= energyLevel && styles.sliderDotTextActive,
              ]}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sliderValue}>{ENERGY_LABELS[energyLevel - 1]}</Text>
      </View>

      {/* Stress */}
      <View style={styles.sliderSection}>
        <Text style={styles.sliderLabel}>
          Stress Level {STRESS_EMOJIS[stressLevel - 1]}
        </Text>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => setStressLevel(level)}
              style={[
                styles.sliderDot,
                level <= stressLevel && styles.sliderDotStress,
                level === stressLevel && styles.sliderDotCurrentStress,
              ]}
            >
              <Text style={[
                styles.sliderDotText,
                level <= stressLevel && styles.sliderDotTextActive,
              ]}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sliderValue}>{STRESS_LABELS[stressLevel - 1]}</Text>
      </View>
    </>
  );

  // ─── Step 3: Tags ───
  const renderTagsStep = () => (
    <>
      <Text style={styles.stepTitle}>What's happening?</Text>
      <Text style={styles.stepSubtitle}>Select tags that describe your context</Text>

      <View style={styles.tagGrid}>
        {TAGS.map((tag) => (
          <Chip
            key={tag.key}
            label={tag.label}
            emoji={tag.emoji}
            selected={selectedTags.includes(tag.key)}
            onPress={() => toggleTag(tag.key)}
            color={Colors.accent.olive}
          />
        ))}
      </View>
    </>
  );

  // ─── Step 4: Note ───
  const renderNoteStep = () => (
    <>
      <Text style={styles.stepTitle}>Quick Note</Text>
      <Text style={styles.stepSubtitle}>Anything on your mind? (optional)</Text>

      <View style={styles.noteContainer}>
        <TextInput
          style={styles.noteInput}
          multiline
          numberOfLines={6}
          placeholder="Write a few words about how you're feeling..."
          placeholderTextColor="rgba(240, 235, 227, 0.25)"
          value={note}
          onChangeText={setNote}
          selectionColor={Colors.accent.olive}
          textAlignVertical="top"
        />
        <Text style={styles.noteCount}>{note.length}/500</Text>
      </View>
    </>
  );

  return (
    <Animated.View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      {/* Topographic circles */}
      <View style={styles.topoLayer}>
        <View style={[styles.topoCircle, styles.topo1]} />
        <View style={[styles.topoCircle, styles.topo2]} />
        <View style={[styles.topoCircle, styles.topo3]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Feather name="arrow-left" size={22} color="#F0EBE3" />
        </Pressable>

        {/* Step indicator */}
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i === step && styles.stepDotActive,
                i < step && styles.stepDotDone,
              ]}
            />
          ))}
        </View>

        <Pressable style={styles.settingsBtn}>
          <Text style={styles.stepCount}>{step + 1}/{TOTAL_STEPS}</Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {step === 2 && selectedTags.length === 0 ? (
          <View style={styles.footerRow}>
            <Button
              title="Skip"
              variant="secondary"
              size="lg"
              onPress={goNext}
              style={styles.skipBtn}
            />
            <Button
              title="Next"
              variant="pill"
              size="lg"
              onPress={goNext}
              style={styles.nextBtn}
            />
          </View>
        ) : step === 3 ? (
          <Button
            title={saving ? 'Saving...' : 'Save Mood  ✓'}
            variant="pill"
            size="lg"
            fullWidth
            loading={saving}
            onPress={goNext}
          />
        ) : (
          <Button
            title="Next"
            variant="pill"
            size="lg"
            fullWidth
            onPress={goNext}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topoLayer: {
    ...(StyleSheet.absoluteFill as object),
    overflow: 'hidden',
  },
  topoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(240, 235, 227, 0.08)',
  },
  topo1: { width: 500, height: 500, top: '15%', left: -100 },
  topo2: { width: 400, height: 400, top: '20%', left: -40 },
  topo3: { width: 600, height: 600, bottom: -200, right: -150 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240, 235, 227, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(240, 235, 227, 0.2)',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: '#F0EBE3',
  },
  stepDotDone: {
    backgroundColor: 'rgba(240, 235, 227, 0.5)',
  },
  stepCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: 'rgba(240, 235, 227, 0.5)',
  },

  // Content
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },

  // Step 1: Mood
  wave: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: 'rgba(240, 235, 227, 0.8)',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#F0EBE3',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xxxl,
    lineHeight: 36,
  },
  faceContainer: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  moodLabel: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: '#F0EBE3',
    marginBottom: Spacing.lg,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  moodOption: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    width: '18%',
    borderRadius: Radius.card,
    opacity: 0.6,
  },
  moodOptionActive: {
    opacity: 1,
    backgroundColor: 'rgba(240, 235, 227, 0.15)',
  },
  moodOptionLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(240, 235, 227, 0.5)',
    marginTop: Spacing.xs,
  },
  moodOptionLabelActive: {
    color: '#F0EBE3',
    fontFamily: Fonts.bodySemiBold,
  },

  // Step 2: Energy & Stress
  stepTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: '#F0EBE3',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(240, 235, 227, 0.6)',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xxxl,
  },
  sliderSection: {
    width: '100%',
    marginBottom: Spacing.xxxl,
  },
  sliderLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#F0EBE3',
    marginBottom: Spacing.lg,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sliderDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(240, 235, 227, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sliderDotActive: {
    backgroundColor: 'rgba(168, 181, 114, 0.2)',
    borderColor: 'rgba(168, 181, 114, 0.3)',
  },
  sliderDotCurrent: {
    backgroundColor: 'rgba(168, 181, 114, 0.35)',
    borderColor: Colors.accent.olive,
  },
  sliderDotStress: {
    backgroundColor: 'rgba(212, 132, 90, 0.2)',
    borderColor: 'rgba(212, 132, 90, 0.3)',
  },
  sliderDotCurrentStress: {
    backgroundColor: 'rgba(212, 132, 90, 0.35)',
    borderColor: Colors.accent.terracotta,
  },
  sliderDotText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: 'rgba(240, 235, 227, 0.3)',
  },
  sliderDotTextActive: {
    color: '#F0EBE3',
  },
  sliderValue: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(240, 235, 227, 0.5)',
    textAlign: 'center',
  },

  // Step 3: Tags
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    width: '100%',
  },

  // Step 4: Note
  noteContainer: {
    width: '100%',
    backgroundColor: 'rgba(240, 235, 227, 0.06)',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(240, 235, 227, 0.08)',
    padding: Spacing.lg,
  },
  noteInput: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: '#F0EBE3',
    minHeight: 150,
    lineHeight: 24,
  },
  noteCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(240, 235, 227, 0.25)',
    textAlign: 'right',
    marginTop: Spacing.sm,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xxxl,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  skipBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },

  // Success
  successCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  successTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: '#F0EBE3',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(240, 235, 227, 0.7)',
    marginBottom: Spacing.lg,
  },
  successXP: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.h3,
    color: Colors.accent.olive,
  },
});
