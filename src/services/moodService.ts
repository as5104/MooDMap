/**
 * MoodMap — Mood Service (Raw SQL)
 * CRUD for mood entries + score + streaks using expo-sqlite directly
 */

import { queryAll, queryFirst, execute } from '@/db/client';
import { type MoodType, MOOD_MAP } from '@/constants/moods';
import type { FaceExpression } from '@/components/ui/MoodFace';

// Types

export interface MoodEntryInput {
  moodType: MoodType;
  moodScore: number;
  energyLevel?: number;
  stressLevel?: number;
  sleepHours?: number;
  sleepQuality?: number;
  tags?: string[];
  note?: string;
  userId?: string;
}

export interface MoodEntryRow {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
  mood_type: string;
  mood_score: number;
  energy_level: number | null;
  stress_level: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  tags: string | null;
  note: string | null;
  time_of_day: string | null;
  user_id: string | null;
}

export interface DayMoodData {
  day: string;
  date: string;
  expression: FaceExpression;
  faceColor: string;
  moodType: MoodType;
  moodScore: number;
}

export interface MoodStatsData {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

// Helpers

function generateId(): string {
  return `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

// Service Functions

/**
 * Save a mood entry. If one already exists for today, update it.
 */
export function saveMoodEntry(input: MoodEntryInput): MoodEntryRow {
  const now = new Date().toISOString();
  const today = getTodayDate();

  // Check if entry for today already exists
  const whereClause = input.userId
    ? 'date = ? AND user_id = ?'
    : 'date = ?';
  const whereParams = input.userId ? [today, input.userId] : [today];

  const existing = queryFirst<MoodEntryRow>(
    `SELECT * FROM mood_entries WHERE ${whereClause} LIMIT 1`,
    whereParams
  );

  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
  const timeOfDay = getTimeOfDay();

  if (existing) {
    execute(
      `UPDATE mood_entries SET
        updated_at = ?, mood_type = ?, mood_score = ?,
        energy_level = ?, stress_level = ?, sleep_hours = ?,
        sleep_quality = ?, tags = ?, note = ?, time_of_day = ?
      WHERE id = ?`,
      [
        now, input.moodType, input.moodScore,
        input.energyLevel ?? null, input.stressLevel ?? null,
        input.sleepHours ?? null, input.sleepQuality ?? null,
        tagsJson, input.note ?? null, timeOfDay,
        existing.id,
      ]
    );

    return {
      ...existing,
      updated_at: now,
      mood_type: input.moodType,
      mood_score: input.moodScore,
      energy_level: input.energyLevel ?? null,
      stress_level: input.stressLevel ?? null,
      sleep_hours: input.sleepHours ?? null,
      sleep_quality: input.sleepQuality ?? null,
      tags: tagsJson,
      note: input.note ?? null,
      time_of_day: timeOfDay,
    };
  }

  // Insert new
  const id = generateId();
  execute(
    `INSERT INTO mood_entries (id, created_at, updated_at, date, mood_type, mood_score, energy_level, stress_level, sleep_hours, sleep_quality, tags, note, time_of_day, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, now, now, today,
      input.moodType, input.moodScore,
      input.energyLevel ?? null, input.stressLevel ?? null,
      input.sleepHours ?? null, input.sleepQuality ?? null,
      tagsJson, input.note ?? null, timeOfDay,
      input.userId ?? null,
    ]
  );

  // Update streak
  if (input.userId) {
    updateMoodStreak(input.userId);
  }

  return {
    id,
    created_at: now,
    updated_at: now,
    date: today,
    mood_type: input.moodType,
    mood_score: input.moodScore,
    energy_level: input.energyLevel ?? null,
    stress_level: input.stressLevel ?? null,
    sleep_hours: input.sleepHours ?? null,
    sleep_quality: input.sleepQuality ?? null,
    tags: tagsJson,
    note: input.note ?? null,
    time_of_day: timeOfDay,
    user_id: input.userId ?? null,
  };
}

/**
 * Get today's mood entry
 */
