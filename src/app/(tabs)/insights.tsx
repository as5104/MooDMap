/**
 * MoodMap — Insights & Analytics
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, WeeklyMoodRow } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { TAG_MAP } from '@/constants/tags';
import { useAppStore } from '@/stores/appStore';
import {
  getMoodScoreForPeriod,
  getWeeklyMoods,
  getMoodStats,
  getMoodHistory,
  getMonthlyBarData,
  getTopMoods,
  getTagFrequency,
  getMoodCalendarData,
  getMoodSummary,
  getAvgEnergyStress,
  type DayMoodData,
  type MoodEntryRow,
  type MoodStatsData,
  type TopMoodItem,
  type TagFrequencyItem,
  type MoodCalendarItem,
  type MoodSummaryData,
  type EnergyStressData,
} from '@/services/moodService';

const GAP = Spacing.md;

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 365 },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Mood Calendar

function MoodCalendar({ data, year, month }: { data: MoodCalendarItem[]; year: number; month: number }) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const dataMap = useMemo(() => {
    const m = new Map<string, MoodCalendarItem>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<View key={`e-${i}`} style={calS.cell} />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = dataMap.get(dateStr);
    const moodColor = entry ? (Colors.mood[entry.moodType] || Colors.text.tertiary) : undefined;
    const isToday = dateStr === new Date().toISOString().split('T')[0];

    cells.push(
      <View key={dateStr} style={calS.cell}>
        <View style={[calS.dayCircle, entry && { backgroundColor: moodColor + '25' }, isToday && !entry && calS.todayRing]}>
          {entry && <View style={[calS.moodDot, { backgroundColor: moodColor }]} />}
          <Text style={[calS.dayText, entry && { color: moodColor }, isToday && { color: Colors.accent.primary }]}>{day}</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={calS.monthLabel}>{monthLabel}</Text>
      <View style={calS.weekRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <View key={i} style={calS.cell}><Text style={calS.weekText}>{d}</Text></View>
        ))}
      </View>
      <View style={calS.grid}>{cells}</View>
    </View>
  );
}

// Main Screen

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);

  const [activePeriod, setActivePeriod] = useState(0);
  const [renderedPeriod, setRenderedPeriod] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const translateX = useMemo(() => {
    const tabWidth = containerWidth > 0 ? (containerWidth - 6) / 4 : 0;
    return tabAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3],
    });
  }, [containerWidth]);

  const [moodScore, setMoodScoreLocal] = useState(0);
  const [weeklyMoods, setWeeklyMoods] = useState<DayMoodData[]>([]);
  const [stats, setStats] = useState<MoodStatsData>({ positive: 0, negative: 0, neutral: 0, total: 0 });
  const [history, setHistory] = useState<MoodEntryRow[]>([]);
  const [barData, setBarData] = useState<{ positive: number; negative: number }[]>([]);
  const [topMoods, setTopMoods] = useState<TopMoodItem[]>([]);
  const [tagFreq, setTagFreq] = useState<TagFrequencyItem[]>([]);
  const [calendarData, setCalendarData] = useState<MoodCalendarItem[]>([]);
  const [summary, setSummary] = useState<MoodSummaryData | null>(null);
  const [energyStress, setEnergyStress] = useState<EnergyStressData | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const loadDataForPeriod = useCallback((targetPeriodIndex: number) => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const targetDays = PERIODS[targetPeriodIndex].days;

      // Query database
      const score = getMoodScoreForPeriod(userId, targetDays);
      const weekly = getWeeklyMoods(userId);
      const st = getMoodStats(userId, targetDays);
      const hist = getMoodHistory(userId, 6);
      const bar = getMonthlyBarData(userId, targetDays);
      const top = getTopMoods(userId, targetDays, 5);
      const tags = getTagFrequency(userId, targetDays, 8);
      const cal = getMoodCalendarData(userId, calYear, calMonth);
      const summ = getMoodSummary(userId, targetDays);
      const energy = getAvgEnergyStress(userId, targetDays);

      // Consolidate updates to run in a single React render batch
      setMoodScoreLocal(score);
      setWeeklyMoods(weekly);
      setStats(st);
      setHistory(hist);
      setBarData(bar);
      setTopMoods(top);
      setTagFreq(tags);
      setCalendarData(cal);
      setSummary(summ);
      setEnergyStress(energy);

      setRenderedPeriod(targetPeriodIndex);
    } catch (e) {
      console.error('[Insights] Load error:', e);
    }
  }, [user?.id, calYear, calMonth, isAppReady]);

  // Keep refs of activePeriod and loadDataForPeriod to avoid stale closures in effects
  const activePeriodRef = useRef(activePeriod);
  useEffect(() => {
    activePeriodRef.current = activePeriod;
  }, [activePeriod]);

  const loadDataRef = useRef(loadDataForPeriod);
  useEffect(() => {
    loadDataRef.current = loadDataForPeriod;
  }, [loadDataForPeriod]);

  // Handle period change transition
  const isFirstTransition = useRef(true);
  useEffect(() => {
    // 1. Snappy, smooth spring tab slide transition
    Animated.spring(tabAnim, {
      toValue: activePeriod,
      damping: 24,
      stiffness: 170,
      useNativeDriver: true,
    }).start();

    if (isFirstTransition.current) {
      isFirstTransition.current = false;
      // Just set the rendered period immediately on mount without fade animation
      setRenderedPeriod(activePeriod);
      return;
    }

    // 2. Soft fade transition
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 120, // slightly longer fade out to cover the slide start
      useNativeDriver: true,
    }).start(() => {
      // Small timeout to allow fade-out rendering to settle
      setTimeout(() => {
        loadDataRef.current(activePeriod);
        
        requestAnimationFrame(() => {
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 220, // smooth fade back in
            useNativeDriver: true,
          }).start();
        });
      }, 30);
    });
  }, [activePeriod]);

  // Load current data on data updates, database ready, or calendar navigation
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadDataForPeriod(activePeriodRef.current);
  }, [dataVersion, calYear, calMonth, isAppReady]);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadDataRef.current(activePeriodRef.current);
    }, [])
  );

  const hasData = stats.total > 0;

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const isCurrentMonth = calYear === new Date().getFullYear() && calMonth === new Date().getMonth();

  // Dominant mood helper
  const dominantMoodDef = useMemo(() => {
    if (!summary?.dominantMood) return null;
    return MOOD_MAP[summary.dominantMood];
  }, [summary?.dominantMood]);

  const trendInfo = useMemo(() => {
    if (!summary) return { icon: 'minus', color: Colors.accent.amber, label: 'Stable' };
    const icon = summary.trendDirection === 'improving' ? 'trending-up' : summary.trendDirection === 'declining' ? 'trending-down' : 'minus';
    const color = summary.trendDirection === 'improving' ? Colors.accent.primary : summary.trendDirection === 'declining' ? Colors.accent.coral : Colors.accent.amber;
    const label = summary.trendDirection.charAt(0).toUpperCase() + summary.trendDirection.slice(1);
    return { icon, color, label };
  }, [summary]);

  // Score color
  const scoreColor = moodScore >= 70 ? Colors.accent.primary : moodScore >= 40 ? Colors.accent.amber : Colors.accent.coral;

  return (
    <GradientBackground>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={s.title}>Insights</Text>
        <Text style={s.subtitle}>{hasData ? 'Your mood analytics at a glance' : 'Start logging moods to see insights'}</Text>

        {/* Period Tabs */}
        <View style={s.periodRow} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
          {containerWidth > 0 && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                s.periodTabActiveAnimated,
                {
                  width: containerWidth > 0 ? (containerWidth - 6) / 4 : 0,
                  left: 3,
                  top: 3,
                  bottom: 3,
                  transform: [{ translateX }],
                }
              ]}
            />
          )}
          {PERIODS.map((p, i) => (
            <Pressable key={p.label} onPress={() => setActivePeriod(i)} style={s.periodTab}>
              <Text style={[s.periodText, activePeriod === i && s.periodTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <Animated.View style={{ opacity: contentOpacity, flex: 1 }}>

        {/* ROW 1: Mood Score & Trend Direction (Full Width Box) */}
        <GlassCard intensity="medium" padding="lg" style={s.fullCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left Column: Mood Score */}
            <View style={s.flex1}>
              <View style={s.scoreIconRow}>
                <View style={[s.iconBg, { backgroundColor: scoreColor + '18' }]}>
                  <Feather name="heart" size={16} color={scoreColor} />
                </View>
              </View>
              <Text style={[s.scoreValue, { color: Colors.text.primary }]}>
                {hasData ? moodScore : '—'}
              </Text>
              <Text style={s.scoreLabel}>Mood Score</Text>
              <Text style={[s.scoreHint, { textAlign: 'left', marginTop: Spacing.sm }]}>
                {!hasData ? 'No data' : moodScore >= 70 ? 'Doing great!' : moodScore >= 40 ? 'Overall balanced' : 'Needs self-care'}
              </Text>
            </View>

            {/* Vertical Divider Line */}
            <View style={{ width: 1, height: '75%', backgroundColor: 'rgba(255, 255, 255, 0.08)', marginHorizontal: Spacing.xl }} />

            {/* Right Column: Trend Direction */}
            <View style={s.flex1}>
              <View style={s.scoreIconRow}>
                <View style={[s.iconBg, { backgroundColor: (summary?.trendDirection === 'improving' ? Colors.accent.primary : summary?.trendDirection === 'declining' ? Colors.accent.coral : Colors.accent.amber) + '18' }]}>
                  <Feather name={summary?.trendDirection === 'improving' ? 'arrow-up-right' : summary?.trendDirection === 'declining' ? 'arrow-down-right' : 'minus'} size={16} color={summary?.trendDirection === 'improving' ? Colors.accent.primary : summary?.trendDirection === 'declining' ? Colors.accent.coral : Colors.accent.amber} />
                </View>
              </View>
              <Text
                style={[
                  s.trendValText,
                  { color: summary?.trendDirection === 'improving' ? Colors.accent.primary : summary?.trendDirection === 'declining' ? Colors.accent.coral : Colors.accent.amber }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {summary?.trendDirection === 'improving' ? 'Improving' : summary?.trendDirection === 'declining' ? 'Declining' : 'Stable'}
              </Text>
              <Text style={s.scoreLabel}>Trend Direction</Text>
              <Text style={[s.scoreHint, { textAlign: 'left', marginTop: Spacing.sm }]}>
                Overall direction
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* ROW 2: Total Entries (30% width) + Avg Score (70% width) */}
        <View style={s.bentoRow}>
          {/* Total Entries (30%) */}
          <GlassCard intensity="medium" padding="md" style={[s.flex3, { justifyContent: 'center' }]}>
            <View style={[s.iconBg, { backgroundColor: Colors.accent.lavender + '18', marginBottom: Spacing.xs, alignSelf: 'center' }]}>
              <Feather name="bar-chart-2" size={16} color={Colors.accent.lavender} />
            </View>
            <Text style={[s.scoreValue, { color: Colors.text.primary, textAlign: 'center', fontSize: 44, lineHeight: 50 }]}>
              {summary?.totalEntries ?? 0}
            </Text>
            <Text style={[s.scoreLabel, { textAlign: 'center', marginTop: 2 }]} numberOfLines={1}>Total Entries</Text>
            <Text style={[s.scoreHint, { textAlign: 'center', marginTop: 4 }]} numberOfLines={1}>Logs</Text>
          </GlassCard>

          {/* Avg Score (70%) */}
          <GlassCard intensity="medium" padding="lg" style={s.flex7}>
            <View style={s.scoreIconRow}>
              <View style={[s.iconBg, { backgroundColor: Colors.accent.amber + '18' }]}>
                <Feather name="trending-up" size={16} color={Colors.accent.amber} />
              </View>
            </View>
            <Text style={[s.scoreValue, { color: Colors.text.primary }]}>
              {summary?.avgScore ? summary.avgScore.toFixed(1) : '—'}
            </Text>
            <Text style={s.scoreLabel}>Avg Score</Text>
            <Text style={[s.scoreHint, { textAlign: 'left', marginTop: Spacing.sm }]} numberOfLines={1}>
              Scale out of 10
            </Text>
          </GlassCard>
        </View>

        {/* ROW 3: Weekly Faces (full width, 7D only) */}
        {renderedPeriod === 0 && weeklyMoods.length > 0 && (
          <GlassCard intensity="medium" padding="lg" style={s.fullCard}>
            <View style={s.cardHeader}>
              <Feather name="smile" size={14} color={Colors.accent.primary} />
              <Text style={s.cardTitle}>This Week</Text>
            </View>
            <WeeklyMoodRow days={weeklyMoods.map((d) => ({ day: d.day, expression: d.expression, faceColor: d.faceColor }))} />
          </GlassCard>
        )}

        {/* ROW 4: Weekly Summary (60% width) + Distribution (40% width) */}
        {hasData && (
          <View style={s.bentoRow}>
            {/* Weekly Summary (60%) */}
            <GlassCard intensity="subtle" padding="lg" style={s.flex6}>
              <View style={s.cardHeader}>
                <Feather name="message-circle" size={14} color={Colors.accent.lavender} />
                <Text style={s.cardTitle}>Weekly Summary</Text>
              </View>
              {summary && summary.dominantMood ? (
                <View style={s.summaryList}>
                  {/* Dominant Mood Row */}
                  <View style={s.summaryRow}>
                    <Feather name="smile" size={13} color={Colors.text.tertiary} style={s.summaryRowIcon} />
                    <Text style={s.summaryRowLabel}>Dominant mood</Text>
                    <View style={s.summaryValueContainer}>
                      {dominantMoodDef && (
                        <View style={[s.summaryDot, { backgroundColor: dominantMoodDef.color }]} />
                      )}
                      <Text style={s.summaryRowVal}>{dominantMoodDef?.label ?? summary.dominantMood}</Text>
                    </View>
                  </View>

                  {/* Trend Row */}
                  <View style={s.summaryRow}>
                    <Feather name={trendInfo.icon as any} size={13} color={trendInfo.color} style={s.summaryRowIcon} />
                    <Text style={s.summaryRowLabel}>Trend</Text>
                    <Text style={[s.summaryRowVal, { color: trendInfo.color, fontFamily: Fonts.bodySemiBold }]}>
                      {trendInfo.label}
                    </Text>
                  </View>

                  {/* Best Day Row */}
                  {summary.bestDay && (
                    <View style={s.summaryRow}>
                      <Feather name="star" size={13} color={Colors.accent.amber} style={s.summaryRowIcon} />
                      <Text style={s.summaryRowLabel}>Best Day</Text>
                      <Text style={s.summaryRowVal}>
                        {new Date(summary.bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  )}

                  {/* Top Trigger Row */}
                  {summary.topTrigger && (
                    <View style={s.summaryRow}>
                      <Feather name="tag" size={13} color={Colors.accent.lavender} style={s.summaryRowIcon} />
                      <Text style={s.summaryRowLabel}>Top Trigger</Text>
                      <Text style={s.summaryRowVal}>
                        {TAG_MAP[summary.topTrigger]?.label ?? summary.topTrigger}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={s.narrativeText}>Log more moods to view weekly summary.</Text>
              )}
            </GlassCard>

            {/* Distribution (40%) */}
            <GlassCard intensity="medium" padding="lg" style={s.flex4}>
              <View style={s.cardHeader}>
                <Feather name="pie-chart" size={13} color={Colors.accent.primary} />
                <Text style={s.cardTitleSm}>Distribution</Text>
              </View>
              <View style={s.distRow}>
                <View style={[s.distDot, { backgroundColor: Colors.accent.primary }]} />
                <Text style={s.distLabel}>Positive</Text>
                <Text style={s.distValue}>{stats.positive}</Text>
              </View>
              <View style={s.distRow}>
                <View style={[s.distDot, { backgroundColor: Colors.accent.amber }]} />
                <Text style={s.distLabel}>Neutral</Text>
                <Text style={s.distValue}>{stats.neutral}</Text>
              </View>
              <View style={s.distRow}>
                <View style={[s.distDot, { backgroundColor: Colors.accent.coral }]} />
                <Text style={s.distLabel}>Negative</Text>
                <Text style={s.distValue}>{stats.negative}</Text>
              </View>
              <View style={s.stackedBar}>
                {stats.total > 0 && (
                  <>
                    <View style={[s.stackedSeg, { flex: stats.positive, backgroundColor: Colors.accent.primary, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
                    <View style={[s.stackedSeg, { flex: Math.max(stats.neutral, 0.01), backgroundColor: Colors.accent.amber }]} />
                    <View style={[s.stackedSeg, { flex: stats.negative, backgroundColor: Colors.accent.coral, borderTopRightRadius: 4, borderBottomRightRadius: 4 }]} />
                  </>
                )}
              </View>
            </GlassCard>
          </View>
        )}

        {/* ROW 5: Mood Trend Chart (full width) */}
        {hasData && barData.length > 0 && (
          <GlassCard intensity="subtle" padding="lg" style={s.fullCard}>
            <View style={s.cardHeader}>
              <Feather name="bar-chart-2" size={14} color={Colors.accent.primary} />
              <Text style={s.cardTitle}>Mood Trend</Text>
            </View>
            <View style={s.barChart}>
              {barData.map((bar, i) => (
                <View key={i} style={s.barGroup}>
                  <View style={s.barContainer}>
                    <View style={[s.barPos, { height: `${Math.max(bar.positive * 100, 4)}%` }]} />
                    <View style={[s.barNeg, { height: `${Math.max(bar.negative * 100, 4)}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <View style={s.barLegend}>
              <View style={s.barLegendItem}><View style={[s.barLegendDot, { backgroundColor: Colors.accent.primary }]} /><Text style={s.barLegendText}>Positive</Text></View>
              <View style={s.barLegendItem}><View style={[s.barLegendDot, { backgroundColor: Colors.accent.coral }]} /><Text style={s.barLegendText}>Negative</Text></View>
            </View>
          </GlassCard>
        )}

        {/* ROW 6: Top Triggers (55% width) + Energy/Stress stacked (45% width) */}
        {hasData && (
          <View style={s.bentoRow}>
            {/* LEFT — Trigger tags (55%) */}
            <GlassCard intensity="medium" padding="lg" style={s.flex55}>
              <View style={s.cardHeader}>
                <Feather name="hash" size={13} color={Colors.accent.lavender} />
                <Text style={s.cardTitleSm}>Top Triggers</Text>
              </View>
              {tagFreq.length > 0 ? (
                <View style={s.triggerWrap}>
                  {tagFreq.slice(0, 8).map((item) => {
                    const tagDef = TAG_MAP[item.tag];
                    const chipColor = item.avgScore >= 7 ? Colors.accent.primary : item.avgScore >= 5 ? Colors.accent.amber : Colors.accent.coral;
                    return (
                      <View key={item.tag} style={s.triggerChip}>
                        <Feather name={(tagDef?.icon ?? 'tag') as any} size={11} color={Colors.text.secondary} />
                        <Text style={s.triggerText} numberOfLines={1}>{tagDef?.label ?? item.tag}</Text>
                        <Text style={[s.triggerCount, { color: chipColor }]}>{item.count}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={s.emptyMini}>No tags recorded yet</Text>
              )}
            </GlassCard>

            {/* RIGHT — Energy & Stress stacked up and down (45%) */}
            <View style={[s.flex45, s.bentoCol]}>
              <GlassCard intensity="medium" padding="md" style={s.energyStressCard}>
                <View style={s.energyStressHeader}>
                  <View style={[s.iconBg, { backgroundColor: Colors.accent.primaryMuted, width: 22, height: 22, borderRadius: 6, marginBottom: 0 }]}>
                    <Feather name="zap" size={11} color={Colors.accent.primary} />
                  </View>
                  <Text style={s.energyStressLabel}>Energy</Text>
                  <Text style={[s.energyStressValue, { color: Colors.accent.primary }]}>
                    {energyStress && energyStress.avgEnergy > 0 ? energyStress.avgEnergy.toFixed(1) : '—'}
                  </Text>
                </View>
                {energyStress && energyStress.avgEnergy > 0 && (
                  <View style={s.energyStressGauge}>
                    <View style={[s.gaugeFill, { width: `${(energyStress.avgEnergy / 5) * 100}%`, backgroundColor: Colors.accent.primary }]} />
                  </View>
                )}
              </GlassCard>

              <GlassCard intensity="medium" padding="md" style={s.energyStressCard}>
                <View style={s.energyStressHeader}>
                  <View style={[s.iconBg, { backgroundColor: Colors.accent.coralMuted, width: 22, height: 22, borderRadius: 6, marginBottom: 0 }]}>
                    <Feather name="alert-circle" size={11} color={Colors.accent.coral} />
                  </View>
                  <Text style={s.energyStressLabel}>Stress</Text>
                  <Text style={[s.energyStressValue, { color: Colors.accent.coral }]}>
                    {energyStress && energyStress.avgStress > 0 ? energyStress.avgStress.toFixed(1) : '—'}
                  </Text>
                </View>
                {energyStress && energyStress.avgStress > 0 && (
                  <View style={s.energyStressGauge}>
                    <View style={[s.gaugeFill, { width: `${(energyStress.avgStress / 5) * 100}%`, backgroundColor: Colors.accent.coral }]} />
                  </View>
                )}
              </GlassCard>
            </View>
          </View>
        )}

        {/* ROW 7: Top Emotions (full width) */}
        {hasData && (
          <GlassCard intensity="medium" padding="lg" style={s.fullCard}>
            <View style={s.cardHeader}>
              <Feather name="trending-up" size={13} color={Colors.accent.primary} />
              <Text style={s.cardTitle}>Top Emotions</Text>
            </View>
            {topMoods.slice(0, 4).map((item) => {
              const mood = MOOD_MAP[item.moodType];
              const barW = topMoods[0]?.count ? Math.max((item.count / topMoods[0].count) * 100, 15) : 15;
              return (
                <View key={item.moodType} style={s.emotionRow}>
                  <View style={[s.emotionDot, { backgroundColor: mood?.color }]} />
                  <Text style={s.emotionLabel} numberOfLines={1}>{mood?.label ?? item.moodType}</Text>
                  <View style={s.emotionBarTrack}>
                    <View style={[s.emotionBarFill, { width: `${barW}%`, backgroundColor: mood?.color || Colors.text.tertiary }]} />
                  </View>
                  <Text style={s.emotionPct}>{item.percentage}%</Text>
                </View>
              );
            })}
          </GlassCard>
        )}

        {/* ROW 8: Mood Calendar (full width) */}
        {hasData && (
          <GlassCard intensity="medium" padding="lg" style={s.fullCard}>
            <View style={s.cardHeaderSpread}>
              <View style={s.cardHeader}>
                <Feather name="calendar" size={14} color={Colors.accent.amber} />
                <Text style={s.cardTitle}>Mood Calendar</Text>
              </View>
              <View style={s.calNav}>
                <Pressable onPress={prevMonth} style={s.calBtn} hitSlop={8}>
                  <Feather name="chevron-left" size={16} color={Colors.text.secondary} />
                </Pressable>
                <Pressable onPress={nextMonth} style={[s.calBtn, isCurrentMonth && { opacity: 0.3 }]} disabled={isCurrentMonth} hitSlop={8}>
                  <Feather name="chevron-right" size={16} color={Colors.text.secondary} />
                </Pressable>
              </View>
            </View>
            <MoodCalendar data={calendarData} year={calYear} month={calMonth} />
          </GlassCard>
        )}

        {/* ROW 8: Recent Entries (full width) */}
        {history.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Feather name="clock" size={14} color={Colors.text.secondary} />
              <Text style={s.sectionTitle}>Recent Entries</Text>
            </View>
            {history.map((entry) => {
              const mood = MOOD_MAP[entry.mood_type as MoodType];
              const dateLabel = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const moodColor = mood?.color ?? Colors.text.tertiary;
              return (
                <GlassCard key={entry.id} intensity="medium" padding="md" style={s.historyCard}>
                  <View style={s.historyRow}>
                    <View style={[s.historyBar, { backgroundColor: moodColor }]} />
                    <View style={s.historyMid}>
                      <View style={s.historyTop}>
                        {mood && <Feather name={mood.icon as any} size={13} color={moodColor} />}
                        <Text style={s.historyLabel}>{mood?.label ?? entry.mood_type}</Text>
                        <Text style={s.historyDate}>{dateLabel}</Text>
                      </View>
                      <Text style={s.historyNote} numberOfLines={1}>{entry.note ? entry.note.slice(0, 60) : `Score: ${entry.mood_score}/10`}</Text>
                    </View>
                    <View style={[s.historyBadge, { borderColor: entry.mood_score >= 7 ? Colors.accent.primary : entry.mood_score >= 5 ? Colors.accent.amber : Colors.accent.coral }]}>
                      <Text style={[s.historyBadgeText, { color: entry.mood_score >= 7 ? Colors.accent.primary : entry.mood_score >= 5 ? Colors.accent.amber : Colors.accent.coral }]}>
                        {Math.round((entry.mood_score / 10) * 100)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* Empty State */}
        {!hasData && (
          <GlassCard intensity="subtle" padding="lg" style={s.emptyCard}>
            <View style={s.emptyIcon}><Feather name="bar-chart-2" size={40} color={Colors.text.tertiary} /></View>
            <Text style={s.emptyTitle}>No mood data yet</Text>
            <Text style={s.emptySub}>Start logging your mood daily to unlock powerful insights about your emotional patterns</Text>
          </GlassCard>
        )}
        </Animated.View>
      </ScrollView>
    </GradientBackground>
  );
}

// Calendar Styles

const calS = StyleSheet.create({
  monthLabel: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.bodySmall, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.md },
  weekRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  weekText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.tiny, color: Colors.text.tertiary, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCircle: { width: 34, height: 34, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1.5, borderColor: Colors.accent.primary + '50' },
  moodDot: { position: 'absolute', top: 3, right: 5, width: 5, height: 5, borderRadius: 2.5 },
  dayText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.secondary },
});

// Main Styles

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  title: { fontFamily: Fonts.heading, fontSize: FontSizes.h1, color: Colors.text.primary, marginBottom: Spacing.xs },
  subtitle: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.secondary, marginBottom: Spacing.xxl },

  // Period
  periodRow: { flexDirection: 'row', marginBottom: Spacing.xxl, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.pill, padding: 3 },
  periodTab: { flex: 1, paddingVertical: Spacing.sm + 2, alignItems: 'center', borderRadius: Radius.pill },
  periodTabActive: { backgroundColor: Colors.accent.primary },
  periodTabActiveAnimated: { backgroundColor: Colors.accent.primary, borderRadius: Radius.pill },
  periodText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.bodySmall, color: Colors.text.secondary },
  periodTextActive: { color: Colors.text.onAccent, fontFamily: Fonts.bodySemiBold },

  // Bento Grid
  bentoRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  bentoCol: { flexDirection: 'column', gap: GAP },
  flex1: { flex: 1 },
  flex1_2: { flex: 1.2 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  flex4: { flex: 4 },
  flex6: { flex: 6 },
  flex7: { flex: 7 },
  flex45: { flex: 45 },
  flex55: { flex: 55 },
  trendValText: { fontFamily: Fonts.heading, fontSize: 32, lineHeight: 38 },
  energyStressCard: { flex: 1, minHeight: 80, justifyContent: 'center' },
  energyStressHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  energyStressLabel: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.caption, color: Colors.text.secondary, flex: 1 },
  energyStressValue: { fontFamily: Fonts.heading, fontSize: FontSizes.body },
  energyStressGauge: { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: Spacing.sm, overflow: 'hidden' },

  // Full-width cards
  fullCard: { marginBottom: GAP },

  // Card headers
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardHeaderSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTitle: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.body, color: Colors.text.primary },
  cardTitleSm: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.bodySmall, color: Colors.text.primary },

  // Icon bg (reused)
  iconBg: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },

  // Score Card
  scoreIconRow: { marginBottom: Spacing.sm },
  scoreValue: { fontFamily: Fonts.heading, fontSize: 52, lineHeight: 58 },
  scoreLabel: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.caption, color: Colors.text.secondary, marginTop: 2 },
  scoreBar: { width: '100%', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: Spacing.md, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  scoreHint: { fontFamily: Fonts.body, fontSize: FontSizes.tiny, color: Colors.text.tertiary, marginTop: Spacing.sm, textAlign: 'center' },

  // Mini stat cards
  miniCard: { alignItems: 'center', justifyContent: 'center' },
  miniValue: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.primary, marginTop: 4 },
  miniLabel: { fontFamily: Fonts.body, fontSize: FontSizes.tiny, color: Colors.text.secondary, marginTop: 2 },

  // Gauge mini bar
  gaugeMini: { width: '80%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: Spacing.sm, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 2 },

  // Narrative
  narrativeText: { fontFamily: Fonts.body, fontSize: FontSizes.bodySmall, color: Colors.text.secondary, lineHeight: 22 },
  summaryList: { gap: Spacing.sm, marginTop: Spacing.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  summaryRowIcon: { marginRight: Spacing.xs },
  summaryRowLabel: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.secondary, flex: 1 },
  summaryValueContainer: { flexDirection: 'row', alignItems: 'center' },
  summaryDot: { width: 6, height: 6, borderRadius: 3, marginRight: Spacing.xs },
  summaryRowVal: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.caption, color: Colors.text.primary },

  // Top Emotions
  emotionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm + 2 },
  emotionDot: { width: 7, height: 7, borderRadius: 4, marginRight: Spacing.sm },
  emotionLabel: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.caption, color: Colors.text.primary, width: 56 },
  emotionBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: Spacing.sm, overflow: 'hidden' },
  emotionBarFill: { height: '100%', borderRadius: 4, opacity: 0.8 },
  emotionPct: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.tiny, color: Colors.text.secondary, width: 28, textAlign: 'right' },

  // Calendar nav
  calNav: { flexDirection: 'row', gap: Spacing.xs },
  calBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

  // Distribution
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  distDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  distLabel: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.secondary, flex: 1 },
  distValue: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.bodySmall, color: Colors.text.primary },
  stackedBar: { flexDirection: 'row', height: 6, borderRadius: 4, marginTop: Spacing.md, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  stackedSeg: { height: '100%' },

  // Triggers
  triggerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  triggerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.chip, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  triggerText: { fontFamily: Fonts.body, fontSize: FontSizes.tiny, color: Colors.text.primary },
  triggerCount: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.tiny },
  emptyMini: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.tertiary, textAlign: 'center', marginTop: Spacing.md },

  // Bar Chart
  barChart: { flexDirection: 'row', justifyContent: 'space-between', height: 100, alignItems: 'flex-end' },
  barGroup: { flex: 1, alignItems: 'center' },
  barContainer: { width: 8, height: '100%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barPos: { backgroundColor: Colors.accent.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barNeg: { backgroundColor: Colors.accent.coral },
  barLegend: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md, justifyContent: 'center' },
  barLegendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  barLegendDot: { width: 6, height: 6, borderRadius: 3 },
  barLegendText: { fontFamily: Fonts.body, fontSize: FontSizes.tiny, color: Colors.text.secondary },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.subheading, fontSize: FontSizes.h3, color: Colors.text.primary },

  // History entries
  historyCard: { marginBottom: Spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center' },
  historyBar: { width: 4, height: 38, borderRadius: 2, marginRight: Spacing.md },
  historyMid: { flex: 1 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  historyLabel: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.bodySmall, color: Colors.text.primary },
  historyDate: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.tertiary, marginLeft: 'auto' },
  historyNote: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.secondary },
  historyBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.md },
  historyBadgeText: { fontFamily: Fonts.heading, fontSize: FontSizes.caption },

  // Empty state
  emptyCard: { marginTop: Spacing.xxl, alignItems: 'center', paddingVertical: Spacing.xxxl },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.subheading, fontSize: FontSizes.h3, color: Colors.text.primary, marginBottom: Spacing.sm },
  emptySub: { fontFamily: Fonts.body, fontSize: FontSizes.bodySmall, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
});
