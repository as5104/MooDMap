/**
 * MoodMap — Insights Screen 
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, WeeklyMoodRow } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { useAppStore } from '@/stores/appStore';
import {
  getMoodScore,
  getWeeklyMoods,
  getMoodStats,
  getMoodHistory,
  getMonthlyBarData,
  type DayMoodData,
  type MoodEntryRow,
  type MoodStatsData,
} from '@/services/moodService';

const PERIODS = ['All', 'Days', 'Weeks', 'Months'];

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const [activePeriod, setActivePeriod] = useState(2);

  const [moodScore, setMoodScoreLocal] = useState(0);
  const [weeklyMoods, setWeeklyMoods] = useState<DayMoodData[]>([]);
  const [stats, setStats] = useState<MoodStatsData>({ positive: 0, negative: 0, neutral: 0, total: 0 });
  const [history, setHistory] = useState<MoodEntryRow[]>([]);
  const [barData, setBarData] = useState<{ positive: number; negative: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const periodDays = activePeriod === 0 ? 365 : activePeriod === 1 ? 7 : activePeriod === 2 ? 30 : 90;

      const score = getMoodScore(userId);
      const weekly = getWeeklyMoods(userId);
      const statsData = getMoodStats(userId, periodDays);
      const historyData = getMoodHistory(userId, 10);
      const bars = getMonthlyBarData(userId, periodDays);

      setMoodScoreLocal(score);
      setWeeklyMoods(weekly);
      setStats(statsData);
      setHistory(historyData);
      setBarData(bars);
    } catch (e) {
      console.error('[Insights] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activePeriod, dataVersion, isAppReady]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const hasData = stats.total > 0;

  return (
    <GradientBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mood Stats</Text>
          <Pressable style={styles.filterBtn}>
            <Feather name="sliders" size={20} color={Colors.text.secondary} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {hasData
            ? 'See your mood through the day.'
            : 'Start logging moods to see your stats.'}
        </Text>

        {/* Period Tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map((p, i) => (
            <Pressable
              key={p}
              onPress={() => setActivePeriod(i)}
              style={[
                styles.periodTab,
                activePeriod === i && styles.periodTabActive,
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  activePeriod === i && styles.periodTextActive,
                ]}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Mood Score Card */}
        <GlassCard intensity="medium" padding="lg" style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Feather name="heart" size={16} color={Colors.accent.olive} />
            <Text style={styles.scoreLabel}>Mood Score</Text>
          </View>
          <Text style={styles.scoreValue}>{hasData ? moodScore : '—'}</Text>
          <Text style={styles.scoreMsg}>
            {!hasData
              ? 'Complete mood check-ins to build your score'
              : moodScore >= 70
              ? 'Congratulations! You are mentally healthy.'
              : moodScore >= 40
              ? 'Mixed feelings — try some activities to boost your mood.'
              : 'Take care of yourself. Try breathing or journaling.'}
          </Text>
        </GlassCard>

        {/* Mood History Row */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mood History</Text>
          <Text style={styles.sectionDate}>
            {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
        {weeklyMoods.length > 0 ? (
          <GlassCard intensity="medium" padding="lg" style={styles.historyCard}>
            <WeeklyMoodRow
              days={weeklyMoods.map((d) => ({
                day: d.day,
                expression: d.expression,
                faceColor: d.faceColor,
              }))}
            />
          </GlassCard>
        ) : (
          <GlassCard intensity="subtle" padding="lg" style={styles.historyCard}>
            <Text style={styles.emptyText}>No mood data for this week yet</Text>
          </GlassCard>
        )}

        {/* Legend + Bar Chart */}
        {hasData && (
          <>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent.olive }]} />
                <Text style={styles.legendText}>Positive ({stats.positive})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent.terracotta }]} />
                <Text style={styles.legendText}>Negative ({stats.negative})</Text>
              </View>
            </View>

            <GlassCard intensity="subtle" padding="lg" style={styles.chartCard}>
              <View style={styles.barChart}>
                {barData.map((bar, i) => (
                  <View key={i} style={styles.barGroup}>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.barPositive,
                          { height: `${Math.max(bar.positive * 100, 5)}%` },
                        ]}
                      />
                      <View
                        style={[
                          styles.barNegative,
                          { height: `${Math.max(bar.negative * 100, 5)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>
          </>
        )}

        {/* Score History */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Entries</Text>
            {history.map((entry) => {
              const mood = MOOD_MAP[entry.mood_type as MoodType];
              const dateObj = new Date(entry.created_at);
              const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <GlassCard key={entry.id} intensity="medium" padding="md" style={styles.historyEntry}>
                  <View style={styles.historyEntryRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyDate}>{dateLabel.toUpperCase()}</Text>
                    </View>
                    <View style={styles.historyMid}>
                      <Text style={styles.historyLabel}>
                        {mood?.emoji ?? '😐'} {mood?.label ?? entry.mood_type}
                      </Text>
                      <Text style={styles.historyDesc}>
                        {entry.note ? entry.note.slice(0, 50) : `Score: ${entry.mood_score}/10`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          borderColor:
                            entry.mood_score >= 7 ? Colors.accent.olive : Colors.accent.terracotta,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scoreBadgeText,
                          {
                            color:
                              entry.mood_score >= 7 ? Colors.accent.olive : Colors.accent.terracotta,
                          },
                        ]}
                      >
                        {Math.round((entry.mood_score / 10) * 100)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xxl,
  },

  periodRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: Radius.pill,
    padding: 3,
  },
  periodTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  periodTabActive: {
    backgroundColor: Colors.accent.olive,
  },
  periodText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  periodTextActive: {
    color: Colors.text.onAccent,
    fontFamily: Fonts.bodySemiBold,
  },

  scoreCard: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  scoreLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.olive,
  },
  scoreValue: {
    fontFamily: Fonts.heading,
    fontSize: 72,
    color: Colors.text.primary,
    lineHeight: 80,
  },
  scoreMsg: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  sectionDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  historyCard: {
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  chartCard: {
    marginBottom: Spacing.xxl,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    alignItems: 'flex-end',
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: 12,
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barPositive: {
    backgroundColor: Colors.accent.olive,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barNegative: {
    backgroundColor: Colors.accent.terracotta,
  },

  historyEntry: {
    marginBottom: Spacing.md,
  },
  historyEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyLeft: {
    marginRight: Spacing.lg,
  },
  historyDate: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.accent.terracotta,
  },
  historyMid: {
    flex: 1,
  },
  historyLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  historyDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
  },
});
