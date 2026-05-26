/**
 * MoodMap — SQLite Database Client
 * Initializes the database connection and runs migrations
 */

import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'moodmap.db';

// Open or create the SQLite database
const sqliteDb = SQLite.openDatabaseSync(DB_NAME);

// Create the Drizzle ORM instance
export const db = drizzle(sqliteDb, { schema });

/**
 * Initialize database tables
 * Called once on app startup
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Create tables if they don't exist
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS mood_entries (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        date TEXT NOT NULL,
        mood_type TEXT NOT NULL,
        mood_score INTEGER NOT NULL,
        energy_level INTEGER,
        stress_level INTEGER,
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

      CREATE INDEX IF NOT EXISTS idx_mood_date ON mood_entries(date);
      CREATE INDEX IF NOT EXISTS idx_mood_user ON mood_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);
      CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);
    `);

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
};
