/**
 * MoodMap — Daily Mindful Insights & Wisdom Deck
 * Stacked 4-card interactive deck on the Home dashboard
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SwipableCardDeck, type BaseDeckCard } from '@/components/ui/SwipableCardDeck';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import type { MoodType } from '@/constants/moods';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = 280;

export interface WisdomDeckCard extends BaseDeckCard {
  badge: string;
  badgeIcon: keyof typeof Feather.glyphMap;
  watermarkIcon?: keyof typeof Feather.glyphMap;
  title: string;
  quote: string;
  actionText: string;
  actionRoute?: string;
  actionParams?: Record<string, any>;
  glowColor: string;
}

interface DailyWisdomDeckProps {
  todayMood?: {
    moodType?: MoodType | string;
    moodScore?: number;
    energyLevel?: number;
    stressLevel?: number;
  } | null;
}

// 1. DIVERSE COGNITIVE REFRAMING POOL (20 Insights)
const REFRAMING_INSIGHTS = [
  {
    title: 'Control vs. Acceptance',
    quote: 'Notice the friction you feel today. Separate what is directly in your hands from what is outside your influence.',
    action: 'Practice letting go of one outcome',
    route: '/reflection',
  },
  {
    title: 'The Growth Perspective',
    quote: 'When an unexpected change occurs, pause and ask: "What is this situation teaching me about my own adaptability?"',
    action: 'Reframe a current challenge',
    route: '/reflection',
  },
  {
    title: 'Thought vs. Absolute Truth',
    quote: 'You are not your thoughts; you are the calm observer behind them. Let anxious thoughts drift like passing clouds.',
    action: 'Observe without judgment',
    route: '/breathing',
  },
  {
    title: 'Self-Compassion Anchor',
    quote: 'Talk to yourself today the way you would speak to a cherished friend who is doing their absolute best.',
    action: 'Offer yourself gentle patience',
    route: '/comfort-box',
  },
  {
    title: 'The 10-10-10 Rule',
    quote: 'Ask yourself: Will this dilemma matter in 10 minutes, 10 months, or 10 years? Reclaim your mental energy.',
    action: 'Gain long-term perspective',
    route: '/reflection',
  },
  {
    title: 'The Spotlight Illusion',
    quote: 'We often overestimate how much others judge us. In reality, everyone is focused on their own internal world.',
    action: 'Release social anxiety',
    route: '/grounding',
  },
  {
    title: 'The Second Arrow',
    quote: 'The first arrow is the difficult event; the second arrow is our mental resistance. Avoid shooting yourself twice.',
    action: 'Accept the initial feeling',
    route: '/breathing',
  },
  {
    title: 'All-or-Nothing Trap',
    quote: 'Progress is messy and continuous, not binary. A 1% step forward today is infinitely better than zero.',
    action: 'Celebrate a small win',
    route: '/gratitude',
  },
  {
    title: 'The Permission to Rest',
    quote: 'Rest is not a reward you earn after exhaustion; it is a vital biological requirement for clarity and peace.',
    action: 'Take a 3-minute pause',
    route: '/pause-timer',
  },
  {
    title: 'Emotional Reasoning',
    quote: 'Just because you feel overwhelmed does not mean you are incapable. Feelings are weather, not permanent facts.',
    action: 'Ground in the present',
    route: '/grounding',
  },
  {
    title: 'The Clean Slate',
    quote: 'No matter what happened yesterday or this morning, this exact breath is a completely clean starting line.',
    action: 'Begin with fresh intent',
    route: '/journal-editor',
  },
  {
    title: 'De-Catastrophizing',
    quote: 'Instead of asking "What if everything goes wrong?", balance your mind by asking "What if everything goes right?"',
    action: 'Visualize a positive path',
    route: '/reflection',
  },
  {
    title: 'Urge Surfing',
    quote: 'Difficult emotions peak like ocean waves and naturally subside within 90 seconds if you observe without fueling them.',
    action: 'Ride out the wave in stillness',
    route: '/pause-timer',
  },
  {
    title: 'Boundaries as Self-Care',
    quote: 'Saying no to something draining is saying yes to your peace of mind and emotional sustainability.',
    action: 'Protect your energy today',
    route: '/letters',
  },
  {
    title: 'Comparison is a Thief',
    quote: 'Do not compare your backstage to everyone else’s highlight reel. Your journey has its own unique rhythm.',
    action: 'Focus on your own track',
    route: '/gratitude',
  },
  {
    title: 'The 5-Minute Threshold',
    quote: 'Action often precedes motivation. Dedicate just 5 focused minutes to a task, and inertia will do the rest.',
    action: 'Start with 5 minutes',
    route: '/pause-timer',
  },
  {
    title: 'Peak-End Mindfulness',
    quote: 'We remember experiences by their emotional peak and how they end. End today on a calm, grateful note.',
    action: 'Plan a peaceful evening',
    route: '/journal-editor',
  },
  {
    title: 'Uncertainty as Possibility',
    quote: 'When nothing is certain, anything is possible. Shift fear of the unknown into curiosity for what could be.',
    action: 'Open your curiosity',
    route: '/reflection',
  },
  {
    title: 'Somatic Release',
    quote: 'Your body stores tension before your mind notices. Drop your shoulders, unclench your jaw, and breathe out.',
    action: 'Release body tension',
    route: '/breathing',
  },
  {
    title: 'The Inner Anchor',
    quote: 'You cannot calm the storm outside, but you can build stillness inside your own sanctuary.',
    action: 'Enter your inner space',
    route: '/comfort-box',
  },
];

// 2. DIVERSE STOIC & PHILOSOPHY WISDOM POOL (20 Quotes)
const STOIC_AND_PHILOSOPHY_WISDOM = [
  {
    title: 'Power Over the Mind',
    quote: '“You have power over your mind — not outside events. Realize this, and you will find invincible strength.”',
    author: 'Marcus Aurelius',
  },
  {
    title: 'The Present Moment',
    quote: '“True happiness is to enjoy the present, without anxious dependence upon the future.”',
    author: 'Seneca',
  },
  {
    title: 'Unshakable Tranquility',
    quote: '“It’s not what happens to you, but how you react to it that matters.”',
    author: 'Epictetus',
  },
  {
    title: 'Inner Sanctuary',
    quote: '“Nowhere can man find a quieter or more untroubled retreat than in his own soul.”',
    author: 'Marcus Aurelius',
  },
  {
    title: 'The Freedom of Choice',
    quote: '“Between stimulus and response there is a space. In that space is our power to choose our response.”',
    author: 'Viktor Frankl',
  },
  {
    title: 'Settling the Water',
    quote: '“Do you have the patience to wait until your mud settles and the water is clear?”',
    author: 'Lao Tzu',
  },
  {
    title: 'The Light Within',
    quote: '“The wound is the place where the light enters you.”',
    author: 'Rumi',
  },
  {
    title: 'Mindful Breathing',
    quote: '“Breathing in, I calm body and mind. Breathing out, I smile. Dwelling in the present moment.”',
    author: 'Thich Nhat Hanh',
  },
  {
    title: 'Flowing with the Current',
    quote: '“Muddy water is best cleared by leaving it alone.”',
    author: 'Alan Watts',
  },
  {
    title: 'Awakening the Soul',
    quote: '“Who looks outside, dreams; who looks inside, awakes.”',
    author: 'Carl Jung',
  },
  {
    title: 'Peace at Rest',
    quote: '“A busy mind cannot see clearly. Peace is happiness at rest; happiness is peace in motion.”',
    author: 'Naval Ravikant',
  },
  {
    title: 'Courage and Resilience',
    quote: '“You may encounter many defeats, but you must not be defeated. It may be necessary to know who you are.”',
    author: 'Maya Angelou',
  },
  {
    title: 'Inner Self-Reliance',
    quote: '“Nothing can bring you peace but yourself.”',
    author: 'Ralph Waldo Emerson',
  },
  {
    title: 'Systems Over Worry',
    quote: '“You do not rise to the level of your goals. You fall to the level of your systems.”',
    author: 'James Clear',
  },
  {
    title: 'The Sanctuary of Stillness',
    quote: '“Within you there is a stillness and a sanctuary to which you can retreat at any time.”',
    author: 'Hermann Hesse',
  },
  {
    title: 'Guarding the Thoughts',
    quote: '“Nothing can harm you as much as your own thoughts unguarded.”',
    author: 'Gautama Buddha',
  },
  {
    title: 'Loving Your Fate',
    quote: '“Accept the things to which fate binds you, and love the people with whom fate brings you together.”',
    author: 'Marcus Aurelius',
  },
  {
    title: 'The Shortness of Life',
    quote: '“It is not that we have a short time to live, but that we waste a lot of it.”',
    author: 'Seneca',
  },
  {
    title: 'Wealth of Spirit',
    quote: '“He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.”',
    author: 'Epictetus',
  },
  {
    title: 'Gentle Strength',
    quote: '“In a gentle way, you can shake the world.”',
    author: 'Mahatma Gandhi',
  },
];

// 3. DIVERSE GRATITUDE & INNER SANCTUARY POOL (20 Prompts)
const GRATITUDE_AND_SAVORING = [
  {
    title: 'Simple Comforts',
    quote: 'Take a breath and notice one small sensory blessing right now — a comforting temperature, a quiet sound, or a warm cup.',
    action: 'Log Sensory Blessing',
  },
  {
    title: 'An Unsung Hero',
    quote: 'Reflect on someone whose presence makes your world slightly easier, even if they never ask for recognition.',
    action: 'Send Mental Gratitude',
  },
  {
    title: 'Your Inner Resilience',
    quote: 'Give thanks to yourself for all the difficult days you have already survived and grown through.',
    action: 'Acknowledge Your Strength',
  },
  {
    title: 'The Gift of a Fresh Start',
    quote: 'Every new morning is an unwritten page. Release yesterday’s burdens and step forward unencumbered.',
    action: 'Begin with Fresh Intent',
  },
  {
    title: 'The Body’s Silent Work',
    quote: 'Appreciate your lungs for breathing and your heart for beating tirelessly without you having to ask.',
    action: 'Thank Your Physical Body',
  },
  {
    title: 'A Past Storm Survived',
    quote: 'Think of a hardship from last year that you overcame. Remember how capable you truly are.',
    action: 'Honor Your Journey',
  },
  {
    title: 'Everyday Conveniences',
    quote: 'Reflect on modern wonders we take for granted — clean running water, electricity, warm blankets, and music.',
    action: 'Appreciate Daily Comfort',
  },
  {
    title: 'A Safe & Quiet Space',
    quote: 'Notice the physical space around you that protects you from the elements and grants you peace.',
    action: 'Savor Your Sanctuary',
  },
  {
    title: 'A Song That Heals',
    quote: 'Recall a melody that always brings warmth or nostalgia to your spirit when you need it most.',
    action: 'Visit Comfort Box',
  },
  {
    title: 'Lessons from Hardship',
    quote: 'Name one insight or boundary you gained from a difficult chapter in your life.',
    action: 'Celebrate Wisdom Gained',
  },
  {
    title: 'Small Quiet Victories',
    quote: 'Acknowledge one small task you completed recently — drinking water, replying to a message, or showing up.',
    action: 'Give Yourself Credit',
  },
  {
    title: 'Unconditional Connection',
    quote: 'Send warmth to a friend, mentor, family member, or pet who makes you feel understood.',
    action: 'Pen an Appreciation Note',
  },
  {
    title: 'Nature’s Consistency',
    quote: 'Look outside and appreciate the sunrise, trees, sky, or cool breeze that endures through all seasons.',
    action: 'Connect with Nature',
  },
  {
    title: 'The Power of Choice',
    quote: 'Appreciate the freedom you have in this moment to choose your breath, thoughts, and next step.',
    action: 'Claim Your Agency',
  },
  {
    title: 'Memories of Laughter',
    quote: 'Bring to mind a funny moment that made you laugh uncontrollably. Let that lightness return.',
    action: 'Smile at the Memory',
  },
  {
    title: 'The Beauty of Art',
    quote: 'Give thanks for books, songs, poems, and art that have given language to your deepest feelings.',
    action: 'Immerse in Calming Sound',
  },
  {
    title: 'Patience Rewarded',
    quote: 'Reflect on a time when waiting patiently brought a better outcome than rushing.',
    action: 'Trust Your Timing',
  },
  {
    title: 'A Kind Word Received',
    quote: 'Remember a compliment or encouraging sentence someone told you that lifted your spirits.',
    action: 'Absorb the Kindness',
  },
  {
    title: 'Your Capacity to Care',
    quote: 'Appreciate your own heart for its ability to love, empathize, and care deeply for the world.',
    action: 'Honor Your Empathy',
  },
  {
    title: 'The Stillness of Now',
    quote: 'In this exact second, right here, you are safe, breathing, and supported. Savor this stillness.',
    action: 'Rest in the Present',
  },
];

export function DailyWisdomDeck({ todayMood }: DailyWisdomDeckProps) {
  // Deterministic daily index based on day of year
  const cards: WisdomDeckCard[] = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    const moodType = todayMood?.moodType;
    const stress = todayMood?.stressLevel ?? 1;
    const energy = todayMood?.energyLevel ?? 3;
    const score = todayMood?.moodScore ?? 7;

    // CARD 1: Dynamic Mood-Based Micro-Ritual & Actionable To-Do
    let microRitual: WisdomDeckCard;

    if (stress >= 4) {
      microRitual = {
        id: 'micro_task',
        badge: 'Stress Relief Ritual',
        badgeIcon: 'wind',
        watermarkIcon: 'wind',
        title: '4-7-8 De-escalation Breath',
        quote: 'High stress triggers fast breathing. Take 3 slow 4-7-8 cycles to instantly signal safety to your nervous system.',
        actionText: 'Start Breathing',
        actionRoute: '/breathing',
        solidColor: '#0E7490', // Cyan
        glowColor: '#06B6D4',
        baseRotation: -4,
      };
    } else if (energy <= 2 || moodType === 'tired') {
      microRitual = {
        id: 'micro_task',
        badge: 'Energy Boost',
        badgeIcon: 'zap',
        watermarkIcon: 'zap',
        title: 'Cognitive Reset & Recall',
        quote: 'Feeling sluggish or foggy? 2 quick rounds of Memory Matrix activates working memory and sharpens mental clarity.',
        actionText: 'Play Memory Matrix',
        actionRoute: '/memory-matrix',
        solidColor: '#065F46', // Emerald
        glowColor: '#10B981',
        baseRotation: -4,
      };
    } else if (moodType === 'anxious' || moodType === 'angry') {
      microRitual = {
        id: 'micro_task',
        badge: 'Sensory Grounding',
        badgeIcon: 'anchor',
        watermarkIcon: 'anchor',
        title: '5-4-3-2-1 Sensory Reset',
        quote: 'Pull your mind out of rumination by naming 5 things you see and 4 textures you can touch right now.',
        actionText: 'Start Grounding',
        actionRoute: '/grounding',
        solidColor: '#581C87', // Violet
        glowColor: '#A855F7',
        baseRotation: -4,
      };
    } else if (moodType === 'sad') {
      microRitual = {
        id: 'micro_task',
        badge: 'Emotional Comfort',
        badgeIcon: 'heart',
        watermarkIcon: 'heart',
        title: 'Visit Comfort Sanctuary',
        quote: 'When emotions feel heavy, revisit a soothing song or cherished reflection saved inside your Comfort Box.',
        actionText: 'Open Comfort Box',
        actionRoute: '/comfort-box',
        solidColor: '#831843', // Rose Wine
        glowColor: '#F43F5E',
        baseRotation: -4,
      };
    } else if (moodType === 'happy' || moodType === 'calm' || moodType === 'energized') {
      microRitual = {
        id: 'micro_task',
        badge: 'Anchor the Joy',
        badgeIcon: 'sun',
        watermarkIcon: 'sun',
        title: 'Capture This Golden Moment',
        quote: 'Positive memories fade unless anchored. Pen a quick 2-line reflection or time letter to your future self.',
        actionText: 'Write a Time Letter',
        actionRoute: '/letters',
        solidColor: '#92400E', // Amber
        glowColor: '#F59E0B',
        baseRotation: -4,
      };
    } else {
      // Default / Neutral / Morning check-in ritual
      microRitual = {
        id: 'micro_task',
        badge: 'Daily Micro-Ritual',
        badgeIcon: 'clock',
        watermarkIcon: 'clock',
        title: 'Mindful 3-Minute Pause',
        quote: 'Take a 3-minute screen-free silence break to reset your focus and cultivate internal clarity.',
        actionText: 'Start Pause Timer',
        actionRoute: '/pause-timer',
        solidColor: '#3F6212', // Lime
        glowColor: '#A3E635',
        baseRotation: -4,
      };
    }

    // CARD 2: Cognitive Reframe (Cycles through 20 reframes)
    const reframeIdx = (dayOfYear + Math.floor(score)) % REFRAMING_INSIGHTS.length;
    const reframeItem = REFRAMING_INSIGHTS[reframeIdx];

    const reframeCard: WisdomDeckCard = {
      id: 'reframing',
      badge: 'Cognitive Reframe',
      badgeIcon: 'refresh-cw',
      watermarkIcon: 'refresh-cw',
      title: reframeItem.title,
      quote: reframeItem.quote,
      actionText: reframeItem.action,
      actionRoute: reframeItem.route,
      solidColor: '#1E3A8A', // Deep Indigo
      glowColor: '#3B82F6',
      baseRotation: 4,
    };

    // CARD 3: Stoic & Timeless Philosophy (Cycles through 20 quotes)
    const stoicIdx = (dayOfYear * 3 + Math.floor(energy)) % STOIC_AND_PHILOSOPHY_WISDOM.length;
    const stoicItem = STOIC_AND_PHILOSOPHY_WISDOM[stoicIdx];

    const stoicCard: WisdomDeckCard = {
      id: 'stoic',
      badge: 'Timeless Wisdom',
      badgeIcon: 'shield',
      watermarkIcon: 'shield',
      title: stoicItem.title,
      quote: stoicItem.quote,
      actionText: stoicItem.author,
      actionRoute: '/reflection',
      solidColor: '#581C87', // Deep Violet
      glowColor: '#8B5CF6',
      baseRotation: -3.5,
    };

    // CARD 4: Gratitude & Savoring (Cycles through 20 prompts)
    const gratitudeIdx = (dayOfYear * 7 + Math.floor(stress)) % GRATITUDE_AND_SAVORING.length;
    const gratitudeItem = GRATITUDE_AND_SAVORING[gratitudeIdx];

    const gratitudeCard: WisdomDeckCard = {
      id: 'gratitude',
      badge: 'Daily Gratitude',
      badgeIcon: 'heart',
      watermarkIcon: 'heart',
      title: gratitudeItem.title,
      quote: gratitudeItem.quote,
      actionText: gratitudeItem.action,
      actionRoute: '/gratitude',
      solidColor: '#831843', // Deep Rose Wine
      glowColor: '#F472B6',
      baseRotation: 3,
    };

    return [microRitual, reframeCard, stoicCard, gratitudeCard];
  }, [todayMood]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBg}>
            <Feather name="compass" size={15} color={Colors.accent.primary} />
          </View>
          <Text style={styles.headerTitle}>Daily Mindful Insights</Text>
        </View>
        <View style={styles.swipeHint}>
          <Feather name="layers" size={12} color={Colors.text.tertiary} />
          <Text style={styles.swipeHintText}>Swipe cards</Text>
        </View>
      </View>

      {/* Gesture Stack */}
      <View style={styles.deckWrapper}>
        <SwipableCardDeck
          cards={cards}
          cardWidth={CARD_WIDTH}
          cardHeight={CARD_HEIGHT}
          renderCard={(card, isTop, onNext) => (
            <View style={[styles.cardContent, { backgroundColor: card.solidColor }]}>
              {/* Background Glow */}
              <View
                style={[
                  styles.glowAura,
                  { backgroundColor: card.glowColor },
                ]}
              />

              {/* Background Watermark Icon */}
              <View style={styles.watermarkWrapper} pointerEvents="none">
                <Feather
                  name={card.watermarkIcon || card.badgeIcon}
                  size={120}
                  color="rgba(255, 255, 255, 0.09)"
                />
              </View>

              {/* Card Top Badge */}
              <View style={styles.cardBadgeRow}>
                <View style={styles.cardBadge}>
                  <Feather name={card.badgeIcon} size={12} color="#FFFFFF" />
                  <Text style={styles.cardBadgeText}>{card.badge}</Text>
                </View>
                <Pressable
                  style={styles.cardNextArrow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onNext();
                  }}
                  hitSlop={8}
                >
                  <Feather name="arrow-right" size={13} color="rgba(255, 255, 255, 0.7)" />
                </Pressable>
              </View>

              {/* Center Content */}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardQuote}>{card.quote}</Text>
              </View>

              {/* Footer CTA Button */}
              <View style={styles.cardFooter}>
                <Pressable
                  style={styles.actionPill}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (card.actionRoute) {
                      router.push(card.actionRoute as any);
                    }
                  }}
                >
                  <Text style={styles.actionPillText}>{card.actionText}</Text>
                  <Feather name="arrow-right" size={12} color={Colors.accent.primary} />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(141, 233, 29, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },

  deckWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cardContent: {
    flex: 1,
    borderRadius: 22,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  glowAura: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.25,
  },
  watermarkWrapper: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    zIndex: 1,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  cardBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardNextArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody: {
    marginVertical: Spacing.xs,
    zIndex: 2,
  },
  cardTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardQuote: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 20,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.3)',
  },
  actionPillText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },
});
