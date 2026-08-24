/**
 * MoodMap — Reflection Studio
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground, Button, SwipableCardDeck, type BaseDeckCard } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { saveJournalEntry } from '@/services/journalService';

const PROMPTS_BY_CATEGORY: Record<string, string[]> = {
  'Self-Discovery': [
    'What is something you are learning about yourself lately?',
    'What would you do today if you had zero fear of failing?',
    'How have you grown and shifted in the past year?',
  ],
  'Inner Peace': [
    'What brought you a genuine moment of peace or comfort today?',
    'What is a place or ritual where your mind feels completely safe?',
    'What are you quietly proud of that went unnoticed by others?',
  ],
  'Letting Go': [
    'What expectation or burden are you holding onto that you could release?',
    'What gentle boundary do you need to set to protect your mental energy?',
    'What is something from the past that you forgive yourself for?',
  ],
};

interface ReflectionCard extends BaseDeckCard {
  id: number;
  category: string;
  badge: string;
  solidColor: string;
  baseRotation: number;
  watermarkIcon: keyof typeof Feather.glyphMap;
  prompt: string;
  text: string;
}

export default function ReflectionScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);

  const [cards, setCards] = useState<ReflectionCard[]>([
    {
      id: 1,
      category: 'Self-Discovery',
      badge: 'Insight 1',
      solidColor: '#0F766E', // Rich Teal
      baseRotation: -4,
      watermarkIcon: 'compass',
      prompt: PROMPTS_BY_CATEGORY['Self-Discovery'][0],
      text: '',
    },
    {
      id: 2,
      category: 'Inner Peace',
      badge: 'Insight 2',
      solidColor: '#6D28D9', // Deep Purple
      baseRotation: 4.5,
      watermarkIcon: 'sun',
      prompt: PROMPTS_BY_CATEGORY['Inner Peace'][0],
      text: '',
    },
    {
      id: 3,
      category: 'Letting Go',
      badge: 'Insight 3',
      solidColor: '#BE185D', // Crimson Pink
      baseRotation: -3,
      watermarkIcon: 'feather',
      prompt: PROMPTS_BY_CATEGORY['Letting Go'][0],
      text: '',
    },
  ]);

  const [isSaved, setIsSaved] = useState(false);

  const updateCardText = useCallback((text: string, cardId: number) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, text } : c))
    );
  }, []);

  const shuffleCardPrompt = useCallback((cardId: number, category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pool = PROMPTS_BY_CATEGORY[category] || PROMPTS_BY_CATEGORY['Self-Discovery'];
    const randomIndex = Math.floor(Math.random() * pool.length);
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, prompt: pool[randomIndex] } : c
      )
    );
  }, []);

  const filledCount = cards.filter((c) => c.text.trim().length > 0).length;
  const hasAnyInput = filledCount > 0;

  const handleSave = () => {
    if (!hasAnyInput) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const formattedList = cards
      .filter((c) => c.text.trim().length > 0)
      .map((c) => `• [${c.category}] "${c.prompt}"\n  Thoughts: "${c.text.trim()}"`)
      .join('\n\n');

    saveJournalEntry({
      title: 'Daily Reflection Deck',
      content: `Today's Reflections:\n\n${formattedList}`,
      promptUsed: 'reflection_deck_studio',
      userId: user?.id,
    });

    refreshData();
    setIsSaved(true);
  };

  const renderReflectionCard = (
    card: ReflectionCard,
    isTop: boolean,
    onNext: () => void,
    onPrev: () => void
  ) => {
    return (
      <View style={[styles.portraitCard, { backgroundColor: card.solidColor }]}>
        {/* Background Watermark Icon */}
        <View style={styles.watermarkIconContainer} pointerEvents="none">
          <Feather name={card.watermarkIcon} size={130} color="rgba(255, 255, 255, 0.12)" />
        </View>

        {/* Card Top Pill & Shuffle */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.badgePillInner}>
            <Feather name="compass" size={12} color="#FFFFFF" />
            <Text style={styles.badgePillInnerText}>{card.category}</Text>
          </View>
          <Pressable
            style={styles.shuffleBtn}
            onPress={() => shuffleCardPrompt(card.id, card.category)}
          >
            <Feather name="refresh-cw" size={13} color="#FFFFFF" />
            <Text style={styles.shuffleBtnText}>Shuffle Idea</Text>
          </Pressable>
        </View>

        {/* Prompt Question */}
        <View style={styles.promptWrapper}>
          <Text style={styles.promptTitle}>{card.badge}</Text>
          <Text style={styles.promptText}>{card.prompt}</Text>
        </View>

        {/* Multi-Line Input Box */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.cardTextInput}
            placeholder="Write your thoughts and reflections here..."
            placeholderTextColor="rgba(255, 255, 255, 0.45)"
            value={card.text}
            onChangeText={(t) => updateCardText(t, card.id)}
            multiline
            maxLength={350}
            textAlignVertical="top"
          />
        </View>

        {/* Card Bottom Swipe Hint */}
        <View style={styles.cardFooterRow}>
          <Pressable onPress={onPrev} style={styles.cardNavBtn}>
            <Feather name="chevron-left" size={16} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.swipeHintText}>👈 Swipe card to flip 👉</Text>
          <Pressable onPress={onNext} style={styles.cardNavBtn}>
            <Feather name="chevron-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <GradientBackground variant="glow">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              <Text style={styles.headerTitle}>Reflection Studio</Text>
              <Text style={styles.headerSubtitle}>Swipable Self-Inquiry Deck</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{filledCount}/3 Filled</Text>
            </View>
          </View>

          {!isSaved ? (
            <View style={styles.deckBody}>
              {/* Reusable Stacked Cards Deck */}
              <SwipableCardDeck
                cards={cards}
                renderCard={renderReflectionCard}
              />

              {/* Bottom Deck Actions */}
              <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.md }]}>
                <Button
                  title="Seal Reflections to Journal"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleSave}
                  disabled={!hasAnyInput}
                />
              </View>
            </View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.doneContainer}>
              <View style={styles.doneIconBg}>
                <Feather name="compass" size={44} color="#FFFFFF" />
              </View>
              <Text style={styles.doneTitle}>Reflections Sealed</Text>
              <Text style={styles.doneSubtitle}>
                {filledCount} reflection insights were safely saved into your SQLite journal. Self-inquiry builds lasting emotional wisdom.
              </Text>

              <View style={{ width: '100%', marginTop: Spacing.xl }}>
                <Button
                  title="Return to Activities"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={() => router.back()}
                />
              </View>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
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
    backgroundColor: 'rgba(15, 118, 110, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    zIndex: 10,
  },
  badgePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#14B8A6',
  },

  deckBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  portraitCard: {
    flex: 1,
    borderRadius: 28,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  watermarkIconContainer: {
    position: 'absolute',
    right: -20,
    bottom: -20,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  badgePillInnerText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  shuffleBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: '#FFFFFF',
  },

  promptWrapper: {
    marginVertical: Spacing.sm,
  },
  promptTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  promptText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall + 1,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },

  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: Spacing.sm,
  },
  cardTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    lineHeight: 22,
  },

  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  cardNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  bottomControls: {
    width: '100%',
  },

  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  doneIconBg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  doneTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
