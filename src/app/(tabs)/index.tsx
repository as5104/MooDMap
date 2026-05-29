/**
 * MoodMap — Home Dashboard 
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground, GlassCard, MetricCard, WeeklyMoodRow } from '@/components/ui';
import { MoodFace } from '@/components/ui/MoodFace';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { getSuggestion } from '@/constants/suggestions';
import { useAppStore } from '@/stores/appStore';
import {
  getTodayMood,
  getWeeklyMoods,
  getMoodScore,
  getMoodStreak,
  type DayMoodData,
} from '@/services/moodService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const todayMood = useAppStore((s) => s.todayMood);
  const setTodayMood = useAppStore((s) => s.setTodayMood);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const displayName = user?.user_metadata?.display_name ?? 'User';
  const firstName = displayName.split(' ')[0];

  const [moodScore, setMoodScore] = useState(0);
  const [weeklyMoods, setWeeklyMoods] = useState<DayMoodData[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Load data from DB
  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const todayEntry = getTodayMood(userId);
      const weekly = getWeeklyMoods(userId);
      const score = getMoodScore(userId);
      const streakData = getMoodStreak(userId);

      if (todayEntry) {
        setTodayMood({
          id: todayEntry.id,
          moodType: todayEntry.mood_type as MoodType,
          moodScore: todayEntry.mood_score,
          energyLevel: todayEntry.energy_level ?? undefined,
          stressLevel: todayEntry.stress_level ?? undefined,
          tags: todayEntry.tags ? JSON.parse(todayEntry.tags) : undefined,
          note: todayEntry.note ?? undefined,
          date: todayEntry.date,
        });
      }

      setWeeklyMoods(weekly);
      setMoodScore(score);
      setStreak(streakData.current);
    } catch (e) {
      console.error('[Home] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAppReady]);

  // Reload on focus and when dataVersion changes
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData, dataVersion, isAppReady])
  );

  const currentMood = todayMood ? MOOD_MAP[todayMood.moodType] : null;
  const suggestion = todayMood ? getSuggestion(todayMood.moodType) : null;

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
        {/* Date */}
        <View style={styles.dateRow}>
          <Feather name="calendar" size={14} color={Colors.text.secondary} />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>Hi, {firstName}!</Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Feather name="star" size={12} color={Colors.accent.olive} />
                <Text style={styles.badgeText}>Member</Text>
              </View>
              {currentMood && (
                <View style={[styles.badge, styles.badgeMood]}>
                  <View style={[styles.moodDot, { backgroundColor: currentMood.color }]} />
                  <Text style={styles.badgeText}>{moodScore}%</Text>
                  <Text style={styles.badgeLabel}>{currentMood.label}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* No mood yet CTA */}
        {!todayMood && (
          <GlassCard
            intensity="medium"
            padding="lg"
            style={styles.ctaCard}
            onPress={() => router.push('/mood-entry')}
          >
            <View style={styles.ctaRow}>
              <View style={styles.ctaLeft}>
                <Text style={styles.ctaTitle}>How are you feeling?</Text>
                <Text style={styles.ctaSubtitle}>
                  Log your mood to get personalized insights
                </Text>
              </View>
              <View style={styles.ctaIcon}>
                <Feather name="plus" size={24} color={Colors.accent.olive} />
              </View>
            </View>
          </GlassCard>
        )}

        {/* Mental Health Metrics */}
        <Text style={styles.sectionTitle}>Mental Health Metrics</Text>
        <View style={styles.metricsRow}>
          <MetricCard
            variant="green"
            icon="heart"
            label="Mood Score"
            value={moodScore > 0 ? `${moodScore}` : '—'}
            subtitle={moodScore >= 70 ? 'Healthy' : moodScore >= 40 ? 'Mixed' : moodScore > 0 ? 'Needs care' : 'No data yet'}
          />
          <View style={{ width: Spacing.md }} />
          <MetricCard
            variant="orange"
            icon="activity"
            label="Mood"
            value={
              currentMood ? (
                <Feather
                  name={currentMood.icon as any}
                  size={34}
                  color={Colors.text.onAccent}
                />
              ) : '—'
            }
            subtitle={currentMood ? currentMood.label : 'Not logged'}
          />
        </View>

        {/* Streak Tracker */}
        <MetricCard
          variant="brown"
          icon="zap"
          label="Streak"
          value={`${streak}`}
          subtitle={streak === 1 ? 'day' : 'days in a row'}
          style={styles.trackerCard}
        />

        {/* Mood History */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mood History</Text>
          <Pressable onPress={() => router.push('/(tabs)/insights')}>
            <Feather name="more-horizontal" size={20} color={Colors.text.secondary} />
          </Pressable>
        </View>
        {weeklyMoods.length > 0 ? (
          <GlassCard intensity="medium" padding="lg" style={styles.moodHistoryCard}>
            <WeeklyMoodRow
              days={weeklyMoods.map((d) => ({
                day: d.day,
                expression: d.expression,
                faceColor: d.faceColor,
              }))}
            />
          </GlassCard>
        ) : (
          <GlassCard intensity="subtle" padding="lg" style={styles.moodHistoryCard}>
            <Text style={styles.emptyText}>
              Complete your first mood check-in to see your weekly history
            </Text>
          </GlassCard>
        )}

        {/* Recommendation */}
        {suggestion && (
          <>
            <Text style={styles.sectionTitle}>Recommendation</Text>
            <GlassCard
              intensity="medium"
              padding="lg"
              onPress={() => {
                if (suggestion.route) router.push(suggestion.route as any);
              }}
            >
              <View style={styles.recRow}>
                <View style={[styles.recIconBg, { backgroundColor: suggestion.color + '25' }]}>
                  <Feather
                    name={suggestion.icon as any}
                    size={22}
                    color={suggestion.color}
                  />
                </View>
                <View style={styles.recContent}>
                  <Text style={styles.recTitle}>{suggestion.title}</Text>
                  <Text style={styles.recSubtitle}>{suggestion.subtitle}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.xl,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  greetingText: { flex: 1 },
  greeting: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeMood: {
    backgroundColor: 'rgba(255, 190, 106, 0.12)',
  },
  badgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.primary,
  },
  badgeLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  moodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.onAccent,
  },

  // CTA
  ctaCard: {
    marginBottom: Spacing.xxl,
    borderColor: 'rgba(190, 255, 108, 0.2)',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaLeft: { flex: 1 },
  ctaTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(190, 255, 108, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.lg,
  },

  // Sections
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  trackerCard: {
    marginBottom: Spacing.xxl,
  },
  moodHistoryCard: {
    marginBottom: Spacing.xxl,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Recommendation
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  recContent: { flex: 1 },
  recTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  recSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
});
