/**
 * MoodMap — Journal Service (Raw SQL)
 * CRUD for journal entries using expo-sqlite directly
 */

import { queryAll, queryFirst, execute } from '@/db/client';

// Types

export interface JournalEntryInput {
  title?: string;
  content: string;
  moodEntryId?: string;
  promptUsed?: string;
  userId?: string;
}

export interface JournalEntryRow {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
  title: string | null;
  content: string;
  mood_entry_id: string | null;
  prompt_used: string | null;
  images: string | null;
  user_id: string | null;
}

export interface JournalDotData {
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'empty';
}

// Helpers

function generateId(): string {
  return `journal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Service Functions

/**
 * Save a new journal entry
 */
export function saveJournalEntry(input: JournalEntryInput): JournalEntryRow {
  const now = new Date().toISOString();
  const today = getTodayDate();
  const id = generateId();

  execute(
    `INSERT INTO journal_entries (id, created_at, updated_at, date, title, content, mood_entry_id, prompt_used, images, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, now, now, today,
      input.title ?? null, input.content,
      input.moodEntryId ?? null, input.promptUsed ?? null,
      null, input.userId ?? null,
    ]
  );

  // Update journal streak
  if (input.userId) {
    updateJournalStreak(input.userId);
  }

  return {
    id,
    created_at: now,
    updated_at: now,
    date: today,
    title: input.title ?? null,
    content: input.content,
    mood_entry_id: input.moodEntryId ?? null,
    prompt_used: input.promptUsed ?? null,
    images: null,
    user_id: input.userId ?? null,
  };
}

/**
 * Update an existing journal entry
 */
export function updateJournalEntry(
  id: string,
  input: { title?: string; content: string }
): JournalEntryRow | null {
  const now = new Date().toISOString();

  execute(
    'UPDATE journal_entries SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    [input.title ?? null, input.content, now, id]
  );

  return getJournalEntryById(id);
}

/**
 * Get recent journal entries
 */
export function getRecentJournals(userId?: string, limit: number = 20): JournalEntryRow[] {
  if (userId) {
    return queryAll<JournalEntryRow>(
      'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT ?',
      [userId, limit]
    );
  }
  return queryAll<JournalEntryRow>(
    'SELECT * FROM journal_entries ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

/**
 * Get journal count for a given year
 */
export function getJournalCount(userId?: string, year?: number): number {
  const y = year ?? new Date().getFullYear();
  const startDate = `${y}-01-01`;
  const endDate = `${y}-12-31`;

  const result = userId
    ? queryFirst<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM journal_entries WHERE date >= ? AND date <= ? AND user_id = ?',
        [startDate, endDate, userId]
      )
    : queryFirst<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM journal_entries WHERE date >= ? AND date <= ?',
        [startDate, endDate]
      );

  return result?.cnt ?? 0;
}

/**
 * Get dot grid data for journal history visualization
 */
export function getJournalDotGrid(userId?: string, days: number = 48): JournalDotData[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<{ date: string; content: string }>(
        'SELECT date, content FROM journal_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [startDate, today, userId]
      )
    : queryAll<{ date: string; content: string }>(
        'SELECT date, content FROM journal_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate, today]
      );

  const entryMap = new Map<string, string>();
  for (const e of entries) {
    entryMap.set(e.date, e.content);
  }

  const result: JournalDotData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getDateNDaysAgo(i);
    const content = entryMap.get(dateStr);

    if (!content) {
      result.push({ date: dateStr, sentiment: 'empty' });
    } else {
      const len = content.length;
      if (len > 200) result.push({ date: dateStr, sentiment: 'positive' });
      else if (len > 50) result.push({ date: dateStr, sentiment: 'neutral' });
      else result.push({ date: dateStr, sentiment: 'negative' });
    }
  }

  return result;
}

/**
 * Delete a journal entry by ID
 */
export function deleteJournalEntry(id: string): boolean {
  try {
    execute('DELETE FROM journal_entries WHERE id = ?', [id]);
    return true;
  } catch (e) {
    console.error('[JournalService] Delete error:', e);
    return false;
  }
}

