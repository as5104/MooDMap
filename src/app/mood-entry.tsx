/**
 * MoodMap — Mood Entry (Multi-Step Check-in)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MoodFace } from '@/components/ui/MoodFace';
import { Button, Chip, customAlert, GlassCard } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { MOODS, type MoodType } from '@/constants/moods';
import { TAGS } from '@/constants/tags';
import { useAppStore } from '@/stores/appStore';
import { saveMoodEntry, getWeeklyMoods, getMoodScore, getMoodStreak } from '@/services/moodService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 5;

// Energy & Stress Labels
const ENERGY_LABELS = ['Very Low', 'Low', 'Normal', 'High', 'Very High'];
const ENERGY_ICONS: (keyof typeof Feather.glyphMap)[] = ['moon', 'battery-charging', 'zap', 'activity', 'trending-up'];
const STRESS_LABELS = ['Calm', 'Mild', 'Moderate', 'High', 'Extreme'];
const STRESS_ICONS: (keyof typeof Feather.glyphMap)[] = ['smile', 'meh', 'minus', 'alert-circle', 'alert-triangle'];

// Sleep Quality Labels
const SLEEP_QUALITY_LABELS = ['Poor Sleep', 'Restless', 'Average', 'Good Sleep', 'Very Restful'];
const SLEEP_QUALITY_ICONS: (keyof typeof Feather.glyphMap)[] = ['frown', 'battery', 'battery-charging', 'moon', 'award'];

interface SleepMoonProps {
  hours: number;
}

function SleepMoon({ hours }: SleepMoonProps) {
  let moonColor = '#FDF6E2';
  let glowColor = 'rgba(253, 246, 226, 0.2)';
  
  if (hours < 6) {
    moonColor = '#E2E8F0'; // Pale silver
    glowColor = 'rgba(226, 232, 240, 0.15)';
  } else if (hours < 8) {
    moonColor = '#FFEBA7'; // Soft gold
    glowColor = 'rgba(255, 235, 167, 0.2)';
  } else {
    moonColor = '#FFD23F'; // Bright Golden Yellow
    glowColor = 'rgba(255, 210, 63, 0.35)';
  }

  const stars = [
    { cx: 20, cy: 30, r: 1.5, opacity: hours >= 8 ? 0.9 : 0.4 },
    { cx: 80, cy: 25, r: 1.2, opacity: hours >= 6 ? 0.8 : 0.2 },
    { cx: 15, cy: 75, r: 1.8, opacity: hours >= 8 ? 0.95 : 0.3 },
    { cx: 85, cy: 80, r: 1.0, opacity: hours >= 6 ? 0.7 : 0.1 },
    { cx: 70, cy: 90, r: 1.3, opacity: hours >= 8 ? 0.85 : 0.5 },
  ];

  return (
    <View style={sleepMoonStyles.container}>
      <Svg width={120} height={120} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="38" fill={glowColor} />
        {hours >= 8 && <Circle cx="50" cy="50" r="48" fill={glowColor} opacity={0.5} />}

        {stars.map((s, idx) => (
          <Circle key={idx} cx={s.cx} cy={s.cy} r={s.r} fill="#FFF" opacity={s.opacity} />
        ))}

        {hours < 6 ? (
          <Path
            d="M50 20 C66.5 20 80 33.5 80 50 C80 66.5 66.5 80 50 80 C41.7 80 34.2 76.6 28.8 71.2 C38.8 71.2 47 63 47 50 C47 37 38.8 28.8 28.8 28.8 C34.2 23.4 41.7 20 50 20 Z"
            fill={moonColor}
          />
        ) : hours < 8 ? (
          <Path
            d="M50 20 C66.5 20 80 33.5 80 50 C80 66.5 66.5 80 50 80 C39 80 30 70 30 50 C30 30 39 20 50 20 Z"
            fill={moonColor}
          />
        ) : (
          <Circle cx="50" cy="50" r="30" fill={moonColor} />
        )}
      </Svg>
    </View>
  );
}

const sleepMoonStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
});

interface MCQDefinition {
  id: string;
  question: string;
  options: string[];
  category: string;
}

/**
 * Determine dynamic MCQ based on check-in answers
 */