export function getTodayMood(userId?: string): MoodEntryRow | null {
  const today = getTodayDate();
  if (userId) {
    return queryFirst<MoodEntryRow>(
      'SELECT * FROM mood_entries WHERE date = ? AND user_id = ? LIMIT 1',
      [today, userId]
    );
  }
  return queryFirst<MoodEntryRow>(
    'SELECT * FROM mood_entries WHERE date = ? LIMIT 1',
    [today]
  );
}

/**
 * Get last 7 days of mood data for WeeklyMoodRow
 */
export function getWeeklyMoods(userId?: string): DayMoodData[] {
  const weekAgo = getDateNDaysAgo(6);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<MoodEntryRow>(
        'SELECT * FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [weekAgo, today, userId]
      )
    : queryAll<MoodEntryRow>(
        'SELECT * FROM mood_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [weekAgo, today]
      );

  const entryMap = new Map<string, MoodEntryRow>();
  for (const e of entries) {
    entryMap.set(e.date, e);
  }

  const result: DayMoodData[] = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = getDateNDaysAgo(i);
    const entry = entryMap.get(dateStr);
    const moodType = (entry?.mood_type ?? 'calm') as MoodType;
    const mood = MOOD_MAP[moodType] ?? MOOD_MAP.calm;

    result.push({
      day: getDayLabel(dateStr),
      date: dateStr,
      expression: mood.expression,
      faceColor: mood.faceColor,
      moodType,
      moodScore: entry?.mood_score ?? 0,
    });
  }

  return result;
}

/**
 * Calculate mood score (0-100) from last 7 days
 */
export function getMoodScore(userId?: string): number {
  const weekAgo = getDateNDaysAgo(6);
  const today = getTodayDate();

  const result = userId
    ? queryFirst<{ avg_score: number; cnt: number }>(
        'SELECT AVG(mood_score) as avg_score, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ?',
        [weekAgo, today, userId]
      )
    : queryFirst<{ avg_score: number; cnt: number }>(
        'SELECT AVG(mood_score) as avg_score, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ?',
        [weekAgo, today]
      );

  if (!result || result.cnt === 0 || result.avg_score === null) return 0;
  return Math.round((result.avg_score / 10) * 100);
}

/**
 * Get mood statistics (positive/negative/neutral counts)
 */
export function getMoodStats(userId?: string, days: number = 30): MoodStatsData {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<{ mood_score: number }>(
        'SELECT mood_score FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ?',
        [startDate, today, userId]
      )
    : queryAll<{ mood_score: number }>(
        'SELECT mood_score FROM mood_entries WHERE date >= ? AND date <= ?',
        [startDate, today]
      );

  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const e of entries) {
    if (e.mood_score >= 7) positive++;
    else if (e.mood_score >= 5) neutral++;
    else negative++;
  }

  return { positive, negative, neutral, total: entries.length };
}

/**
 * Get mood history entries (recent first)
 */
