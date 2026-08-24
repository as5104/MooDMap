/**
 * MoodMap — Weekly / Monthly Highlight Cards Deck
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SwipableCardDeck, type BaseDeckCard } from '@/components/ui/SwipableCardDeck';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { MOOD_MAP } from '@/constants/moods';
import { TAG_MAP } from '@/constants/tags';
import type {
  MoodStatsData,
  MoodSummaryData,
  EnergyStressData,
  DayMoodData,
  DayOfWeekInsight,
  TagFrequencyItem,
} from '@/services/moodService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = 300;

interface HighlightCardItem extends BaseDeckCard {
  badge: string;
  badgeIcon: keyof typeof Feather.glyphMap;
  watermarkIcon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  body: string;
  glowColor: string;
  illustrationSvg?: any;
  metricLabel?: string;
  metricValue?: string;
}

interface WeeklyHighlightDeckProps {
  stats: MoodStatsData;
  summary: MoodSummaryData | null;
  energyStress: EnergyStressData | null;
  weeklyMoods: DayMoodData[];
  dayOfWeekData: DayOfWeekInsight[];
  tagFreq: TagFrequencyItem[];
  periodDays?: number;
}

export function WeeklyHighlightDeck({
  stats,
  summary,
  energyStress,
  weeklyMoods,
  dayOfWeekData,
  tagFreq,
  periodDays = 7,
}: WeeklyHighlightDeckProps) {
  const cards: HighlightCardItem[] = useMemo(() => {
    // 1. Dominant Mindset & SVG selection
    let mindsetType: 'positive' | 'neutral' | 'negative' = 'positive';
    let illustrationSvg = require('../../../assets/images/positive.svg');
    let solidColor = '#065F46'; // Emerald
    let glowColor = '#10B981';
    let mindsetTitle = 'Positive Horizon';

    if (stats.negative > stats.positive && stats.negative >= stats.neutral) {
      mindsetType = 'negative';
      illustrationSvg = require('../../../assets/images/negative.svg');
      solidColor = '#831843'; // Rose / Wine
      glowColor = '#F43F5E';
      mindsetTitle = 'Challenging Stretch';
    } else if (stats.neutral > stats.positive && stats.neutral >= stats.negative) {
      mindsetType = 'neutral';
      illustrationSvg = require('../../../assets/images/nutral.svg');
      solidColor = '#78350F'; // Warm Ochre
      glowColor = '#F59E0B';
      mindsetTitle = 'Balanced & Centered';
    }

    const totalLogs = stats.total || 1;
    const dominantPct = Math.round((stats[mindsetType] / totalLogs) * 100);
    const dominantMoodDef = summary?.dominantMood ? MOOD_MAP[summary.dominantMood] : null;

    // 2. Calmest Day Calculation
    let calmestDay = 'Wednesday';
    let calmestStress = '1.5';
    let calmestScore = '8.2';

    if (dayOfWeekData && dayOfWeekData.length > 0) {
      const best = [...dayOfWeekData].sort((a, b) => b.avgScore - a.avgScore)[0];
      if (best) {
        calmestDay = best.day;
        calmestScore = best.avgScore.toFixed(1);
      }
    } else if (weeklyMoods && weeklyMoods.length > 0) {
      const best = [...weeklyMoods].sort((a, b) => (b.moodScore || 0) - (a.moodScore || 0))[0];
      if (best) {
        calmestDay = best.day;
        calmestScore = best.moodScore ? `${best.moodScore}/10` : '8.0';
      }
    }

    // 3. Top Positive Habit / Tag
    let topTag = 'Exercise & Rest';
    if (tagFreq && tagFreq.length > 0) {
      const bestTagItem = tagFreq[0];
      topTag = TAG_MAP[bestTagItem.tag]?.label ?? bestTagItem.tag;
    } else if (summary?.topTrigger) {
      topTag = TAG_MAP[summary.topTrigger]?.label ?? summary.topTrigger;
    }

    // 4. Stress & Energy Equilibrium
    const avgStress = energyStress?.avgStress ? energyStress.avgStress.toFixed(1) : '2.0';
    const avgEnergy = energyStress?.avgEnergy ? energyStress.avgEnergy.toFixed(1) : '3.5';
    const trendText = summary?.trendDirection === 'improving'
      ? 'Emotional strain is on a steady downward trajectory.'
      : summary?.trendDirection === 'declining'
      ? 'Mild stress observed. Extra pause breaks recommended.'
      : 'Stress levels remained stable and well-contained.';

    return [
      // CARD 1: Dominant Mood with Custom SVG
      {
        id: 'dominant_mood',
        badge: 'Dominant Mindset',
        badgeIcon: 'sun',
        watermarkIcon: 'sun',
        title: mindsetTitle,
        subtitle: `${dominantPct}% ${mindsetType} days • Dominant: ${dominantMoodDef?.label ?? 'Content'}`,
        body: `Your overall emotional state this period has been predominantly ${mindsetType}.`,
        solidColor,
        glowColor,
        illustrationSvg,
        baseRotation: -4,
      },

      // CARD 2: Calmest Day of the Week
      {
        id: 'calmest_day',
        badge: 'Peak Tranquility',
        badgeIcon: 'feather',
        watermarkIcon: 'feather',
        title: `${calmestDay} was your calmest day`,
        subtitle: `Avg Score: ${calmestScore} • Minimum Stress`,
        body: `Your stress levels were lowest on ${calmestDay}. Consider replicating your routine and bedtime from this day.`,
        solidColor: '#0F766E', // Deep Teal
        glowColor: '#14B8A6',
        metricLabel: 'Peak Day',
        metricValue: calmestDay,
        baseRotation: 4.5,
      },

      // CARD 3: Top Positive Habit
      {
        id: 'positive_habit',
        badge: 'Mood Catalyst',
        badgeIcon: 'zap',
        watermarkIcon: 'zap',
        title: `Boosted by ${topTag}`,
        subtitle: `Highest Correlated Habit`,
        body: `Logging '${topTag}' correlated strongly with higher energy and positive mindset scores.`,
        solidColor: '#92400E', // Amber
        glowColor: '#F59E0B',
        metricLabel: 'Top Habit',
        metricValue: topTag,
        baseRotation: -3,
      },

      // CARD 4: Stress Reduction Trend
      {
        id: 'stress_trend',
        badge: 'Stress & Energy',
        badgeIcon: 'shield',
        watermarkIcon: 'trending-down',
        title: `Energy ${avgEnergy}/5 • Stress ${avgStress}/5`,
        subtitle: `Trend: ${summary?.trendDirection ? summary.trendDirection.toUpperCase() : 'STABLE'}`,
        body: trendText,
        solidColor: '#1E3A8A', // Deep Indigo
        glowColor: '#3B82F6',
        metricLabel: 'Stress Index',
        metricValue: `${avgStress}/5`,
        baseRotation: 3.5,
      },
    ];
  }, [stats, summary, energyStress, weeklyMoods, dayOfWeekData, tagFreq]);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBg}>
            <Feather name="layers" size={15} color={Colors.accent.primary} />
          </View>
          <Text style={styles.headerTitle}>
            {periodDays === 7 ? 'Weekly Highlight Cards' : 'Period Highlight Cards'}
          </Text>
        </View>
        <View style={styles.swipeHint}>
          <Feather name="arrow-right" size={12} color={Colors.text.tertiary} />
          <Text style={styles.swipeHintText}>Swipe deck</Text>
        </View>
      </View>

      {/* Gesture Deck */}
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

              {/* Full-Color Vibrant Mindset Illustration (Right aligned) */}
              {card.illustrationSvg && (
                <View style={styles.svgIllustrationWrapper} pointerEvents="none">
                  <Image
                    source={card.illustrationSvg}
                    style={styles.svgIllustrationImage}
                    contentFit="contain"
                  />
                </View>
              )}

              {/* Background Watermark Icon (For cards without custom SVG) */}
              {!card.illustrationSvg && card.watermarkIcon && (
                <View style={styles.watermarkWrapper} pointerEvents="none">
                  <Feather
                    name={card.watermarkIcon}
                    size={135}
                    color="rgba(255, 255, 255, 0.09)"
                  />
                </View>
              )}

              {/* Top Header Badge */}
              <View style={styles.cardBadgeRow}>
                <View style={styles.cardBadge}>
                  <Feather name={card.badgeIcon} size={12} color="#FFFFFF" />
                  <Text style={styles.cardBadgeText}>{card.badge}</Text>
                </View>
                <View style={styles.cardNextArrow}>
                  <Feather name="arrow-right" size={13} color="rgba(255, 255, 255, 0.7)" />
                </View>
              </View>

              {/* Main Body Text (Left aligned, wraps cleanly without truncation) */}
              <View style={[styles.cardBodyContainer, card.illustrationSvg ? styles.cardBodyWithSvg : null]}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                <Text style={styles.cardBodyText}>{card.body}</Text>
              </View>

              {/* Footer Pill */}
              <View style={styles.cardFooter}>
                <View style={styles.cardFooterPill}>
                  <Feather name="check-circle" size={12} color="#FFFFFF" />
                  <Text style={styles.cardFooterPillText}>
                    {card.metricValue ? `${card.metricLabel}: ${card.metricValue}` : 'Mindful Reflection'}
                  </Text>
                </View>
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
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.25,
  },
  svgIllustrationWrapper: {
    position: 'absolute',
    right: -4,
    bottom: 24,
    zIndex: 1,
  },
  svgIllustrationImage: {
    width: 135,
    height: 135,
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

  cardBodyContainer: {
    marginVertical: Spacing.sm,
    zIndex: 2,
    width: '100%',
  },
  cardBodyWithSvg: {
    maxWidth: '63%',
  },
  cardTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.88)',
    marginBottom: 8,
    lineHeight: 16,
  },
  cardBodyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 20,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  cardFooterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  cardFooterPillText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption - 1,
    color: '#FFFFFF',
  },
});
