/**
 * MoodMap — Data Transfer Service (v3)
 * Full backup & restore for:
 * - Mood Entries (scores, metrics, tags, notes)
 * - Journal Entries (freewrite & prompts)
 * - Time Letters (future_self, past_self, someone, passwords & reveal dates)
 * - Comfort Box (comfort journals & comfort audio tracks)
 * - Memory Matrix Best Scores & User Settings
 * - Streaks & Badges
 * - Mood Music Tags & Music Preferences
 * - Custom Profile Avatar
 */

import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { queryAll, queryFirst, execute } from '@/db/client';
import { customAlert } from '@/components/ui';
import { getCustomAvatarUri, saveCustomAvatar } from './profileService';
import { getSetting, saveSetting } from './settingsService';

const EXPORT_VERSION = 3;

export interface ExportData {
  version: number;
  exportedAt: string;
  app: string;
  userId: string;
  data: {
    mood_entries: any[];
    journal_entries: any[];          // subtype !== 'letter'
    letters: any[];                  // subtype === 'letter' (Time Letters)
    comfort_tracks: any[];           // Comfort Box saved songs
    streaks: any[];
    badges: any[];
    user_settings: any[];            // Settings, Memory Matrix high score, custom timer
    mood_music_tags?: any[];         // Mood-tagged tracks
    music_preferences?: any[];       // VIP music taste preferences
    profile_picture_base64?: string; // base64-encoded avatar image
    profile_picture_ext?: string;    // file extension e.g. '.jpg'
  };
}

/**
 * Export all data for a user as a structured JSON file and share it.
 */
