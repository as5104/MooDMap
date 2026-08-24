/**
 * MoodMap — 5-4-3-2-1 Sensory Grounding Studio
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GroundingStepData {
  count: number;
  sense: string;
  action: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  prompt: string;
  helperText: string;
  itemLabels: string[];
  suggestions: string[];
}

const STEPS: GroundingStepData[] = [
  {
    count: 5,
    sense: 'Sight',
    action: 'Sight Anchors',
    icon: 'eye',
    color: '#06B6D4', // Cyan
    prompt: 'Notice 5 things you can see',
    helperText: 'Look around your surroundings and tap each box as you spot something.',
    itemLabels: ['First thing you see', 'Second thing you see', 'Third thing you see', 'Fourth thing you see', 'Fifth thing you see'],
    suggestions: ['Shadows', 'Textures', 'Light reflections', 'Objects on desk', 'Colors & shapes'],
  },
  {
    count: 4,
    sense: 'Touch',
    action: 'Tactile Anchors',
    icon: 'activity',
    color: '#10B981', // Emerald
    prompt: 'Notice 4 things you can feel',
    helperText: 'Notice physical sensations on your skin or beneath your fingertips.',
    itemLabels: ['First physical sensation', 'Second physical sensation', 'Third physical sensation', 'Fourth physical sensation'],
    suggestions: ['Clothing texture', 'Feet on floor', 'Cool surface', 'Warm air/breath'],
  },
  {
    count: 3,
    sense: 'Hear',
    action: 'Auditory Anchors',
    icon: 'volume-2',
    color: '#6366F1', // Indigo
    prompt: 'Notice 3 sounds you can hear',
    helperText: 'Listen past the immediate room for near or distant sounds.',
    itemLabels: ['First sound you hear', 'Second sound you hear', 'Third sound you hear'],
    suggestions: ['Room fan/hum', 'Distant breeze or traffic', 'Your own breathing'],
  },
  {
    count: 2,
    sense: 'Smell',
    action: 'Olfactory Anchors',
    icon: 'wind',
    color: '#F59E0B', // Amber
    prompt: 'Notice 2 scents in the air',
    helperText: 'Inhale gently and notice ambient scents around you.',
    itemLabels: ['First scent you notice', 'Second scent you notice'],
    suggestions: ['Fresh room air', 'Coffee or tea', 'Soothing deep breath'],
  },
  {
    count: 1,
    sense: 'Taste',
    action: 'Gustatory Anchor',
    icon: 'coffee',
    color: '#EC4899', // Pink
    prompt: 'Notice 1 thing you can taste',
    helperText: 'Notice a lingering flavor or take a mindful sip of water.',
    itemLabels: ['One taste you notice'],
    suggestions: ['A lingering flavor', 'A refreshing sip of water'],
  },
];

export default function GroundingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const step = STEPS[currentStepIdx];
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const isStepComplete = checkedCount >= step.count;

  const toggleCheck = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = { ...checkedItems, [idx]: !checkedItems[idx] };
    setCheckedItems(updated);

    const nowCheckedCount = Object.values(updated).filter(Boolean).length;
    if (nowCheckedCount >= step.count) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        if (currentStepIdx < STEPS.length - 1) {
          setCurrentStepIdx((prev) => prev + 1);
          setCheckedItems({});
        } else {
          setIsCompleted(true);
        }
      }, 400);
    }
  };

  const handleNextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStepIdx < STEPS.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
      setCheckedItems({});
    } else {
      setIsCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStepIdx(0);
    setCheckedItems({});
    setIsCompleted(false);
  }, []);

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Centered Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>5-4-3-2-1 Grounding</Text>
            <Text style={styles.headerSubtitle}>Sensory Anchoring Studio</Text>
          </View>
          <View style={[styles.badgePill, { backgroundColor: `${step?.color || '#10B981'}20` }]}>
            <Text style={[styles.badgePillText, { color: step?.color || '#10B981' }]}>
              {isCompleted ? 'Done' : `${step.count} ${step.sense}`}
            </Text>
          </View>
        </View>

        {/* 5-Step Segmented Bar */}
        <View style={styles.stepSegmentsRow}>
          {STEPS.map((s, i) => {
            const isPassed = i < currentStepIdx || isCompleted;
            const isCurrent = i === currentStepIdx && !isCompleted;
            return (
              <View
                key={s.count}
                style={[
                  styles.stepSegment,
                  isPassed && { backgroundColor: s.color },
                  isCurrent && { backgroundColor: s.color, height: 5 },
                ]}
              />
            );
          })}
        </View>

        {/* Main Sensory Focus Stage */}
        <View style={styles.centerStage}>
          {!isCompleted ? (
            <Animated.View
              key={currentStepIdx}
              entering={FadeInDown.duration(350)}
              exiting={FadeOutUp.duration(200)}
              style={styles.stageContent}
            >
              {/* Giant Glowing Sense Orb */}
              <View style={styles.orbWrapper}>
                <View style={[styles.orbAura, { backgroundColor: step.color }]} />
                <View style={[styles.orbCircle, { backgroundColor: `${step.color}25`, borderColor: `${step.color}60` }]}>
                  <Feather name={step.icon} size={32} color={step.color} />
                  <Text style={[styles.orbNumber, { color: step.color }]}>{step.count}</Text>
                </View>
              </View>

              {/* Title & Guidance */}
              <Text style={styles.stepPrompt}>{step.prompt}</Text>
              <Text style={styles.stepHelper}>{step.helperText}</Text>

              {/* Interactive Checklist Buttons (Neutral Checklist - Does not dictate items) */}
              <View style={styles.checklistContainer}>
                {Array.from({ length: step.count }).map((_, itemIdx) => {
                  const isChecked = Boolean(checkedItems[itemIdx]);
                  const label = step.itemLabels[itemIdx] || `Anchor #${itemIdx + 1}`;

                  return (
                    <Pressable
                      key={itemIdx}
                      style={[
                        styles.checklistItem,
                        isChecked && [styles.checklistItemActive, { backgroundColor: `${step.color}18`, borderColor: step.color }],
                      ]}
                      onPress={() => toggleCheck(itemIdx)}
                    >
                      <View
                        style={[
                          styles.checkboxOrb,
                          isChecked && { backgroundColor: step.color, borderColor: step.color },
                        ]}
                      >
                        {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
                      </View>
                      <Text
                        style={[
                          styles.checklistText,
                          isChecked && { color: '#FFFFFF', fontFamily: Fonts.bodyBold },
                        ]}
                      >
                        {label}
                      </Text>
                      {isChecked && (
                        <Feather name="check-circle" size={16} color={step.color} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Suggestions at Bottom for Help */}
              <View style={styles.suggestionsBox}>
                <View style={styles.suggestionsHeader}>
                  <Feather name="help-circle" size={13} color={Colors.text.tertiary} />
                  <Text style={styles.suggestionsTitle}>Suggestions to look for:</Text>
                </View>
                <View style={styles.suggestionsRow}>
                  {step.suggestions.map((sug, i) => (
                    <View key={i} style={styles.suggestionPill}>
                      <Text style={styles.suggestionPillText}>{sug}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.doneContainer}>
              <View style={styles.doneIconCircle}>
                <Feather name="check" size={44} color="#FFFFFF" />
              </View>
              <Text style={styles.doneHeading}>Nervous System Restored</Text>
              <Text style={styles.doneSubheading}>
                You engaged all 5 senses to anchor your attention firmly into physical reality. You are safe and grounded in this moment.
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom Navigation */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
          {!isCompleted ? (
            <Button
              title={isStepComplete ? 'Next Sense' : `Check all ${step.count} items above`}
              variant={isStepComplete ? 'primary' : 'secondary'}
              size="lg"
              fullWidth
              onPress={handleNextStep}
            />
          ) : (
            <View style={styles.doneButtonsRow}>
              <Button
                title="Practice Again"
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
                onPress={handleReset}
              />
              <Button
                title="Finish"
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

  stepSegmentsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: Spacing.xs,
  },
  stepSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  centerStage: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  stageContent: {
    alignItems: 'center',
  },

  orbWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  orbAura: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.18,
  },
  orbCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  orbNumber: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.caption,
    fontWeight: '700',
  },

  stepPrompt: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  stepHelper: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  checklistContainer: {
    width: '100%',
    gap: 7,
    marginBottom: Spacing.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E1E24',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  checklistItemActive: {
    borderColor: '#10B981',
  },
  checkboxOrb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall + 1,
    color: 'rgba(255, 255, 255, 0.85)',
    flex: 1,
  },

  suggestionsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: Spacing.sm,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  suggestionsTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestionPillText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.75)',
  },

  doneContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  doneIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  doneHeading: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  doneSubheading: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  bottomBar: {
    width: '100%',
  },
  doneButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
