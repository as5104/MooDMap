/**
 * MoodMap — Reflection Prompts
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground, GlassCard, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { saveJournalEntry } from '@/services/journalService';

const PROMPTS = [
  'What brought you a moment of peace today?',
  'If you could tell your younger self one thing, what would it be?',
  'What is something you\'re learning about yourself lately?',
  'What does your ideal day look like?',
  'What are you holding onto that you could let go of?',
  'Who has positively influenced your life recently?',
  'What small thing made a big difference this week?',
  'If your emotions could speak, what would they say right now?',
  'What boundary do you need to set for yourself?',
  'What are you most proud of accomplishing?',
  'What would you do if you weren\'t afraid?',
  'How have you grown in the past year?',
  'What does self-care look like for you?',
  'What is one thing you want to change about your routine?',
  'What gives you energy and makes you feel alive?',
  'What has been weighing on your mind?',
  'What would you like to forgive yourself for?',
  'What do you need more of in your life?',
  'What moments from today are worth remembering?',
  'How do you want to feel at the end of this week?',
];

export default function ReflectionScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [response, setResponse] = useState('');
  const [saved, setSaved] = useState(false);

  const prompt = PROMPTS[promptIndex];

  const shufflePrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * PROMPTS.length);
    } while (newIndex === promptIndex && PROMPTS.length > 1);
    setPromptIndex(newIndex);
    setResponse('');
    setSaved(false);
  };

  const handleSave = () => {
    if (!response.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const content = `Reflection Prompt:\n"${prompt}"\n\nMy thoughts:\n${response.trim()}`;

    saveJournalEntry({
      title: 'Reflection',
      content,
      promptUsed: 'reflection_activity',
      userId: user?.id,
    });

    refreshData();
    setSaved(true);
  };

  return (
    <GradientBackground variant="glow">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
              <Feather name="arrow-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Reflection</Text>
            <Pressable style={styles.shuffleBtn} onPress={shufflePrompt}>
              <Feather name="refresh-cw" size={18} color={Colors.accent.primary} />
            </Pressable>
          </View>

          {!saved ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Prompt Card */}
              <Animated.View key={promptIndex} entering={FadeInDown.duration(400)}>
                <GlassCard intensity="medium" padding="lg" style={styles.promptCard}>
                  <View style={styles.promptIconRow}>
                    <View style={styles.promptIcon}>
                      <Feather name="message-circle" size={20} color="#4ECDC4" />
                    </View>
                    <Text style={styles.promptLabel}>Today&apos;s Prompt</Text>
                  </View>
                  <Text style={styles.promptText}>{prompt}</Text>
                </GlassCard>
              </Animated.View>

              {/* Response Area */}
              <GlassCard intensity="subtle" padding="lg" style={styles.responseCard}>
                <TextInput
                  style={styles.responseInput}
                  placeholder="Write your thoughts here..."
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={response}
                  onChangeText={setResponse}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
                <View style={styles.charCount}>
                  <Text style={styles.charCountText}>{response.length}/2000</Text>
                </View>
              </GlassCard>

              {/* Save Button */}
              <View style={styles.saveArea}>
                <Button
                  title="Save to Journal"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!response.trim()}
                  onPress={handleSave}
                  icon={<Feather name="bookmark" size={18} color={Colors.text.onAccent} />}
                />
              </View>

              <View style={{ height: insets.bottom + 40 }} />
            </ScrollView>
          ) : (
            <View style={styles.savedContent}>
              <Animated.View entering={FadeInDown.duration(500)} style={styles.savedInner}>
                <View style={styles.savedCircle}>
                  <Feather name="check" size={36} color={Colors.accent.primary} />
                </View>
                <Text style={styles.savedTitle}>Reflection saved</Text>
                <Text style={styles.savedSubtitle}>
                  Your thoughts have been captured in your journal. Self-reflection is a powerful practice.
                </Text>
                <View style={[styles.doneActions, { marginTop: Spacing.xxxl }]}>
                  <Button
                    title="New Prompt"
                    variant="ghost"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={shufflePrompt}
                  />
                  <Button
                    title="Done"
                    variant="primary"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
                  />
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
  shuffleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.accent.primary}12`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${Colors.accent.primary}20`,
  },

  promptCard: {
    marginBottom: Spacing.xl,
  },
  promptIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  promptIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  promptLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptText: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    lineHeight: 28,
  },

  responseCard: {
    marginBottom: Spacing.xl,
    minHeight: 180,
  },
  responseInput: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    minHeight: 140,
    lineHeight: 24,
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  charCountText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },

  saveArea: {
    marginBottom: Spacing.xxl,
  },

  savedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  savedInner: {
    alignItems: 'center',
    maxWidth: 300,
  },
  savedCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${Colors.accent.primary}15`,
    borderWidth: 2, borderColor: `${Colors.accent.primary}30`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  savedTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  savedSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  doneActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
});