/**
 * Get a single journal entry by ID
 */
export function getJournalEntryById(id: string): JournalEntryRow | null {
  return queryFirst<JournalEntryRow>(
    'SELECT * FROM journal_entries WHERE id = ?',
    [id]
  );
}

/**
 * Get the single most recent journal entry (for Home Dashboard)
 */
export function getLatestJournal(userId?: string): JournalEntryRow | null {
  if (userId) {
    return queryFirst<JournalEntryRow>(
      'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  }
  return queryFirst<JournalEntryRow>(
    'SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 1'
  );
}

/**
 * Update journal streak
 */
function updateJournalStreak(userId: string): void {
  const today = getTodayDate();

  const existing = queryFirst<{
    id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    total_entries: number;
  }>(
    "SELECT * FROM streaks WHERE user_id = ? AND type = 'journal' LIMIT 1",
    [userId]
  );

  if (!existing) {
    execute(
      'INSERT INTO streaks (id, type, current_streak, longest_streak, last_active_date, total_entries, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [`streak_journal_${userId}`, 'journal', 1, 1, today, 1, userId]
    );
    return;
  }

  if (existing.last_active_date === today) return;

  const yesterday = getDateNDaysAgo(1);
  const newCurrent = existing.last_active_date === yesterday
    ? existing.current_streak + 1
    : 1;

  execute(
    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, total_entries = ? WHERE id = ?',
    [newCurrent, Math.max(existing.longest_streak, newCurrent), today, existing.total_entries + 1, existing.id]
  );
}

/**
 * Get journal streak
 */
export function getJournalStreak(userId?: string): { current: number; total: number } {
  if (!userId) return { current: 0, total: 0 };

  const result = queryFirst<{
    current_streak: number;
    total_entries: number;
  }>(
    "SELECT * FROM streaks WHERE user_id = ? AND type = 'journal' LIMIT 1",
    [userId]
  );

  if (!result) return { current: 0, total: 0 };

  return {
    current: result.current_streak,
    total: result.total_entries,
  };
}

// Draft Functions

export interface JournalDraft {
  id: string;
  title: string | null;
  content: string;
  prompt_used: string | null;
  updated_at: string;
  user_id: string | null;
}

/**
 * Save or update a journal draft
 */
export function saveDraft(input: {
  title?: string;
  content: string;
  promptUsed?: string;
  userId?: string;
}): void {
  const now = new Date().toISOString();
  const draftId = `draft_${input.userId ?? 'anonymous'}`;

  const existing = queryFirst<{ id: string }>(
    'SELECT id FROM journal_drafts WHERE id = ?',
    [draftId]
  );

  if (existing) {
    execute(
      'UPDATE journal_drafts SET title = ?, content = ?, prompt_used = ?, updated_at = ? WHERE id = ?',
      [input.title ?? null, input.content, input.promptUsed ?? null, now, draftId]
    );
  } else {
    execute(
      'INSERT INTO journal_drafts (id, title, content, prompt_used, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [draftId, input.title ?? null, input.content, input.promptUsed ?? null, now, input.userId ?? null]
    );
  }
}

/**
 * Load the current draft for a user
 */
export function loadDraft(userId?: string): JournalDraft | null {
  const draftId = `draft_${userId ?? 'anonymous'}`;
  return queryFirst<JournalDraft>(
    'SELECT * FROM journal_drafts WHERE id = ?',
    [draftId]
  );
}

/**
 * Delete the current draft for a user
 */
export function deleteDraft(userId?: string): void {
  const draftId = `draft_${userId ?? 'anonymous'}`;
  execute('DELETE FROM journal_drafts WHERE id = ?', [draftId]);
}

/**
 * Check if a draft exists for a user
 */
export function hasDraft(userId?: string): boolean {
  const draftId = `draft_${userId ?? 'anonymous'}`;
  const result = queryFirst<{ id: string }>(
    'SELECT id FROM journal_drafts WHERE id = ? AND content != \'\'',
    [draftId]
  );
  return !!result;
}