export function getMoodHistory(userId?: string, limit: number = 20): MoodEntryRow[] {
  if (userId) {
    return queryAll<MoodEntryRow>(
      'SELECT * FROM mood_entries WHERE user_id = ? ORDER BY date DESC LIMIT ?',
      [userId, limit]
    );
  }
  return queryAll<MoodEntryRow>(
    'SELECT * FROM mood_entries ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

/**
 * Get total mood entries count
 */
export function getMoodCount(userId?: string): number {
  const result = userId
    ? queryFirst<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM mood_entries WHERE user_id = ?',
        [userId]
      )
    : queryFirst<{ cnt: number }>('SELECT COUNT(*) as cnt FROM mood_entries');

  return result?.cnt ?? 0;
}

/**
 * Get monthly bar chart data
 */
export function getMonthlyBarData(
  userId?: string,
  days: number = 30
): { positive: number; negative: number }[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<{ mood_score: number }>(
        'SELECT mood_score FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [startDate, today, userId]
      )
    : queryAll<{ mood_score: number }>(
        'SELECT mood_score FROM mood_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate, today]
      );

  if (entries.length === 0) return [{ positive: 0.5, negative: 0.5 }];

  const bucketSize = Math.max(1, Math.ceil(entries.length / 12));
  const buckets: { positive: number; negative: number }[] = [];

  for (let i = 0; i < entries.length; i += bucketSize) {
    const slice = entries.slice(i, i + bucketSize);
    let pos = 0;
    let neg = 0;
    for (const e of slice) {
      if (e.mood_score >= 6) pos++;
      else neg++;
    }
    const total = Math.max(pos + neg, 1);
    buckets.push({ positive: pos / total, negative: neg / total });
  }

  return buckets;
}

/**
 * Update mood streak for a user
 */
function updateMoodStreak(userId: string): { current: number; longest: number } {
  const today = getTodayDate();

  const existing = queryFirst<{
    id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    total_entries: number;
  }>(
    "SELECT * FROM streaks WHERE user_id = ? AND type = 'mood' LIMIT 1",
    [userId]
  );

  if (!existing) {
    execute(
      'INSERT INTO streaks (id, type, current_streak, longest_streak, last_active_date, total_entries, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [`streak_mood_${userId}`, 'mood', 1, 1, today, 1, userId]
    );
    return { current: 1, longest: 1 };
  }

  if (existing.last_active_date === today) {
    return { current: existing.current_streak, longest: existing.longest_streak };
  }

  const yesterday = getDateNDaysAgo(1);
  const newCurrent = existing.last_active_date === yesterday
    ? existing.current_streak + 1
    : 1;
  const newLongest = Math.max(existing.longest_streak, newCurrent);

  execute(
    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, total_entries = ? WHERE id = ?',
    [newCurrent, newLongest, today, existing.total_entries + 1, existing.id]
  );

  return { current: newCurrent, longest: newLongest };
}

/**
 * Get current mood streak
 */
export function getMoodStreak(userId?: string): { current: number; longest: number; total: number } {
  if (!userId) return { current: 0, longest: 0, total: 0 };

  const result = queryFirst<{
    current_streak: number;
    longest_streak: number;
    total_entries: number;
  }>(
    "SELECT * FROM streaks WHERE user_id = ? AND type = 'mood' LIMIT 1",
    [userId]
  );

  if (!result) return { current: 0, longest: 0, total: 0 };

  return {
    current: result.current_streak,
    longest: result.longest_streak,
    total: result.total_entries,
  };
}

// Analytics Functions

export interface TopMoodItem {
  moodType: MoodType;
  count: number;
  percentage: number;
}

export interface TagFrequencyItem {
  tag: string;
  count: number;
  avgScore: number;
}

export interface MoodCalendarItem {
  date: string;
  moodType: MoodType;
  moodScore: number;
}

export interface MoodSummaryData {
  dominantMood: MoodType | null;
  dominantMoodCount: number;
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;
  trendDirection: 'improving' | 'declining' | 'stable';
  avgScore: number;
  totalEntries: number;
  topTrigger: string | null;
}

export interface EnergyStressData {
  avgEnergy: number;
  avgStress: number;
  energyCount: number;
  stressCount: number;
}

/**
 * Period-aware mood score (0-100)
 */
export function getMoodScoreForPeriod(userId?: string, days: number = 7): number {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const result = userId
    ? queryFirst<{ avg_score: number; cnt: number }>(
        'SELECT AVG(mood_score) as avg_score, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ?',
        [startDate, today, userId]
      )
    : queryFirst<{ avg_score: number; cnt: number }>(
        'SELECT AVG(mood_score) as avg_score, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ?',
        [startDate, today]
      );

  if (!result || result.cnt === 0 || result.avg_score === null) return 0;
  return Math.round((result.avg_score / 10) * 100);
}

/**
 * Get top mood types by frequency within a period
 */
export function getTopMoods(userId?: string, days: number = 30, limit: number = 5): TopMoodItem[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  // Query the total count of all entries in the period to base percentages on the true total
  const totalResult = userId
    ? queryFirst<{ total: number }>(
        'SELECT COUNT(*) as total FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ?',
        [startDate, today, userId]
      )
    : queryFirst<{ total: number }>(
        'SELECT COUNT(*) as total FROM mood_entries WHERE date >= ? AND date <= ?',
        [startDate, today]
      );

  const totalCount = totalResult?.total ?? 0;
  if (totalCount === 0) return [];

  const rows = userId
    ? queryAll<{ mood_type: string; cnt: number }>(
        'SELECT mood_type, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? GROUP BY mood_type ORDER BY cnt DESC LIMIT ?',
        [startDate, today, userId, limit]
      )
    : queryAll<{ mood_type: string; cnt: number }>(
        'SELECT mood_type, COUNT(*) as cnt FROM mood_entries WHERE date >= ? AND date <= ? GROUP BY mood_type ORDER BY cnt DESC LIMIT ?',
        [startDate, today, limit]
      );

  return rows.map((r) => ({
    moodType: r.mood_type as MoodType,
    count: r.cnt,
    percentage: Math.round((r.cnt / totalCount) * 100),
  }));
}

/**
 * Get tag frequency + average mood score per tag
 */
export function getTagFrequency(userId?: string, days: number = 30, limit: number = 8): TagFrequencyItem[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const rows = userId
    ? queryAll<{ tags: string; mood_score: number }>(
        "SELECT tags, mood_score FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? AND tags IS NOT NULL AND tags != '[]'",
        [startDate, today, userId]
      )
    : queryAll<{ tags: string; mood_score: number }>(
        "SELECT tags, mood_score FROM mood_entries WHERE date >= ? AND date <= ? AND tags IS NOT NULL AND tags != '[]'",
        [startDate, today]
      );

  const tagMap = new Map<string, { count: number; totalScore: number }>();

  for (const row of rows) {
    try {
      const tags: string[] = JSON.parse(row.tags);
      for (const tag of tags) {
        const existing = tagMap.get(tag) ?? { count: 0, totalScore: 0 };
        existing.count += 1;
        existing.totalScore += row.mood_score;
        tagMap.set(tag, existing);
      }
    } catch {
      // Skip malformed JSON
    }
  }

  const result: TagFrequencyItem[] = [];
  for (const [tag, data] of tagMap.entries()) {
    result.push({
      tag,
      count: data.count,
      avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
    });
  }

  result.sort((a, b) => b.count - a.count);
  return result.slice(0, limit);
}

/**
 * Get mood data for calendar grid (one month)
 */
export function getMoodCalendarData(userId?: string, year?: number, month?: number): MoodCalendarItem[] {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth(); // 0-indexed

  const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const rows = userId
    ? queryAll<{ date: string; mood_type: string; mood_score: number }>(
        'SELECT date, mood_type, mood_score FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [startDate, endDate, userId]
      )
    : queryAll<{ date: string; mood_type: string; mood_score: number }>(
        'SELECT date, mood_type, mood_score FROM mood_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate, endDate]
      );

  return rows.map((r) => ({
    date: r.date,
    moodType: r.mood_type as MoodType,
    moodScore: r.mood_score,
  }));
}

/**
 * Generate rule-based mood summary for a period
 */
export function getMoodSummary(userId?: string, days: number = 7): MoodSummaryData {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<MoodEntryRow>(
        'SELECT * FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [startDate, today, userId]
      )
    : queryAll<MoodEntryRow>(
        'SELECT * FROM mood_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate, today]
      );

  const empty: MoodSummaryData = {
    dominantMood: null,
    dominantMoodCount: 0,
    bestDay: null,
    worstDay: null,
    trendDirection: 'stable',
    avgScore: 0,
    totalEntries: 0,
    topTrigger: null,
  };

  if (entries.length === 0) return empty;

  // Dominant mood
  const moodCounts = new Map<string, number>();
  let bestDay: { date: string; score: number } | null = null;
  let worstDay: { date: string; score: number } | null = null;
  let totalScore = 0;
  const tagCounts = new Map<string, number>();

  for (const e of entries) {
    // Count moods
    moodCounts.set(e.mood_type, (moodCounts.get(e.mood_type) ?? 0) + 1);

    // Track best/worst
    if (!bestDay || e.mood_score > bestDay.score) {
      bestDay = { date: e.date, score: e.mood_score };
    }
    if (!worstDay || e.mood_score < worstDay.score) {
      worstDay = { date: e.date, score: e.mood_score };
    }

    totalScore += e.mood_score;

    // Count tags
    if (e.tags) {
      try {
        const tags: string[] = JSON.parse(e.tags);
        for (const t of tags) {
          tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
        }
      } catch { /* skip */ }
    }
  }

  // Find dominant mood
  let dominantMood: MoodType | null = null;
  let dominantMoodCount = 0;
  for (const [mood, count] of moodCounts.entries()) {
    if (count > dominantMoodCount) {
      dominantMood = mood as MoodType;
      dominantMoodCount = count;
    }
  }

  // Find top trigger
  let topTrigger: string | null = null;
  let topTriggerCount = 0;
  for (const [tag, count] of tagCounts.entries()) {
    if (count > topTriggerCount) {
      topTrigger = tag;
      topTriggerCount = count;
    }
  }

  // Determine trend (compare first half vs second half)
  let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
  if (entries.length >= 4) {
    const mid = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, mid);
    const secondHalf = entries.slice(mid);
    const firstAvg = firstHalf.reduce((s, e) => s + e.mood_score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, e) => s + e.mood_score, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 1.0) trendDirection = 'improving';
    else if (diff < -1.0) trendDirection = 'declining';
  }

  return {
    dominantMood,
    dominantMoodCount,
    bestDay,
    worstDay,
    trendDirection,
    avgScore: Math.round((totalScore / entries.length) * 10) / 10,
    totalEntries: entries.length,
    topTrigger,
  };
}

