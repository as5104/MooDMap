/**
 * MoodMap — Home Dashboard
 */

import { GlassCard, GradientBackground, MetricCard, WeeklyMoodRow } from '@/components/ui';
import { MoodFace } from '@/components/ui/MoodFace';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { getSuggestion } from '@/constants/suggestions';
import { TAG_MAP } from '@/constants/tags';
import { Fonts, FontSizes } from '@/constants/typography';
import { getJournalCount, getLatestJournal, type JournalEntryRow } from '@/services/journalService';
import {
  getMoodCount,
  getMoodScoreForPeriod,
  getMoodStreak,
  getMoodSummary,
  getTodayMood,
  getTopMoods,
  getWeeklyMoods,
  formatMoodNote,
  type DayMoodData,
  type MoodSummaryData,
  type TopMoodItem,
} from '@/services/moodService';
import { useAppStore } from '@/stores/appStore';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

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
  const [latestJournal, setLatestJournal] = useState<JournalEntryRow | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [summary, setSummary] = useState<MoodSummaryData | null>(null);
  const [topMoods, setTopMoods] = useState<TopMoodItem[]>([]);

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
      const score = getMoodScoreForPeriod(userId, 7);
      const streakData = getMoodStreak(userId);
      const journal = getLatestJournal(userId);
      const jCount = getJournalCount(userId);
      const mCount = getMoodCount(userId);
      const summaryData = getMoodSummary(userId, 7);
      const topMoodsData = getTopMoods(userId, 7, 3);

      if (todayEntry) {
        setTodayMood({
          id: todayEntry.id,
          moodType: todayEntry.mood_type as MoodType,
          moodScore: todayEntry.mood_score,
          energyLevel: todayEntry.energy_level ?? undefined,
          stressLevel: todayEntry.stress_level ?? undefined,
          sleepHours: todayEntry.sleep_hours ?? undefined,
          sleepQuality: todayEntry.sleep_quality ?? undefined,
          tags: todayEntry.tags ? JSON.parse(todayEntry.tags) : undefined,
          note: todayEntry.note ?? undefined,
          date: todayEntry.date,
        });
      } else {
        setTodayMood(null);
      }

      setWeeklyMoods(weekly);
      setMoodScore(score);
      setStreak(streakData.current);
      setLatestJournal(journal);
      setJournalCount(jCount);
      setSummary(summaryData);
      setTopMoods(topMoodsData);

      // Dynamically calculate and update total XP in store
      const computedXP = (mCount * 25) + (jCount * 15);
      useAppStore.getState().setTotalXP(computedXP);
    } catch (e) {
      console.error('[Home] Load error:', e);
    }
  }, [user?.id, isAppReady]);

  // Reload on focus and when dataVersion changes
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData, dataVersion, isAppReady])
  );

  const currentMood = todayMood ? MOOD_MAP[todayMood.moodType] : null;
  const suggestion = todayMood ? getSuggestion(todayMood.moodType, todayMood.stressLevel) : null;

  // Quick insight data
  const insightInfo = useMemo(() => {
    if (!summary || !summary.dominantMood) return null;
    const moodDef = MOOD_MAP[summary.dominantMood];
    const icon = summary.trendDirection === 'improving' ? 'trending-up' : summary.trendDirection === 'declining' ? 'trending-down' : 'minus';
    const color = summary.trendDirection === 'improving' ? Colors.accent.primary : summary.trendDirection === 'declining' ? Colors.accent.coral : Colors.accent.amber;
    return {
      moodLabel: moodDef?.label ?? summary.dominantMood,
      icon,
      color,
    };
  }, [summary]);

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

        {/* Greeting + Badges + Avatar */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}!</Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Feather name="star" size={12} color={Colors.accent.primary} />
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
          <Pressable
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* No mood CTA */}
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
                <Feather name="plus" size={24} color={Colors.accent.primary} />
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
                  size={42}
                  color={Colors.text.onAccent}
                />
              ) : '—'
            }
            subtitle={currentMood ? currentMood.label : 'Not logged'}
          />
        </View>

        {/* Streak Card */}
        <MetricCard
          variant="brown"
          icon="zap"
          label="Streak"
          value={`${streak}`}
          subtitle={streak === 1 ? 'day' : 'days in a row'}
          style={styles.streakCard}
        />

        {/* Today's Mood Detail */}
        {todayMood && currentMood && (
          <GlassCard intensity="medium" padding="lg" style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <View style={styles.todayHeaderLeft}>
                <View style={[styles.glowingDot, { backgroundColor: currentMood.color }]} />
                <Text style={styles.todayLabel}>Today&apos;s Check-in</Text>
              </View>
              <Pressable
                style={styles.todayEditBtnPremium}
                onPress={() => router.push('/mood-entry')}
                hitSlop={8}
              >
                <Feather name="edit-3" size={12} color={Colors.text.secondary} />
                <Text style={styles.todayEditBtnText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.todayMainRow}>
              <View style={[styles.todayFaceContainer, { borderColor: `${currentMood.color}40` }]}>
                <View style={[styles.todayFaceBackground, { backgroundColor: `${currentMood.color}15` }]}>
                  <MoodFace
                    expression={currentMood.expression}
                    size="sm"
                    bgColor="transparent"
                    faceColor={currentMood.faceColor}
                  />
                </View>
              </View>
              
              <View style={styles.todayMoodDetails}>
                <Text style={[styles.todayMoodLabelPremium, { color: currentMood.color }]}>
                  {currentMood.label}
                </Text>
                <Text style={styles.todayTimeSubtitle}>
                  Mood Score: {Math.round((todayMood.moodScore / 10) * 100)}%
                </Text>
              </View>

              <View style={[styles.todayScoreCapsule, { backgroundColor: `${currentMood.color}20`, borderColor: `${currentMood.color}35` }]}>
                <Text style={[styles.todayScoreCapsuleText, { color: currentMood.color }]}>
                  {todayMood.moodScore}/10
                </Text>
              </View>
            </View>

            {/* Metrics Row (Energy, Stress, Sleep) */}
            <View style={styles.todayMetricsRow}>
              <View style={styles.todayMetricCol}>
                <View style={styles.todayMetricHeader}>
                  <Feather name="zap" size={13} color={Colors.accent.primary} />
                  <Text style={styles.todayMetricTitle}>Energy</Text>
                </View>
                <Text style={styles.todayMetricValue}>
                  {todayMood.energyLevel != null ? `${todayMood.energyLevel}/5` : '—'}
                </Text>
              </View>

              <View style={styles.todayMetricDivider} />

              <View style={styles.todayMetricCol}>
                <View style={styles.todayMetricHeader}>
                  <Feather name="activity" size={13} color={Colors.accent.coral} />
                  <Text style={styles.todayMetricTitle}>Stress</Text>
                </View>
                <Text style={styles.todayMetricValue}>
                  {todayMood.stressLevel != null ? `${todayMood.stressLevel}/5` : '—'}
                </Text>
              </View>

              <View style={styles.todayMetricDivider} />

              <View style={styles.todayMetricCol}>
                <View style={styles.todayMetricHeader}>
                  <Feather name="moon" size={13} color={Colors.accent.lavender} />
                  <Text style={styles.todayMetricTitle}>Sleep</Text>
                </View>
                <Text style={styles.todayMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                  {todayMood.sleepHours != null 
                    ? `${todayMood.sleepHours}h${todayMood.sleepQuality != null ? ` (${todayMood.sleepQuality}/5)` : ''}` 
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Tags */}
            {todayMood.tags && todayMood.tags.length > 0 && (
              <View style={styles.todayTagsPremium}>
                {todayMood.tags.slice(0, 5).map((tag) => {
                  const tagDef = TAG_MAP[tag];
                  return (
                    <View key={tag} style={styles.todayTagChipPremium}>
                      {tagDef?.icon && (
                        <Feather name={tagDef.icon as any} size={10} color={Colors.text.secondary} />
                      )}
                      <Text style={styles.todayTagTextPremium}>{tagDef?.label ?? tag}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Daily Focus / Note */}
            {todayMood.note && (
              <View style={[styles.todayNoteContainer, { borderLeftColor: currentMood.color }]}>
                <View style={styles.todayNoteHeader}>
                  <Feather name="edit-3" size={12} color={Colors.text.tertiary} style={styles.todayNoteIcon} />
                  <Text style={styles.todayNoteTitle}>Daily Focus</Text>
                </View>
                <Text style={styles.todayNoteText}>
                  {formatMoodNote(todayMood.note)}
                </Text>
              </View>
            )}
          </GlassCard>
        )}

        {/* Quick Insight */}
        {insightInfo && (
          <GlassCard
            intensity="subtle"
            padding="md"
            style={styles.insightCard}
            onPress={() => router.push('/(tabs)/insights')}
          >
            <View style={styles.insightRow}>
              <View style={styles.insightIconBg}>
                <Feather name="trending-up" size={16} color={Colors.accent.lavender} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightText}>
                  Your week has been mostly {insightInfo.moodLabel}{' '}
                  <Feather name={insightInfo.icon as any} size={14} color={insightInfo.color} />
                </Text>
                {topMoods.length > 0 && (
                  <View style={styles.insightMoods}>
                    {topMoods.map((m) => {
                      const mood = MOOD_MAP[m.moodType];
                      return (
                        <View key={m.moodType} style={styles.insightMoodChip}>
                          <View style={[styles.insightMoodDot, { backgroundColor: mood?.color }]} />
                          <Text style={styles.insightMoodText}>{mood?.label} {m.percentage}%</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
              <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
            </View>
          </GlassCard>
        )}

        {/* Mood History */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <Feather name="bar-chart-2" size={15} color={Colors.accent.primary} />
            <Text style={styles.sectionTitleInline}>Mood History</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/insights')} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {weeklyMoods.length > 0 ? (
          <GlassCard intensity="medium" padding="lg" style={styles.moodHistoryCard}>
            <WeeklyMoodRow
              days={weeklyMoods.map((d) => ({
                day: d.day,
                expression: d.expression,
                faceColor: d.faceColor,
                moodScore: d.moodScore,
              }))}
            />
          </GlassCard>
        ) : (
          <GlassCard intensity="subtle" padding="lg" style={styles.moodHistoryCard}>
            <View style={styles.emptySection}>
              <Feather name="bar-chart-2" size={24} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>
                Complete your first mood check-in to see your weekly history
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Recommendation */}
        {suggestion && (
          <>
            <View style={styles.sectionRow}>
              <View style={styles.sectionTitleRow}>
                <Feather name="star" size={15} color={Colors.accent.amber} />
                <Text style={styles.sectionTitleInline}>Recommended</Text>
              </View>
            </View>
            <GlassCard
              intensity="medium"
              padding="lg"
              style={styles.recCard}
              onPress={() => {
                if (suggestion.route) router.push(suggestion.route as any);
              }}
            >
              <View style={styles.recRow}>
                <View style={[styles.recIconBg, { backgroundColor: suggestion.color + '18' }]}>
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

        {/* Recent Journal */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <Feather name="book-open" size={15} color={Colors.accent.lavender} />
            <Text style={styles.sectionTitleInline}>Recent Journal</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/journal')} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {latestJournal ? (
          <GlassCard
            intensity="medium"
            padding="lg"
            style={styles.journalCard}
            onPress={() => router.push('/(tabs)/journal')}
          >
            <View style={styles.journalRow}>
              <View style={styles.journalIconBg}>
                <Feather name="edit-3" size={18} color={Colors.accent.primary} />
              </View>
              <View style={styles.journalContent}>
                <Text style={styles.journalTitle} numberOfLines={1}>
                  {latestJournal.title || 'Untitled'}
                </Text>
                <Text style={styles.journalPreview} numberOfLines={1}>
                  {latestJournal.content.slice(0, 80)}
                </Text>
                <View style={styles.journalMeta}>
                  <View style={styles.journalMetaChip}>
                    <Feather name="clock" size={10} color={Colors.text.tertiary} />
                    <Text style={styles.journalDate}>
                      {new Date(latestJournal.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.journalMetaChip}>
                    <Feather name="type" size={10} color={Colors.text.tertiary} />
                    <Text style={styles.journalWords}>
                      {latestJournal.content.trim().split(/\s+/).length} words
                    </Text>
                  </View>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard
            intensity="subtle"
            padding="lg"
            style={styles.journalCard}
            onPress={() => router.push('/journal-editor')}
          >
            <View style={styles.emptySection}>
              <Feather name="edit-3" size={24} color={Colors.accent.primary} />
              <Text style={styles.emptyTitle}>Start journaling</Text>
              <Text style={styles.emptyText}>
                Write about your day to track your growth
              </Text>
            </View>
          </GlassCard>
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

  // Header
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
    backgroundColor: Colors.accent.primary,
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

  // Metrics
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  sectionTitleInline: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  streakCard: {
    marginBottom: Spacing.xxl,
  },

  // Today's Check-in
  todayCard: {
    marginBottom: Spacing.xl,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  todayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  glowingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todayEditBtnPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.md,
  },
  todayEditBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  todayMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  todayFaceContainer: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 2,
    marginRight: Spacing.md,
  },
  todayFaceBackground: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayMoodDetails: {
    flex: 1,
  },
  todayMoodLabelPremium: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    fontWeight: '700',
  },
  todayTimeSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  todayScoreCapsule: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  todayScoreCapsuleText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    fontWeight: '600',
  },
  todayMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  todayMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  todayMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  todayMetricTitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  todayMetricValue: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
  },
  todayMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  todayTagsPremium: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  todayTagChipPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  todayTagTextPremium: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  todayNoteContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 3,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  todayNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  todayNoteIcon: {
    marginRight: 6,
  },
  todayNoteTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayNoteText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    lineHeight: 18,
  },

  // Quick Insight
  insightCard: {
    marginBottom: Spacing.xl,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.accent.lavenderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  insightMoods: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  insightMoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightMoodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  insightMoodText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },

  // Sections
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  seeAll: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },
  moodHistoryCard: {
    marginBottom: Spacing.xl,
  },

  // Recommendation
  recCard: {
    marginBottom: Spacing.lg,
  },
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

  // Recent Journal
  journalCard: {
    marginBottom: Spacing.md,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  journalIconBg: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  journalContent: { flex: 1 },
  journalTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  journalPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  journalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  journalMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  journalDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },
  journalWords: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },

  // Empty States
  emptySection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 240,
  },
});
