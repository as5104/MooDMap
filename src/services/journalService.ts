/**
 * MoodMap — Journal Service (Raw SQL)
 * CRUD for journal entries using expo-sqlite directly
 */

import { queryAll, queryFirst, execute } from '@/db/client';
import { analyzeJournalSentiment } from '@/utils/sentimentAnalyzer';

// Types

export interface JournalEntryInput {
  title?: string;
  content: string;
  moodEntryId?: string;
  promptUsed?: string;
  userId?: string;
  subtype?: 'journal' | 'letter';
  recipient?: 'future_self' | 'past_self' | 'someone' | string;
  recipientName?: string;
  revealAt?: string; // ISO date string
  lockKeyword?: string; // Secret passphrase
  lockHint?: string; // Required hint
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
  is_comfort?: number;
  last_shown_at?: string | null;
  subtype?: 'journal' | 'letter';
  recipient?: 'future_self' | 'past_self' | 'someone' | string | null;
  recipient_name?: string | null;
  reveal_at?: string | null;
  lock_keyword?: string | null;
  lock_hint?: string | null;
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
 * Save a new journal entry or letter
 */
export function saveJournalEntry(input: JournalEntryInput): JournalEntryRow {
  const now = new Date().toISOString();
  const today = getTodayDate();
  const id = generateId();
  const subtype = input.subtype ?? 'journal';
  const recipient = input.recipient ?? null;
  const recipientName = input.recipientName ?? null;
  const revealAt = input.revealAt ?? null;
  const lockKeyword = input.lockKeyword ? input.lockKeyword.trim() : null;
  const lockHint = input.lockHint ? input.lockHint.trim() : null;

  execute(
    `INSERT INTO journal_entries (id, created_at, updated_at, date, title, content, mood_entry_id, prompt_used, images, is_comfort, subtype, recipient, recipient_name, reveal_at, lock_keyword, lock_hint, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, now, now, today,
      input.title ?? null, input.content,
      input.moodEntryId ?? null, input.promptUsed ?? null,
      null, 0,
      subtype, recipient, recipientName, revealAt, lockKeyword, lockHint,
      input.userId ?? null,
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
    is_comfort: 0,
    subtype,
    recipient,
    recipient_name: recipientName,
    reveal_at: revealAt,
    lock_keyword: lockKeyword,
    lock_hint: lockHint,
    user_id: input.userId ?? null,
  };
}

/**
 * Update an existing journal entry or letter
 */
export function updateJournalEntry(
  id: string,
  input: {
    title?: string;
    content: string;
    subtype?: 'journal' | 'letter';
    recipient?: string;
    recipientName?: string;
    revealAt?: string;
    lockKeyword?: string;
    lockHint?: string;
  }
): JournalEntryRow | null {
  const now = new Date().toISOString();

  execute(
    `UPDATE journal_entries 
     SET title = ?, content = ?, updated_at = ?,
         subtype = COALESCE(?, subtype),
         recipient = COALESCE(?, recipient),
         recipient_name = COALESCE(?, recipient_name),
         reveal_at = COALESCE(?, reveal_at),
         lock_keyword = COALESCE(?, lock_keyword),
         lock_hint = COALESCE(?, lock_hint)
     WHERE id = ?`,
    [
      input.title ?? null,
      input.content,
      now,
      input.subtype ?? null,
      input.recipient ?? null,
      input.recipientName ?? null,
      input.revealAt ?? null,
      input.lockKeyword !== undefined ? input.lockKeyword : null,
      input.lockHint !== undefined ? input.lockHint : null,
      id,
    ]
  );

  return getJournalEntryById(id);
}

/**
 * Checks whether a letter is keyword-locked (for past_self or someone)
 */
export function isLetterKeywordLocked(entry: JournalEntryRow): boolean {
  if (entry.subtype !== 'letter') return false;
  return Boolean(entry.lock_keyword && entry.lock_keyword.trim().length > 0);
}

/**
 * Verifies if user entered keyword matches the letter's password
 */
export function verifyLetterKeyword(entry: JournalEntryRow, inputKeyword: string): boolean {
  if (!entry.lock_keyword) return true;
  return entry.lock_keyword.trim().toLowerCase() === inputKeyword.trim().toLowerCase();
}

/**
 * Checks whether a letter is currently sealed (reveal_at is in the future)
 */
export function isLetterSealed(entry: JournalEntryRow): boolean {
  if (entry.subtype !== 'letter') return false;
  if (!entry.reveal_at) return false;
  const revealTime = new Date(entry.reveal_at).getTime();
  return revealTime > Date.now();
}

/**
 * Returns human-readable countdown and status for time-capsule letters
 */
export function getLetterCountdown(revealAt: string | null | undefined): {
  text: string;
  daysLeft: number;
  isReady: boolean;
} {
  if (!revealAt) return { text: 'Delivered', daysLeft: 0, isReady: true };
  const diffMs = new Date(revealAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return { text: 'Ready to Open', daysLeft: 0, isReady: true };
  }
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft === 1) {
    return { text: 'Opens tomorrow', daysLeft: 1, isReady: false };
  }
  if (daysLeft < 30) {
    return { text: `Opens in ${daysLeft} days`, daysLeft, isReady: false };
  }
  const monthsLeft = Math.round(daysLeft / 30);
  return {
    text: `Opens in ~${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'}`,
    daysLeft,
    isReady: false,
  };
}

/**
 * Get all letter entries (with optional filter)
 */
export function getLetters(
  userId?: string,
  filter: 'all' | 'future_self' | 'someone' | 'past_self' | 'sealed' | 'opened' = 'all'
): JournalEntryRow[] {
  let query = "SELECT * FROM journal_entries WHERE subtype = 'letter'";
  const params: any[] = [];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY created_at DESC';
  const allLetters = queryAll<JournalEntryRow>(query, params);

  if (filter === 'all') return allLetters;
  if (filter === 'future_self') return allLetters.filter((l) => l.recipient === 'future_self');
  if (filter === 'someone') return allLetters.filter((l) => l.recipient === 'someone');
  if (filter === 'past_self') return allLetters.filter((l) => l.recipient === 'past_self');
  if (filter === 'sealed') return allLetters.filter(isLetterSealed);
  if (filter === 'opened') return allLetters.filter((l) => !isLetterSealed(l) && l.recipient !== 'past_self');

  return allLetters;
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
 * Check if a journal or letter was penned today
 */
export function hasTodayJournal(userId?: string): boolean {
  const today = getTodayDate();
  const result = userId
    ? queryFirst<{ id: string }>(
        'SELECT id FROM journal_entries WHERE date = ? AND user_id = ? LIMIT 1',
        [today, userId]
      )
    : queryFirst<{ id: string }>(
        'SELECT id FROM journal_entries WHERE date = ? LIMIT 1',
        [today]
      );
  return !!result;
}

/**
 * Get dot grid data for journal history visualization
 */
export function getJournalDotGrid(userId?: string, days: number = 48): JournalDotData[] {
  const startDate = getDateNDaysAgo(days);
  const today = getTodayDate();

  const entries = userId
    ? queryAll<{ date: string; content: string; title: string | null; mood_entry_id: string | null }>(
        'SELECT date, content, title, mood_entry_id FROM journal_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date',
        [startDate, today, userId]
      )
    : queryAll<{ date: string; content: string; title: string | null; mood_entry_id: string | null }>(
        'SELECT date, content, title, mood_entry_id FROM journal_entries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate, today]
      );

  const entryMap = new Map<string, { content: string; title: string | null; mood_entry_id: string | null }>();
  for (const e of entries) {
    entryMap.set(e.date, { content: e.content, title: e.title, mood_entry_id: e.mood_entry_id });
  }

  // Look up linked mood types for sentiment context
  const moodTypeMap = new Map<string, string>();
  const moodEntryIds = entries.filter((e) => e.mood_entry_id).map((e) => e.mood_entry_id!);
  if (moodEntryIds.length > 0) {
    const placeholders = moodEntryIds.map(() => '?').join(',');
    const moods = queryAll<{ id: string; mood_type: string }>(
      `SELECT id, mood_type FROM mood_entries WHERE id IN (${placeholders})`,
      moodEntryIds
    );
    for (const m of moods) {
      moodTypeMap.set(m.id, m.mood_type);
    }
  }

  const result: JournalDotData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getDateNDaysAgo(i);
    const entry = entryMap.get(dateStr);

    if (!entry) {
      result.push({ date: dateStr, sentiment: 'empty' });
    } else {
      const linkedMoodType = entry.mood_entry_id
        ? moodTypeMap.get(entry.mood_entry_id) ?? null
        : null;
      const sentiment = analyzeJournalSentiment(entry.content, entry.title, linkedMoodType);
      result.push({ date: dateStr, sentiment });
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