/**
 * Get average energy and stress levels for a period
 */
export function getAvgEnergyStress(userId?: string, days: number = 7): EnergyStressData {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const result = userId
    ? queryFirst<{ avg_energy: number | null; avg_stress: number | null; energy_cnt: number; stress_cnt: number }>(
        `SELECT
          AVG(CASE WHEN energy_level IS NOT NULL THEN energy_level END) as avg_energy,
          AVG(CASE WHEN stress_level IS NOT NULL THEN stress_level END) as avg_stress,
          SUM(CASE WHEN energy_level IS NOT NULL THEN 1 ELSE 0 END) as energy_cnt,
          SUM(CASE WHEN stress_level IS NOT NULL THEN 1 ELSE 0 END) as stress_cnt
        FROM mood_entries WHERE date >= ? AND date <= ? AND user_id = ?`,
        [startDate, today, userId]
      )
    : queryFirst<{ avg_energy: number | null; avg_stress: number | null; energy_cnt: number; stress_cnt: number }>(
        `SELECT
          AVG(CASE WHEN energy_level IS NOT NULL THEN energy_level END) as avg_energy,
          AVG(CASE WHEN stress_level IS NOT NULL THEN stress_level END) as avg_stress,
          SUM(CASE WHEN energy_level IS NOT NULL THEN 1 ELSE 0 END) as energy_cnt,
          SUM(CASE WHEN stress_level IS NOT NULL THEN 1 ELSE 0 END) as stress_cnt
        FROM mood_entries WHERE date >= ? AND date <= ?`,
        [startDate, today]
      );

  return {
    avgEnergy: result?.avg_energy ? Math.round(result.avg_energy * 10) / 10 : 0,
    avgStress: result?.avg_stress ? Math.round(result.avg_stress * 10) / 10 : 0,
    energyCount: result?.energy_cnt ?? 0,
    stressCount: result?.stress_cnt ?? 0,
  };
}

