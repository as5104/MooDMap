/**
 * MoodMap — SQLite Database Client
 * Uses expo-sqlite directly for reliable Android support
 */

import { Platform } from 'react-native';

const DB_NAME = 'moodmap.db';

let sqliteDb: any = null;

/**
 * Get the raw expo-sqlite database instance
 */
export const getDb = (): any => {
  if (!sqliteDb) {
    const SQLite = require('expo-sqlite');
    sqliteDb = SQLite.openDatabaseSync(DB_NAME);
  }
  return sqliteDb;
};

/**
 * Run a SELECT query and return all rows
 */
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  return db.getAllSync(sql, params) as T[];
}

/**
 * Run a SELECT query and return first row
 */
export function queryFirst<T = any>(sql: string, params: any[] = []): T | null {
  const db = getDb();
  return (db.getFirstSync(sql, params) as T) ?? null;
}

/**
 * Run an INSERT/UPDATE/DELETE statement
 */
export function execute(sql: string, params: any[] = []): void {
  const db = getDb();
  db.runSync(sql, params);
}

/**
 * Initialize database tables
 * Called once on app startup
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Skip DB init on web
    if (Platform.OS === 'web') {
      console.log('[DB] Skipping database init on web');
      return;
    }

    const db = getDb();

    db.execSync(`
      CREATE TABLE IF NOT EXISTS mood_entries (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        date TEXT NOT NULL,
        mood_type TEXT NOT NULL,
        mood_score INTEGER NOT NULL,
        energy_level INTEGER,
        stress_level INTEGER,
        sleep_hours REAL,
        sleep_quality INTEGER,
        tags TEXT,
        note TEXT,
        time_of_day TEXT,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        mood_entry_id TEXT,
        prompt_used TEXT,
        images TEXT,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS streaks (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT,
        total_entries INTEGER NOT NULL DEFAULT 0,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY NOT NULL,
        badge_key TEXT NOT NULL,
        unlocked_at TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journal_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        content TEXT NOT NULL DEFAULT '',
        prompt_used TEXT,
        updated_at TEXT NOT NULL,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS mood_music_tags (
        id TEXT PRIMARY KEY NOT NULL,
        mood_entry_id TEXT,
        mood_type TEXT NOT NULL,
        track_id TEXT NOT NULL,
        track_name TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        track_source TEXT NOT NULL,
        album_art TEXT,
        play_count INTEGER NOT NULL DEFAULT 1,
        last_played_at TEXT NOT NULL,
        user_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_mood_date ON mood_entries(date);
      CREATE INDEX IF NOT EXISTS idx_mood_user ON mood_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);
      CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);
      CREATE INDEX IF NOT EXISTS idx_drafts_user ON journal_drafts(user_id);
      CREATE INDEX IF NOT EXISTS idx_mmt_mood ON mood_music_tags(mood_type);
      CREATE INDEX IF NOT EXISTS idx_mmt_track ON mood_music_tags(track_id);
      CREATE INDEX IF NOT EXISTS idx_mmt_user ON mood_music_tags(user_id);

      CREATE TABLE IF NOT EXISTS music_preferences (
        user_id TEXT PRIMARY KEY NOT NULL,
        preferences TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recommendation_signals (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        track_id TEXT NOT NULL,
        mood_type TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spotify_user_data_cache (
        user_id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_recommended_tracks (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        track_id TEXT NOT NULL,
        track_title TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recsig_user ON recommendation_signals(user_id);
      CREATE INDEX IF NOT EXISTS idx_recsig_track ON recommendation_signals(track_id);
      CREATE INDEX IF NOT EXISTS idx_recsig_mood ON recommendation_signals(mood_type);
      CREATE INDEX IF NOT EXISTS idx_drt_user_date ON daily_recommended_tracks(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_drt_track ON daily_recommended_tracks(track_id);
    `);

    // Run safe migrations for existing tables
    try {
      db.execSync('ALTER TABLE mood_entries ADD COLUMN sleep_hours REAL;');
    } catch (_) {
      // Column already exists, safe to ignore
    }
    try {
      db.execSync('ALTER TABLE mood_entries ADD COLUMN sleep_quality INTEGER;');
    } catch (_) {
      // Column already exists, safe to ignore
    }

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
};
