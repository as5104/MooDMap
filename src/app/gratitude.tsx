/**
 * MoodMap — Gratitude Studio
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

const PROMPTS_POOL = [
  'A person whose presence brought you peace, warmth, or comfort today',
  'A small sensory pleasure (warm drink, gentle breeze, soothing song)',
  'Something difficult you handled with grace, patience, or resilience',
  'A moment today where you felt completely at ease and grounded',
  'A physical space or cozy shelter where you feel safe and relaxed',
  'An unexpected kindness, smile, or message you received recently',
  'Something about your body or mind that you deeply appreciate',
];

interface GratitudeCard extends BaseDeckCard {
  id: number;
  title: string;
  badge: string;
  solidColor: string;
  baseRotation: number;
  watermarkIcon: keyof typeof Feather.glyphMap;
  prompt: string;
  text: string;
}

export default function GratitudeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);

  const [cards, setCards] = useState<GratitudeCard[]>([
    {
      id: 1,
      title: 'First Blessing',
      badge: 'Anchor 1',
      solidColor: '#B45309', // Deep Amber
      baseRotation: -4,
      watermarkIcon: 'sun',
      prompt: PROMPTS_POOL[0],
      text: '',
    },
    {
      id: 2,
      title: 'Second Blessing',
      badge: 'Anchor 2',
      solidColor: '#047857', // Rich Emerald
      baseRotation: 4.5,
      watermarkIcon: 'feather',
      prompt: PROMPTS_POOL[1],
      text: '',
    },
    {
      id: 3,
      title: 'Third Blessing',
      badge: 'Anchor 3',
      solidColor: '#4338CA', // Royal Indigo
      baseRotation: -3,
      watermarkIcon: 'heart',
      prompt: PROMPTS_POOL[2],
      text: '',
    },
  ]);

  const [isSaved, setIsSaved] = useState(false);

  const updateCardText = useCallback((text: string, cardId: number) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, text } : c))
    );
  }, []);

  const shufflePrompt = useCallback((cardId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const randomIndex = Math.floor(Math.random() * PROMPTS_POOL.length);
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, prompt: PROMPTS_POOL[randomIndex] } : c
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
      .map((c) => `• ${c.title}: "${c.text.trim()}" (Prompt: ${c.prompt})`)
      .join('\n\n');

    saveJournalEntry({
      title: 'Daily Gratitude Deck',
      content: `Today's Gratitude Deck:\n\n${formattedList}`,
      promptUsed: 'gratitude_deck_studio',
      userId: user?.id,
    });

    refreshData();
    setIsSaved(true);
  };

  const renderGratitudeCard = (
    card: GratitudeCard,
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
            <Feather name="heart" size={12} color="#FFFFFF" />
            <Text style={styles.badgePillInnerText}>{card.badge}</Text>
          </View>
          <Pressable
            style={styles.shuffleBtn}
            onPress={() => shufflePrompt(card.id)}
          >
            <Feather name="refresh-cw" size={13} color="#FFFFFF" />
            <Text style={styles.shuffleBtnText}>Shuffle Idea</Text>
          </Pressable>
        </View>

        {/* Prompt Question */}
        <View style={styles.promptWrapper}>
          <Text style={styles.promptTitle}>{card.title}</Text>
          <Text style={styles.promptText}>{card.prompt}</Text>
        </View>

        {/* Multi-Line Input Box */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.cardTextInput}
            placeholder="Write your blessing or appreciation here..."
            placeholderTextColor="rgba(255, 255, 255, 0.45)"
            value={card.text}
            onChangeText={(t) => updateCardText(t, card.id)}
            multiline
            maxLength={300}
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
              <Text style={styles.headerTitle}>Gratitude Studio</Text>
              <Text style={styles.headerSubtitle}>Swipable Long-Portrait Deck</Text>
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
                renderCard={renderGratitudeCard}
              />

              {/* Bottom Deck Actions */}
              <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.md }]}>
                <Button
                  title="Seal Deck to Journal"
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
                <Feather name="heart" size={44} color="#FFFFFF" />
              </View>
              <Text style={styles.doneTitle}>Gratitude Deck Sealed</Text>
              <Text style={styles.doneSubtitle}>
                {filledCount} reflection cards were anchored in your SQLite journal. Take a slow breath and feel the abundance within you.
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    zIndex: 10,
  },
  badgePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#F59E0B',
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
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#B45309',
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