export interface SleepInsightData {
  avgSleepHours: number;
  avgSleepQuality: number;
  sleepCount: number;
  avgMoodGoodSleep: number | null;
  avgMoodPoorSleep: number | null;
}

/**
 * Get average sleep duration, quality, and mood correlation
 */
export function getSleepMetricsAndCorrelation(userId?: string, days: number = 7): SleepInsightData {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const queryParams = userId ? [startDate, today, userId] : [startDate, today];
  const userClause = userId ? 'AND user_id = ?' : '';

  const avgResult = queryFirst<{ avg_hours: number | null; avg_quality: number | null; sleep_cnt: number }>(
    `SELECT
      AVG(CASE WHEN sleep_hours IS NOT NULL THEN sleep_hours END) as avg_hours,
      AVG(CASE WHEN sleep_quality IS NOT NULL THEN sleep_quality END) as avg_quality,
      SUM(CASE WHEN sleep_hours IS NOT NULL THEN 1 ELSE 0 END) as sleep_cnt
    FROM mood_entries WHERE date >= ? AND date <= ? ${userClause}`,
    queryParams
  );

  const goodSleepQueryParams = userId ? [startDate, today, 7, userId] : [startDate, today, 7];
  const goodSleepResult = queryFirst<{ avg_mood: number | null }>(
    `SELECT AVG(mood_score) as avg_mood FROM mood_entries
     WHERE date >= ? AND date <= ? AND sleep_hours >= ? ${userClause}`,
    goodSleepQueryParams
  );

  const poorSleepQueryParams = userId ? [startDate, today, 7, userId] : [startDate, today, 7];
  const poorSleepResult = queryFirst<{ avg_mood: number | null }>(
    `SELECT AVG(mood_score) as avg_mood FROM mood_entries
     WHERE date >= ? AND date <= ? AND sleep_hours < ? ${userClause}`,
    poorSleepQueryParams
  );

  return {
    avgSleepHours: avgResult?.avg_hours ? Math.round(avgResult.avg_hours * 10) / 10 : 0,
    avgSleepQuality: avgResult?.avg_quality ? Math.round(avgResult.avg_quality * 10) / 10 : 0,
    sleepCount: avgResult?.sleep_cnt ?? 0,
    avgMoodGoodSleep: goodSleepResult?.avg_mood ? Math.round((goodSleepResult.avg_mood / 10) * 100) : null,
    avgMoodPoorSleep: poorSleepResult?.avg_mood ? Math.round((poorSleepResult.avg_mood / 10) * 100) : null,
  };
}

