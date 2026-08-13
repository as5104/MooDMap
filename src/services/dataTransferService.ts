/**
 * MoodMap — Data Transfer Service
 */

import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { queryAll, queryFirst, execute } from '@/db/client';
import { customAlert } from '@/components/ui';
import { getCustomAvatarUri, saveCustomAvatar } from './profileService';

const EXPORT_VERSION = 2;

interface ExportData {
  version: number;
  exportedAt: string;
  app: string;
  userId: string;
  data: {
    mood_entries: any[];
    journal_entries: any[];
    streaks: any[];
    badges: any[];
    user_settings: any[];
    music_preferences: any[];          // v2+: music taste survey data
    profile_picture_base64?: string;   // v2+: base64-encoded avatar image
    profile_picture_ext?: string;      // v2+: file extension e.g. '.jpg'
  };
}

/**
 * Export all data for a user as a JSON file and share it.
 */
export async function exportUserData(userId: string): Promise<boolean> {
  try {
    const moodEntries = queryAll(
      'SELECT * FROM mood_entries WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    const journalEntries = queryAll(
      'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    const streaks = queryAll('SELECT * FROM streaks WHERE user_id = ?', [userId]);
    const badges = queryAll('SELECT * FROM badges WHERE user_id = ?', [userId]);
    const userSettings = queryAll('SELECT * FROM user_settings');

    // v2: Music preferences (music taste survey)
    const musicPreferences = queryAll(
      'SELECT * FROM music_preferences WHERE user_id = ?',
      [userId]
    );

    // v2: Profile picture — read as base64
    let profilePictureBase64: string | undefined;
    let profilePictureExt: string | undefined;
    try {
      const avatarUri = getCustomAvatarUri();
      if (avatarUri) {
        // Detect extension
        const cleanUri = avatarUri.split('?')[0];
        const lastDot = cleanUri.lastIndexOf('.');
        profilePictureExt = lastDot !== -1 ? cleanUri.substring(lastDot).toLowerCase() : '.jpg';

        // Read as base64 — try fast native bridge first
        try {
          profilePictureBase64 = await LegacyFileSystem.readAsStringAsync(avatarUri, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
        } catch {
          // Fallback to arrayBuffer if legacy fails
          try {
            const file = new File(avatarUri);
            if (file.exists) {
              const arrayBuffer = await file.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              profilePictureBase64 = btoa(binary);
            }
          } catch {
            profilePictureBase64 = undefined;
            profilePictureExt = undefined;
          }
        }
      }
    } catch {
      // Avatar export is optional — don't fail the whole export
    }

    const exportPayload: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'MooDMap',
      userId,
      data: {
        mood_entries: moodEntries,
        journal_entries: journalEntries,
        streaks,
        badges,
        user_settings: userSettings,
        music_preferences: musicPreferences,
        profile_picture_base64: profilePictureBase64,
        profile_picture_ext: profilePictureExt,
      },
    };

    const totalItems =
      moodEntries.length + journalEntries.length + streaks.length + badges.length;

    const json = JSON.stringify(exportPayload, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `moodmap-backup-${dateStr}.json`;

    // Write to cache directory using new File API
    const file = new File(Paths.cache, fileName);
    if (file.exists) {
      file.delete();
    }
    file.write(json);

    // Share the file
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export MooDMap Data',
        UTI: 'public.json',
      });
    } else {
      await Share.share({ message: json, title: fileName });
    }

    customAlert(
      'Export Complete',
      `Exported ${totalItems} items (${moodEntries.length} moods, ${journalEntries.length} journals).`,
    );
    return true;
  } catch (error: any) {
    console.error('[Export] Failed:', error);
    customAlert('Export Failed', error.message || 'Could not export data.');
    return false;
  }
}

/**
 * Import data from a JSON backup file.
 * Merges with existing data — skips duplicates by ID.
 * Supports v1 (no music prefs/avatar) and v2+ backups.
 */
