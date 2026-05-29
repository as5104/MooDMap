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
        energy_level = ?, stress_level = ?, tags = ?,
        note = ?, time_of_day = ?
      WHERE id = ?`,
      [
        now, input.moodType, input.moodScore,
        input.energyLevel ?? null, input.stressLevel ?? null,
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
      tags: tagsJson,
      note: input.note ?? null,
      time_of_day: timeOfDay,
    };
  }

  // Insert new
  const id = generateId();
  execute(
    `INSERT INTO mood_entries (id, created_at, updated_at, date, mood_type, mood_score, energy_level, stress_level, tags, note, time_of_day, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, now, now, today,
      input.moodType, input.moodScore,
      input.energyLevel ?? null, input.stressLevel ?? null,
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