export interface MCQInsightItem {
  category: string;
  question: string;
  topAnswer: string;
  count: number;
}

/**
 * Get dynamic MCQ insights from logged check-ins by parsing JSON notes
 */
export function getMCQInsights(userId?: string, days: number = 30): MCQInsightItem[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const queryParams = userId ? [startDate, today, userId] : [startDate, today];
  const userClause = userId ? 'AND user_id = ?' : '';

  const entries = queryAll<{ note: string | null }>(
    `SELECT note FROM mood_entries WHERE date >= ? AND date <= ? AND note IS NOT NULL ${userClause}`,
    queryParams
  );

  const counts = new Map<string, { question: string; answers: Map<string, number> }>();

  for (const entry of entries) {
    if (!entry.note) continue;
    try {
      const parsed = JSON.parse(entry.note);
      if (parsed && parsed.mcqId && parsed.category && parsed.answer) {
        const cat = parsed.category;
        const q = parsed.question;
        const ans = parsed.answer;

        const existing = counts.get(cat) ?? { question: q, answers: new Map<string, number>() };
        existing.answers.set(ans, (existing.answers.get(ans) ?? 0) + 1);
        counts.set(cat, existing);
      }
    } catch {
      // Not a valid JSON note or old format note, skip silently
    }
  }

  const result: MCQInsightItem[] = [];
  for (const [cat, data] of counts.entries()) {
    let topAnswer = '';
    let maxCount = 0;
    let totalCatCount = 0;

    for (const [ans, count] of data.answers.entries()) {
      totalCatCount += count;
      if (count > maxCount) {
        maxCount = count;
        topAnswer = ans;
      }
    }

    result.push({
      category: cat,
      question: data.question,
      topAnswer,
      count: totalCatCount,
    });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * Formats a stored mood note. If the note is an MCQ JSON response, it parses
 * it and returns a clean "Category: Answer" string; otherwise it returns the plain note.
 */
export function formatMoodNote(note: string | undefined | null): string {
  if (!note) return '';
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === 'object') {
      if (parsed.category && parsed.answer) {
        return `${parsed.category}: ${parsed.answer}`;
      }
      if (parsed.answer) {
        return parsed.answer;
      }
    }
  } catch {
    // Treat as plain text note
  }
  return note;
}