export async function importUserData(currentUserId: string): Promise<boolean> {
  try {
    // Use the new File.pickFileAsync API
    const result = await File.pickFileAsync({
      mimeTypes: ['application/json'],
    });

    if (!result || ('canceled' in result && result.canceled)) {
      return false;
    }

    // Read file content
    const pickedFile = result as any;
    let content: string;

    if (pickedFile.result && typeof pickedFile.result.text === 'function') {
      content = await pickedFile.result.text();
    } else if (typeof pickedFile.text === 'function') {
      content = await pickedFile.text();
    } else if (pickedFile.uri) {
      const f = new File(pickedFile.uri);
      content = await f.text();
    } else {
      customAlert('Error', 'Could not read the selected file.');
      return false;
    }

    let parsed: ExportData;
    try {
      parsed = JSON.parse(content);
    } catch {
      customAlert('Invalid File', 'This file is not a valid MooDMap backup.');
      return false;
    }

    if (parsed.app !== 'MooDMap' || !parsed.data) {
      customAlert('Invalid Backup', 'This file is not a valid MooDMap backup.');
      return false;
    }

    if (parsed.version > EXPORT_VERSION) {
      customAlert(
        'Newer Version',
        'This backup was created with a newer version of MooDMap. Please update the app first.',
      );
      return false;
    }

    const {
      mood_entries = [],
      journal_entries = [],
      streaks = [],
      badges = [],
      music_preferences = [],
      profile_picture_base64,
      profile_picture_ext,
    } = parsed.data;

    // Build summary for confirmation dialog
    const totalImportItems = mood_entries.length + journal_entries.length;

    return new Promise((resolve) => {
      customAlert(
        'Import Data',
        `Found ${totalImportItems} items (${mood_entries.length} moods, ${journal_entries.length} journals).\n\nExisting data will be preserved. Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Import',
            onPress: async () => {
              try {
                let imported = 0;

                for (const entry of mood_entries) {
                  const exists = queryAll('SELECT id FROM mood_entries WHERE id = ?', [entry.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO mood_entries (id, created_at, updated_at, date, mood_type, mood_score, energy_level, stress_level, tags, note, time_of_day, user_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        entry.id, entry.created_at, entry.updated_at, entry.date,
                        entry.mood_type, entry.mood_score, entry.energy_level,
                        entry.stress_level, entry.tags, entry.note, entry.time_of_day,
                        currentUserId,
                      ]
                    );
                    imported++;
                  }
                }

                for (const entry of journal_entries) {
                  const exists = queryAll('SELECT id FROM journal_entries WHERE id = ?', [entry.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO journal_entries (id, created_at, updated_at, date, title, content, mood_entry_id, prompt_used, images, user_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        entry.id, entry.created_at, entry.updated_at, entry.date,
                        entry.title, entry.content, entry.mood_entry_id,
                        entry.prompt_used, entry.images,
                        currentUserId,
                      ]
                    );
                    imported++;
                  }
                }

                for (const entry of streaks) {
                  const exists = queryAll(
                    "SELECT id FROM streaks WHERE user_id = ? AND type = ?",
                    [currentUserId, entry.type]
                  );
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO streaks (id, type, current_streak, longest_streak, last_active_date, total_entries, user_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        `streak_${entry.type}_${currentUserId}`,
                        entry.type, entry.current_streak, entry.longest_streak,
                        entry.last_active_date, entry.total_entries,
                        currentUserId,
                      ]
                    );
                    imported++;
                  } else {
                    execute(
                      `UPDATE streaks SET
                        current_streak = MAX(current_streak, ?),
                        longest_streak = MAX(longest_streak, ?),
                        total_entries = MAX(total_entries, ?)
                       WHERE user_id = ? AND type = ?`,
                      [
                        entry.current_streak, entry.longest_streak,
                        entry.total_entries, currentUserId, entry.type,
                      ]
                    );
                    imported++;
                  }
                }

                for (const entry of badges) {
                  const exists = queryAll(
                    'SELECT id FROM badges WHERE badge_key = ? AND user_id = ?',
                    [entry.badge_key, currentUserId]
                  );
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO badges (id, badge_key, unlocked_at, progress, target, user_id)
                       VALUES (?, ?, ?, ?, ?, ?)`,
                      [
                        `badge_${entry.badge_key}_${currentUserId}`,
                        entry.badge_key, entry.unlocked_at,
                        entry.progress, entry.target,
                        currentUserId,
                      ]
                    );
                    imported++;
                  }
                }

                // v2+: Restore music preferences (upsert)
                if (music_preferences.length > 0) {
                  for (const pref of music_preferences) {
                    try {
                      execute(
                        `INSERT OR REPLACE INTO music_preferences (user_id, preferences, updated_at)
                         VALUES (?, ?, ?)`,
                        [currentUserId, pref.preferences, pref.updated_at ?? new Date().toISOString()]
                      );
                      imported++;
                    } catch (prefErr) {
                      console.warn('[Import] Failed to restore music preferences:', prefErr);
                    }
                  }
                }

                // v2+: Restore profile picture
                if (profile_picture_base64 && profile_picture_ext) {
                  try {
                    // Decode base64 back to a temp file
                    const tempFileName = `import_avatar_${Date.now()}${profile_picture_ext}`;
                    const tempFile = new File(Paths.cache, tempFileName);

                    // Write base64 string directly using legacy API (supports base64 write)
                    await LegacyFileSystem.writeAsStringAsync(
                      tempFile.uri,
                      profile_picture_base64,
                      { encoding: LegacyFileSystem.EncodingType.Base64 }
                    );

                    // Save through profileService (handles extension, directory, settings key)
                    const mimeType =
                      profile_picture_ext === '.png' ? 'image/png'
                        : profile_picture_ext === '.webp' ? 'image/webp'
                          : 'image/jpeg';
                    await saveCustomAvatar(tempFile.uri, mimeType, profile_picture_ext);

                    // Clean up temp file
                    try { tempFile.delete(); } catch { /* ignore */ }
                  } catch (avatarErr) {
                    console.warn('[Import] Failed to restore profile picture:', avatarErr);
                    // Non-fatal — rest of import still succeeds
                  }
                }

                customAlert('Import Complete', `Imported ${imported} items.`);
                resolve(true);
              } catch (err: any) {
                console.error('[Import] Failed:', err);
                customAlert('Import Failed', err.message || 'Could not import data.');
                resolve(false);
              }
            },
          },
        ],
      );
    });
  } catch (error: any) {
    console.error('[Import] Failed:', error);
    customAlert('Import Failed', error.message || 'Could not import data.');
    return false;
  }
}
