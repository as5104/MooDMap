/**
 * MoodMap — Gratitude Prompt
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

export default function GratitudeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const [items, setItems] = useState(['', '', '']);
  const [saved, setSaved] = useState(false);

  const updateItem = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = text;
    setItems(newItems);
  };

  const filledCount = items.filter((i) => i.trim().length > 0).length;
  const canSave = filledCount > 0;

  const handleSave = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const gratitudeEntries = items
      .filter((i) => i.trim().length > 0)
      .map((i, idx) => `${idx + 1}. ${i.trim()}`)
      .join('\n');

    const content = `Today I'm grateful for:\n\n${gratitudeEntries}`;

    saveJournalEntry({
      title: 'Gratitude',
      content,
      promptUsed: 'gratitude_activity',
      userId: user?.id,
    });

    refreshData();
    setSaved(true);
  };

  const LABELS = [
    { num: '1', placeholder: 'Something that made you smile...', color: '#FFD166' },
    { num: '2', placeholder: 'Someone you appreciate...', color: '#6BCB77' },
    { num: '3', placeholder: 'A small joy or comfort...', color: '#C59CFF' },
  ];

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
            <Text style={styles.headerTitle}>Gratitude</Text>
            <View style={{ width: 44 }} />
          </View>

          {!saved ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Intro */}
              <View style={styles.intro}>
                <View style={styles.introIcon}>
                  <Feather name="heart" size={24} color="#FFD166" />
                </View>
                <Text style={styles.introTitle}>What are you grateful for?</Text>
                <Text style={styles.introSubtitle}>
                  Taking a moment to appreciate the good things can uplift your mood and build resilience.
                </Text>
              </View>

              {/* Input Cards */}
              {LABELS.map((label, index) => (
                <Animated.View key={index} entering={FadeInDown.delay(index * 100).duration(400)}>
                  <GlassCard intensity="medium" padding="md" style={styles.inputCard}>
                    <View style={styles.inputRow}>
                      <View style={[styles.numBadge, { backgroundColor: `${label.color}18` }]}>
                        <Text style={[styles.numText, { color: label.color }]}>{label.num}</Text>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder={label.placeholder}
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        value={items[index]}
                        onChangeText={(text) => updateItem(index, text)}
                        multiline
                        maxLength={200}
                      />
                    </View>
                  </GlassCard>
                </Animated.View>
              ))}

              {/* Counter */}
              <Text style={styles.counter}>{filledCount}/3 filled</Text>

              {/* Save Button */}
              <View style={styles.saveArea}>
                <Button
                  title="Save to Journal"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!canSave}
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
                <Text style={styles.savedTitle}>Gratitude saved</Text>
                <Text style={styles.savedSubtitle}>
                  Your gratitude entry has been added to your journal. Keep cultivating appreciation.
                </Text>
                <View style={[styles.doneActions, { marginTop: Spacing.xxxl }]}>
                  <Button
                    title="Write More"
                    variant="ghost"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setItems(['', '', '']);
                      setSaved(false);
                    }}
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

  intro: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  introIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  introTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  introSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  inputCard: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  numText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    minHeight: 44,
    textAlignVertical: 'top',
  },

  counter: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
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