function getDynamicMCQ(
  moodType: string,
  energy: number,
  stress: number,
  sleepHrs: number,
  sleepQual: number,
  tags: string[]
): MCQDefinition {
  if (stress >= 4) {
    return {
      id: 'stress_coping',
      question: 'How are you coping with today’s stress?',
      options: [
        'Taking active breaks & resting',
        'Talking to friends or family',
        'Practicing mindfulness/meditation',
        'Focusing on work/pushing through',
        'Feeling a bit overwhelmed'
      ],
      category: 'Stress Coping'
    };
  }

  if (sleepHrs < 6 || sleepQual <= 2) {
    return {
      id: 'sleep_disruption',
      question: 'What impacted your sleep last night?',
      options: [
        'Late night screen time / work',
        'Stress, anxiety, or overthinking',
        'Physical discomfort or pain',
        'Late meals or caffeine intake',
        'Environment (noise, heat, light)'
      ],
      category: 'Sleep Disruption'
    };
  }

  if (energy <= 2) {
    return {
      id: 'energy_drain',
      question: 'What do you feel drained from today?',
      options: [
        'Work / study fatigue',
        'Lack of physical movement',
        'Social burnout / interaction',
        'Poor nutrition / hydration',
        'Just an off-day physically'
      ],
      category: 'Energy Drain'
    };
  }

  if ((moodType === 'happy' || moodType === 'calm') && (tags.includes('friends') || tags.includes('family') || tags.includes('social'))) {
    return {
      id: 'social_impact',
      question: 'How did today’s social interactions affect you?',
      options: [
        'Boosted my energy and mood',
        'Provided comfortable support',
        'Felt a bit tiring but positive',
        'Helped distract me from worries',
        'Neutral / standard interactions'
      ],
      category: 'Social Impact'
    };
  }

  if ((moodType === 'happy' || moodType === 'calm') && (tags.includes('work') || tags.includes('study'))) {
    return {
      id: 'productivity_mood',
      question: 'How was your focus during work/study today?',
      options: [
        'Flow state — highly productive',
        'Moderate focus — made progress',
        'Took it slow but got things done',
        'Distracted but stayed positive',
        'Felt light and effortless'
      ],
      category: 'Work Productivity'
    };
  }

  if (tags.includes('exercise')) {
    return {
      id: 'exercise_feel',
      question: 'How did your exercise affect your state?',
      options: [
        'Left me feeling energized & happy',
        'Cleared my mind of stress',
        'Felt physically challenging but good',
        'Tired me out, ready to sleep',
        'Just part of my regular routine'
      ],
      category: 'Exercise Impact'
    };
  }

  if (moodType === 'sad' || moodType === 'anxious' || moodType === 'angry') {
    return {
      id: 'mood_trigger',
      question: 'What was the main trigger for this feeling?',
      options: [
        'Work, school, or career stress',
        'A relationship or social conflict',
        'Health, fatigue, or body issues',
        'Internal thoughts / overthinking',
        'Nothing specific — just arose'
      ],
      category: 'Mood Trigger'
    };
  }

  return {
    id: 'daily_focus',
    question: 'What was your primary focus today?',
    options: [
      'Self-care and personal time',
      'Career growth and productivity',
      'Connecting with loved ones',
      'Physical health and exercise',
      'Rest and recovery'
    ],
    category: 'Daily Focus'
  };
}