export async function exportUserData(userId: string): Promise<boolean> {
  try {
    // 1. Mood entries
    const moodEntries = queryAll(
      'SELECT * FROM mood_entries WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );

    // 2. Regular journals (excluding time letters)
    const journalEntries = queryAll(
      "SELECT * FROM journal_entries WHERE user_id = ? AND (subtype != 'letter' OR subtype IS NULL) ORDER BY date DESC",
      [userId]
    );

    // 3. Time Letters
    const letters = queryAll(
      "SELECT * FROM journal_entries WHERE user_id = ? AND subtype = 'letter' ORDER BY date DESC",
      [userId]
    );

    // 4. Comfort Tracks
    const comfortTracks = queryAll(
      'SELECT * FROM comfort_tracks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // 5. Streaks & Badges
    const streaks = queryAll('SELECT * FROM streaks WHERE user_id = ?', [userId]);
    const badges = queryAll('SELECT * FROM badges WHERE user_id = ?', [userId]);

    // 6. User settings (Memory matrix best level, custom pause timer, preferences)
    const userSettings = queryAll('SELECT * FROM user_settings');

    // 7. Mood-music tags & Music preferences
    const moodMusicTags = queryAll(
      'SELECT * FROM mood_music_tags WHERE user_id = ?',
      [userId]
    );
    const musicPreferences = queryAll(
      'SELECT * FROM music_preferences WHERE user_id = ?',
      [userId]
    );

    // 8. Custom Profile picture — read as base64
    let profilePictureBase64: string | undefined;
    let profilePictureExt: string | undefined;
    try {
      const avatarUri = getCustomAvatarUri();
      if (avatarUri) {
        const cleanUri = avatarUri.split('?')[0];
        const lastDot = cleanUri.lastIndexOf('.');
        profilePictureExt = lastDot !== -1 ? cleanUri.substring(lastDot).toLowerCase() : '.jpg';

        try {
          profilePictureBase64 = await LegacyFileSystem.readAsStringAsync(avatarUri, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
        } catch {
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
        letters: letters,
        comfort_tracks: comfortTracks,
        streaks,
        badges,
        user_settings: userSettings,
        mood_music_tags: moodMusicTags,
        music_preferences: musicPreferences,
        profile_picture_base64: profilePictureBase64,
        profile_picture_ext: profilePictureExt,
      },
    };

    const totalItems =
      moodEntries.length +
      journalEntries.length +
      letters.length +
      comfortTracks.length +
      streaks.length +
      badges.length;

    const json = JSON.stringify(exportPayload, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `moodmap-backup-${dateStr}.json`;

    // Write to cache directory using File API
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

    const summaryParts: string[] = [];
    if (moodEntries.length > 0) summaryParts.push(`${moodEntries.length} moods`);
    if (journalEntries.length > 0) summaryParts.push(`${journalEntries.length} journals`);
    if (letters.length > 0) summaryParts.push(`${letters.length} time letters`);
    if (comfortTracks.length > 0) summaryParts.push(`${comfortTracks.length} comfort songs`);

    customAlert(
      'Export Complete',
      `Exported ${totalItems} items (${summaryParts.join(', ')}).`,
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
 */
export async function importUserData(currentUserId: string): Promise<boolean> {
  try {
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
      letters = [],
      comfort_tracks = [],
      streaks = [],
      badges = [],
      user_settings = [],
      mood_music_tags = [],
      music_preferences = [],
      profile_picture_base64,
      profile_picture_ext,
    } = parsed.data;

    // Detect if letters were embedded in journal_entries (v1/v2 legacy backups)
    const separateJournals: any[] = [];
    const separateLetters: any[] = [...letters];

    for (const j of journal_entries) {
      if (j.subtype === 'letter') {
        // If not already in letters array, add it
        if (!separateLetters.some((l) => l.id === j.id)) {
          separateLetters.push(j);
        }
      } else {
        separateJournals.push(j);
      }
    }

    // Build rich summary for confirmation dialog
    const summaryParts: string[] = [];
    if (mood_entries.length > 0) summaryParts.push(`${mood_entries.length} moods`);
    if (separateJournals.length > 0) summaryParts.push(`${separateJournals.length} journals`);
    if (separateLetters.length > 0) summaryParts.push(`${separateLetters.length} time letters`);
    if (comfort_tracks.length > 0) summaryParts.push(`${comfort_tracks.length} comfort songs`);
    if (user_settings.length > 0) summaryParts.push(`user settings & scores`);

    const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') : 'backup data';

    return new Promise((resolve) => {
      customAlert(
        'Import Data',
        `Found: ${summaryText}.\n\nExisting data and letter lock states will be preserved. Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Import',
            onPress: async () => {
              try {
                let importedCount = 0;

                // 1. Restore Mood Entries
                for (const entry of mood_entries) {
                  const exists = queryAll('SELECT id FROM mood_entries WHERE id = ?', [entry.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO mood_entries (
                        id, created_at, updated_at, date, mood_type, mood_score,
                        energy_level, stress_level, sleep_hours, sleep_quality,
                        tags, note, time_of_day, user_id
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        entry.id,
                        entry.created_at,
                        entry.updated_at,
                        entry.date,
                        entry.mood_type,
                        entry.mood_score,
                        entry.energy_level ?? null,
                        entry.stress_level ?? null,
                        entry.sleep_hours ?? null,
                        entry.sleep_quality ?? null,
                        entry.tags ? (typeof entry.tags === 'string' ? entry.tags : JSON.stringify(entry.tags)) : null,
                        entry.note ?? null,
                        entry.time_of_day ?? null,
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 2. Restore Journal Entries (with is_comfort and prompt details)
                for (const entry of separateJournals) {
                  const exists = queryAll('SELECT id FROM journal_entries WHERE id = ?', [entry.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO journal_entries (
                        id, created_at, updated_at, date, title, content,
                        mood_entry_id, prompt_used, images, is_comfort,
                        last_shown_at, subtype, recipient, recipient_name,
                        reveal_at, lock_keyword, lock_hint, user_id
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        entry.id,
                        entry.created_at,
                        entry.updated_at,
                        entry.date,
                        entry.title ?? null,
                        entry.content,
                        entry.mood_entry_id ?? null,
                        entry.prompt_used ?? null,
                        entry.images ? (typeof entry.images === 'string' ? entry.images : JSON.stringify(entry.images)) : null,
                        entry.is_comfort ? 1 : 0,
                        entry.last_shown_at ?? null,
                        'journal',
                        null,
                        null,
                        null,
                        null,
                        null,
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 3. Restore Time Letters (Preserving exact reveal date, password lock & hints)
                for (const letter of separateLetters) {
                  const exists = queryAll('SELECT id FROM journal_entries WHERE id = ?', [letter.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO journal_entries (
                        id, created_at, updated_at, date, title, content,
                        mood_entry_id, prompt_used, images, is_comfort,
                        last_shown_at, subtype, recipient, recipient_name,
                        reveal_at, lock_keyword, lock_hint, user_id
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        letter.id,
                        letter.created_at,
                        letter.updated_at,
                        letter.date,
                        letter.title ?? null,
                        letter.content,
                        letter.mood_entry_id ?? null,
                        letter.prompt_used ?? null,
                        letter.images ? (typeof letter.images === 'string' ? letter.images : JSON.stringify(letter.images)) : null,
                        letter.is_comfort ? 1 : 0,
                        letter.last_shown_at ?? null,
                        'letter',
                        letter.recipient || 'future_self',
                        letter.recipient_name ?? null,
                        letter.reveal_at ?? null,
                        letter.lock_keyword ?? null,
                        letter.lock_hint ?? null,
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 4. Restore Comfort Tracks
                for (const track of comfort_tracks) {
                  const exists = queryAll('SELECT id FROM comfort_tracks WHERE id = ?', [track.id]);
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO comfort_tracks (
                        id, track_name, artist_name, track_source, album_art,
                        audio_url, duration, is_comfort, last_shown_at, created_at, user_id
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        track.id,
                        track.track_name,
                        track.artist_name,
                        track.track_source,
                        track.album_art ?? null,
                        track.audio_url ?? null,
                        track.duration ?? null,
                        track.is_comfort ?? 1,
                        track.last_shown_at ?? null,
                        track.created_at ?? new Date().toISOString(),
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 5. Restore User Settings (Memory Matrix high score, custom timer, etc.)
                for (const setting of user_settings) {
                  if (setting.key && setting.value != null) {
                    if (setting.key === 'memory_matrix_best_level') {
                      const currentBest = parseInt(getSetting('memory_matrix_best_level', '1'), 10) || 1;
                      const importedBest = parseInt(setting.value, 10) || 1;
                      saveSetting('memory_matrix_best_level', String(Math.max(currentBest, importedBest)));
                    } else {
                      saveSetting(setting.key, String(setting.value));
                    }
                    importedCount++;
                  }
                }

                // 6. Restore Streaks
                for (const entry of streaks) {
                  const exists = queryAll(
                    'SELECT id FROM streaks WHERE user_id = ? AND type = ?',
                    [currentUserId, entry.type]
                  );
                  if (exists.length === 0) {
                    execute(
                      `INSERT INTO streaks (id, type, current_streak, longest_streak, last_active_date, total_entries, user_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        `streak_${entry.type}_${currentUserId}`,
                        entry.type,
                        entry.current_streak,
                        entry.longest_streak,
                        entry.last_active_date,
                        entry.total_entries,
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  } else {
                    execute(
                      `UPDATE streaks SET
                        current_streak = MAX(current_streak, ?),
                        longest_streak = MAX(longest_streak, ?),
                        total_entries = MAX(total_entries, ?)
                       WHERE user_id = ? AND type = ?`,
                      [
                        entry.current_streak,
                        entry.longest_streak,
                        entry.total_entries,
                        currentUserId,
                        entry.type,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 7. Restore Badges
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
                        entry.badge_key,
                        entry.unlocked_at,
                        entry.progress,
                        entry.target,
                        currentUserId,
                      ]
                    );
                    importedCount++;
                  }
                }

                // 8. Restore Mood-Music Tags
                if (mood_music_tags && mood_music_tags.length > 0) {
                  for (const tag of mood_music_tags) {
                    const exists = queryAll('SELECT id FROM mood_music_tags WHERE id = ?', [tag.id]);
                    if (exists.length === 0) {
                      execute(
                        `INSERT INTO mood_music_tags (
                          id, mood_entry_id, mood_type, track_id, track_name,
                          artist_name, track_source, album_art, play_count, last_played_at, user_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          tag.id,
                          tag.mood_entry_id ?? null,
                          tag.mood_type,
                          tag.track_id,
                          tag.track_name,
                          tag.artist_name,
                          tag.track_source,
                          tag.album_art ?? null,
                          tag.play_count ?? 1,
                          tag.last_played_at ?? new Date().toISOString(),
                          currentUserId,
                        ]
                      );
                      importedCount++;
                    }
                  }
                }

                // 9. Restore Music Preferences (VIP users)
                if (music_preferences && music_preferences.length > 0) {
                  for (const pref of music_preferences) {
                    try {
                      execute(
                        `INSERT OR REPLACE INTO music_preferences (user_id, preferences, updated_at)
                         VALUES (?, ?, ?)`,
                        [currentUserId, pref.preferences, pref.updated_at ?? new Date().toISOString()]
                      );
                      importedCount++;
                    } catch (prefErr) {
                      console.warn('[Import] Failed to restore music preferences:', prefErr);
                    }
                  }
                }

                // 10. Restore Profile Picture
                if (profile_picture_base64 && profile_picture_ext) {
                  try {
                    const tempFileName = `import_avatar_${Date.now()}${profile_picture_ext}`;
                    const tempFile = new File(Paths.cache, tempFileName);

                    await LegacyFileSystem.writeAsStringAsync(
                      tempFile.uri,
                      profile_picture_base64,
                      { encoding: LegacyFileSystem.EncodingType.Base64 }
                    );

                    const mimeType =
                      profile_picture_ext === '.png'
                        ? 'image/png'
                        : profile_picture_ext === '.webp'
                          ? 'image/webp'
                          : 'image/jpeg';
                    await saveCustomAvatar(tempFile.uri, mimeType, profile_picture_ext);

                    try { tempFile.delete(); } catch { /* ignore */ }
                    importedCount++;
                  } catch (avatarErr) {
                    console.warn('[Import] Failed to restore profile picture:', avatarErr);
                  }
                }

                customAlert('Import Complete', `Successfully imported ${importedCount} items.`);
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
