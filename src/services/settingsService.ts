/**
 * MoodMap — Settings Service
 * Helper service to store and retrieve general app configurations in SQLite.
 */

import { queryFirst, execute } from '@/db/client';

/**
 * Retrieves a string setting from the database. Returns default value if not found or on error.
 */
export function getSetting(key: string, defaultValue: string): string {
  try {
    const row = queryFirst<{ value: string }>(
      'SELECT value FROM user_settings WHERE key = ?',
      [key]
    );
    return row ? row.value : defaultValue;
  } catch (error) {
    console.error(`[SettingsService] Failed to read key: ${key}`, error);
    return defaultValue;
  }
}

/**
 * Saves or updates a setting in the database.
 */
export function saveSetting(key: string, value: string): void {
  try {
    execute(
      'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  } catch (error) {
    console.error(`[SettingsService] Failed to write key: ${key}`, error);
  }
}