export default function MoodEntryScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const todayMood = useAppStore((s) => s.todayMood);
  const setTodayMood = useAppStore((s) => s.setTodayMood);
  const setWeeklyMoods = useAppStore((s) => s.setWeeklyMoods);
  const setMoodScore = useAppStore((s) => s.setMoodScore);
  const setMoodStreak = useAppStore((s) => s.setMoodStreak);
  const addXP = useAppStore((s) => s.addXP);
  const refreshData = useAppStore((s) => s.refreshData);

  const displayName = user?.user_metadata?.display_name ?? 'User';
  const firstName = displayName.split(' ')[0];

  // State
  const [step, setStep] = useState(0);
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [stressLevel, setStressLevel] = useState(2);
  const [sleepHours, setSleepHours] = useState(7.0);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMCQOption, setSelectedMCQOption] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [bgColor, setBgColor] = useState(MOODS[0].bgColor);

  const selectedMood = MOODS[selectedMoodIndex];

  // Prefill state if todayMood exists
  useEffect(() => {
    if (todayMood) {
      const frame = requestAnimationFrame(() => {
        const mIndex = MOODS.findIndex((m) => m.type === todayMood.moodType);
        if (mIndex !== -1) {
          setSelectedMoodIndex(mIndex);
          setBgColor(MOODS[mIndex].bgColor);
        }
        if (todayMood.energyLevel !== undefined) setEnergyLevel(todayMood.energyLevel);
        if (todayMood.stressLevel !== undefined) setStressLevel(todayMood.stressLevel);
        if (todayMood.sleepHours !== undefined) setSleepHours(todayMood.sleepHours);
        if (todayMood.sleepQuality !== undefined) setSleepQuality(todayMood.sleepQuality);
        if (todayMood.tags !== undefined) setSelectedTags(todayMood.tags);
        
        if (todayMood.note !== undefined && todayMood.note) {
          try {
            const parsed = JSON.parse(todayMood.note);
            if (parsed && parsed.mcqId && parsed.answer) {
              setSelectedMCQOption(parsed.answer);
            }
          } catch {
            // Old plain note format, leave MCQ blank
          }
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [todayMood]);

  // Animations
  const selectMood = (index: number) => {
    triggerHaptic();
    setSelectedMoodIndex(index);
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
    setTimeout(() => setBgColor(MOODS[index].bgColor), 100);
  };

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0.7, 1],
    outputRange: ['#2C2C2C', bgColor],
    extrapolate: 'clamp',
  });

  // Dynamic MCQ based on inputs
  const currentMCQ = useMemo(() => {
    return getDynamicMCQ(
      selectedMood.type,
      energyLevel,
      stressLevel,
      sleepHours,
      sleepQuality,
      selectedTags
    );
  }, [selectedMood.type, energyLevel, stressLevel, sleepHours, sleepQuality, selectedTags]);

  // Navigation
  const goNext = () => {
    triggerHaptic();
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const goBack = () => {
    triggerHaptic();
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const selectEnergyLevel = (level: number) => {
    triggerHaptic();
    setEnergyLevel(level);
  };

  const selectStressLevel = (level: number) => {
    triggerHaptic();
    setStressLevel(level);
  };

  const selectSleepHours = (hours: number) => {
    triggerHaptic();
    setSleepHours(hours);
  };

  const selectSleepQuality = (quality: number) => {
    triggerHaptic();
    setSleepQuality(quality);
  };

  const selectMCQOption = (option: string) => {
    triggerHaptic();
    setSelectedMCQOption(option);
  };

  // Tag Toggle
  const toggleTag = (key: string) => {
    triggerHaptic();
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  // Save
  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      let finalNote = '';
      if (selectedMCQOption) {
        finalNote = JSON.stringify({
          mcqId: currentMCQ.id,
          question: currentMCQ.question,
          category: currentMCQ.category,
          answer: selectedMCQOption
        });
      }

      const entry = saveMoodEntry({
        moodType: selectedMood.type,
        moodScore: selectedMood.score,
        energyLevel,
        stressLevel,
        sleepHours,
        sleepQuality,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        note: finalNote || undefined,
        userId: user?.id,
      });

      // Update store
      setTodayMood({
        id: entry.id,
        moodType: entry.mood_type as MoodType,
        moodScore: entry.mood_score,
        energyLevel: entry.energy_level ?? undefined,
        stressLevel: entry.stress_level ?? undefined,
        sleepHours: entry.sleep_hours ?? undefined,
        sleepQuality: entry.sleep_quality ?? undefined,
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
      customAlert('Error', 'Failed to save mood. Please try again.');
      setSaving(false);
    }
  }, [selectedMood, energyLevel, stressLevel, sleepHours, sleepQuality, selectedTags, selectedMCQOption, currentMCQ, user]);

  // Success Screen
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
            You&apos;re feeling {selectedMood.label.toLowerCase()} today
          </Text>
          <View style={styles.successXPRow}>
            <Feather name="star" size={16} color={Colors.accent.olive} />
            <Text style={styles.successXP}>+25 XP</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Render Steps
  const renderStep = () => {
    switch (step) {
      case 0:
        return renderMoodStep();
      case 1:
        return renderEnergyStressStep();
      case 2:
        return renderSleepStep();
      case 3:
        return renderTagsStep();
      case 4:
        return renderMCQStep();
      default:
        return null;
    }
  };

  // Step 1: Select Mood
  const renderMoodStep = () => (
    <>
      <View style={styles.waveRow}>
        <Feather name="smile" size={16} color="rgba(255, 255, 255, 0.8)" style={styles.waveIcon} />
        <Text style={styles.wave}>Hey {firstName}!</Text>
      </View>
      <Text style={styles.title}>How are you feeling{'\n'}this day?</Text>

      <View style={styles.faceContainer}>
        <MoodFace
          expression={selectedMood.expression}
          bgColor={selectedMood.bgColor}
          faceColor={selectedMood.faceColor}
          size="lg"
        />
      </View>

      <Text style={styles.moodLabel}>I&apos;m Feeling {selectedMood.label}</Text>

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

  // Step 2: Energy & Stress
  const renderEnergyStressStep = () => (
    <>
      <Text style={styles.stepTitle}>Energy & Stress</Text>
      <Text style={styles.stepSubtitle}>How&apos;s your energy and stress level?</Text>

      {/* Energy */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <Text style={styles.sliderLabel}>Energy Level</Text>
          <Feather name={ENERGY_ICONS[energyLevel - 1]} size={16} color="#FFFFFF" style={styles.sliderLabelIcon} />
        </View>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => selectEnergyLevel(level)}
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
        <View style={styles.sliderLabelRow}>
          <Text style={styles.sliderLabel}>Stress Level</Text>
          <Feather name={STRESS_ICONS[stressLevel - 1]} size={16} color="#FFFFFF" style={styles.sliderLabelIcon} />
        </View>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => selectStressLevel(level)}
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

  // Step 3: Sleep Tracker (Duration & Quality)
  const renderSleepStep = () => (
    <>
      <Text style={styles.stepTitle}>Sleep Tracker</Text>
      <Text style={styles.stepSubtitle}>How long and how well did you sleep?</Text>

      {/* Moon Animation */}
      <SleepMoon hours={sleepHours} />

      {/* Sleep Duration Selector */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <Text style={styles.sliderLabel}>Sleep Duration</Text>
          <Text style={styles.sleepHoursVal}>{sleepHours} hours</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hoursScroll}
        >
          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
            <Pressable
              key={h}
              onPress={() => selectSleepHours(h)}
              style={[
                styles.hourCard,
                sleepHours === h && styles.hourCardActive,
              ]}
            >
              <Text style={[styles.hourNumber, sleepHours === h && styles.hourNumberActive]}>{h}</Text>
              <Text style={[styles.hourLabel, sleepHours === h && styles.hourLabelActive]}>hrs</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Sleep Quality */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <Text style={styles.sliderLabel}>Sleep Quality</Text>
        </View>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5].map((quality) => (
            <Pressable
              key={quality}
              onPress={() => selectSleepQuality(quality)}
              style={[
                styles.sliderDot,
                quality <= sleepQuality && styles.sliderDotSleepQuality,
                quality === sleepQuality && styles.sliderDotCurrentSleepQuality,
              ]}
            >
              <Feather
                name={SLEEP_QUALITY_ICONS[quality - 1]}
                size={20}
                color={quality <= sleepQuality ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)'}
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.sliderValue}>{SLEEP_QUALITY_LABELS[sleepQuality - 1]}</Text>
      </View>
    </>
  );

  // Step 4: Categorized Tags
  const renderTagsStep = () => {
    const categories = [
      { key: 'activity', label: 'Activities', icon: 'activity' as const },
      { key: 'social', label: 'Social & People', icon: 'users' as const },
      { key: 'health', label: 'Health & Body', icon: 'heart' as const },
      { key: 'environment', label: 'Environment', icon: 'wind' as const },
    ];

    return (
      <View style={{ width: '100%' }}>
        <Text style={styles.stepTitle}>What&apos;s happening?</Text>
        <Text style={styles.stepSubtitle}>Select tags that describe your context</Text>

        {categories.map((cat) => {
          const catTags = TAGS.filter((t) => t.category === cat.key);
          return (
            <View key={cat.key} style={styles.tagSection}>
              <View style={styles.tagSectionHeader}>
                <Feather name={cat.icon} size={14} color="rgba(255, 255, 255, 0.6)" style={{ marginRight: 6 }} />
                <Text style={styles.tagSectionTitle}>{cat.label}</Text>
              </View>
              <View style={styles.tagGrid}>
                {catTags.map((tag) => (
                  <Chip
                    key={tag.key}
                    label={tag.label}
                    icon={tag.icon}
                    selected={selectedTags.includes(tag.key)}
                    onPress={() => toggleTag(tag.key)}
                    color={Colors.accent.olive}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Step 5: Dynamic MCQ Questions
  const renderMCQStep = () => (
    <View style={{ width: '100%' }}>
      <Text style={styles.stepTitle}>Daily Focus</Text>
      <Text style={styles.stepSubtitle}>Help us understand your day better</Text>

      <GlassCard intensity="subtle" padding="lg" style={styles.mcqCard}>
        <Text style={styles.mcqQuestion}>{currentMCQ.question}</Text>
        
        <View style={styles.mcqOptionsContainer}>
          {currentMCQ.options.map((option) => {
            const isSelected = selectedMCQOption === option;
            return (
              <Pressable
                key={option}
                onPress={() => selectMCQOption(option)}
                style={[
                  styles.mcqOptionCard,
                  isSelected && styles.mcqOptionCardActive,
                ]}
              >
                <View style={[
                  styles.mcqRadio,
                  isSelected && styles.mcqRadioActive
                ]}>
                  {isSelected && <View style={styles.mcqRadioInner} />}
                </View>
                <Text style={[
                  styles.mcqOptionText,
                  isSelected && styles.mcqOptionTextActive
                ]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
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
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
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
        {step === 3 && selectedTags.length === 0 ? (
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
        ) : step === 4 ? (
          <Button
            title={saving ? 'Saving...' : 'Save Mood'}
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  stepDotDone: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  stepCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // Content
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    width: '100%',
  },

  // Step 1: Mood
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  waveIcon: {
    marginRight: Spacing.xs,
  },
  wave: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: 'rgba(255, 255, 255, 0.8)',
    alignSelf: 'flex-start',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  moodOptionLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: Spacing.xs,
  },
  moodOptionLabelActive: {
    color: '#FFFFFF',
    fontFamily: Fonts.bodySemiBold,
  },

  // Step 2: Energy & Stress
  stepTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: '#FFFFFF',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255, 255, 255, 0.6)',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xxxl,
  },
  sliderSection: {
    width: '100%',
    marginBottom: Spacing.xxxl,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sliderLabelIcon: {
    marginLeft: Spacing.sm,
  },
  sliderLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sliderDotActive: {
    backgroundColor: 'rgba(190, 255, 108, 0.2)',
    borderColor: 'rgba(190, 255, 108, 0.3)',
  },
  sliderDotCurrent: {
    backgroundColor: 'rgba(190, 255, 108, 0.35)',
    borderColor: Colors.accent.olive,
  },
  sliderDotStress: {
    backgroundColor: 'rgba(255, 122, 110, 0.2)',
    borderColor: 'rgba(255, 122, 110, 0.3)',
  },
  sliderDotCurrentStress: {
    backgroundColor: 'rgba(255, 122, 110, 0.35)',
    borderColor: Colors.accent.terracotta,
  },
  sliderDotSleepQuality: {
    backgroundColor: 'rgba(122, 162, 247, 0.2)',
    borderColor: 'rgba(122, 162, 247, 0.3)',
  },
  sliderDotCurrentSleepQuality: {
    backgroundColor: 'rgba(122, 162, 247, 0.4)',
    borderColor: '#7AA2F7',
  },
  sliderDotText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  sliderDotTextActive: {
    color: '#FFFFFF',
  },
  sliderValue: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },

  // Step 3: Sleep specific styles
  hoursScroll: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  hourCard: {
    width: 60,
    height: 70,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  hourCardActive: {
    backgroundColor: 'rgba(122, 162, 247, 0.25)',
    borderColor: '#7AA2F7',
  },
  hourNumber: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  hourNumberActive: {
    color: '#FFFFFF',
  },
  hourLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: -2,
  },
  hourLabelActive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sleepHoursVal: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#7AA2F7',
    marginLeft: 'auto',
  },

  // Step 4: Tags
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    width: '100%',
  },
  tagSection: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  tagSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  tagSectionTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Step 5: Dynamic MCQ Styles
  mcqCard: {
    width: '100%',
    marginTop: Spacing.sm,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mcqQuestion: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  mcqOptionsContainer: {
    gap: Spacing.sm,
  },
  mcqOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  mcqOptionCardActive: {
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    borderColor: Colors.accent.olive,
  },
  mcqRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  mcqRadioActive: {
    borderColor: Colors.accent.olive,
  },
  mcqRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.olive,
  },
  mcqOptionText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  mcqOptionTextActive: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: Spacing.lg,
  },
  successXPRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  successXP: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.h3,
    color: Colors.accent.olive,
  },
});
