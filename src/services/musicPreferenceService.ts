/**
 * MoodMap — Music Preference Service
 */

import { queryFirst, execute } from '@/db/client';

// Types

export interface MusicPreferences {
  /** Selected genres from the survey */
  favoriteGenres: string[];

  /** Spotify artist IDs the user picked as favorites */
  favoriteArtistIds: string[];

  /** Parallel array of display names for favorite artists */
  favoriteArtistNames: string[];

  /** Preferred music languages */
  preferredLanguages: string[];

  /** Preferred decades */
  preferredDecades: string[];

  /** General energy preference: low / medium / high / any */
  energyPreference: 'low' | 'medium' | 'high' | 'any';

  /** Preference for vocals vs instrumental tracks */
  instrumentalPreference: 'vocals' | 'instrumental' | 'any';

  /** How much new music to suggest: familiar / balanced / adventurous */
  discoveryLevel: 'familiar' | 'balanced' | 'adventurous';

  /** ISO timestamp when preferences were last updated */
  updatedAt: string;
}

// Default preferences (used as fallback)

export const DEFAULT_PREFERENCES: MusicPreferences = {
  favoriteGenres: [],
  favoriteArtistIds: [],
  favoriteArtistNames: [],
  preferredLanguages: [],
  preferredDecades: [],
  energyPreference: 'any',
  instrumentalPreference: 'any',
  discoveryLevel: 'balanced',
  updatedAt: '',
};

// Persistence

/**
 * Save music preferences for a user.
 * Upserts into the music_preferences table.
 */
export function saveMusicPreferences(
  userId: string,
  prefs: Partial<MusicPreferences>
): void {
  try {
    const existing = getMusicPreferences(userId);
    const merged: MusicPreferences = {
      ...DEFAULT_PREFERENCES,
      ...existing,
      ...prefs,
      updatedAt: new Date().toISOString(),
    };
    execute(
      `INSERT OR REPLACE INTO music_preferences (user_id, preferences, updated_at)
       VALUES (?, ?, ?)`,
      [userId, JSON.stringify(merged), merged.updatedAt]
    );
  } catch (e) {
    console.error('[MusicPreferences] Failed to save:', e);
  }
}

/**
 * Load music preferences for a user.
 * Returns null if the user hasn't completed the survey.
 */
export function getMusicPreferences(
  userId: string
): MusicPreferences | null {
  try {
    const row = queryFirst<{ preferences: string }>(
      'SELECT preferences FROM music_preferences WHERE user_id = ?',
      [userId]
    );
    if (!row) return null;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(row.preferences) };
  } catch (e) {
    console.error('[MusicPreferences] Failed to load:', e);
    return null;
  }
}

/**
 * Check if a user has completed the music preference survey.
 */
export function hasMusicPreferences(userId: string): boolean {
  try {
    const row = queryFirst<{ user_id: string }>(
      'SELECT user_id FROM music_preferences WHERE user_id = ?',
      [userId]
    );
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Clear music preferences for a user (reset survey).
 */
export function clearMusicPreferences(userId: string): void {
  try {
    execute('DELETE FROM music_preferences WHERE user_id = ?', [userId]);
  } catch (e) {
    console.error('[MusicPreferences] Failed to clear:', e);
  }
}

/**
 * Get a summary of the user's preferences.
 */
export function getPreferenceSummary(userId: string): string {
  const prefs = getMusicPreferences(userId);
  if (!prefs) return '';

  const parts: string[] = [];
  if (prefs.favoriteGenres.length > 0) {
    parts.push(`${prefs.favoriteGenres.length} genre${prefs.favoriteGenres.length === 1 ? '' : 's'}`);
  }
  if (prefs.favoriteArtistIds.length > 0) {
    parts.push(`${prefs.favoriteArtistIds.length} artist${prefs.favoriteArtistIds.length === 1 ? '' : 's'}`);
  }
  if (prefs.preferredLanguages.length > 0) {
    parts.push(`${prefs.preferredLanguages.length} language${prefs.preferredLanguages.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

// Comprehensive master genre list — enriched dynamically with user's Spotify genres

export const MASTER_GENRES: string[] = [
  // Pop & Mainstream
  'pop', 'indie pop', 'synth-pop', 'electropop', 'dream pop', 'art pop', 'chamber pop',
  'k-pop', 'j-pop', 'c-pop', 'mandopop', 'cantopop',
  // Rock
  'rock', 'indie rock', 'alt-rock', 'classic rock', 'soft rock', 'hard rock', 'punk rock',
  'post-rock', 'psychedelic rock', 'progressive rock', 'garage rock', 'grunge', 'emo',
  // Hip-Hop & Rap
  'hip-hop', 'rap', 'trap', 'drill', 'grime', 'boom bap', 'conscious hip-hop',
  'lo-fi hip-hop', 'mumble rap', 'old school hip-hop',
  // Electronic & Dance
  'electronic', 'edm', 'house', 'deep house', 'tech house', 'progressive house',
  'techno', 'trance', 'dubstep', 'drum and bass', 'future bass', 'electro',
  'ambient electronic', 'synthwave', 'vaporwave', 'hardstyle',
  // R&B & Soul
  'r&b', 'neo soul', 'soul', 'funk', 'contemporary r&b', 'motown',
  // Jazz & Blues
  'jazz', 'smooth jazz', 'bebop', 'jazz fusion', 'vocal jazz', 'bossa nova',
  'blues', 'delta blues', 'electric blues',
  // Classical & Orchestral
  'classical', 'orchestral', 'opera', 'chamber music', 'baroque', 'romantic era',
  'contemporary classical', 'minimalism',
  // Country & Folk
  'country', 'folk', 'indie folk', 'americana', 'bluegrass', 'country pop',
  'singer-songwriter',
  // Latin
  'latin', 'reggaeton', 'latin pop', 'salsa', 'bachata', 'cumbia', 'merengue',
  'latin trap', 'brazilian', 'samba', 'mpb', 'forró',
  // Indian & South Asian
  'bollywood', 'indian pop', 'hindi', 'punjabi', 'tamil', 'telugu',
  'bengali', 'marathi', 'gujarati', 'kannada', 'malayalam', 'devotional',
  'indian classical', 'carnatic', 'hindustani', 'sufi', 'ghazal', 'qawwali',
  'filmi', 'indi-pop',
  // African
  'afrobeats', 'afropop', 'afro house', 'highlife', 'amapiano', 'soukous',
  // Middle Eastern & Central Asian
  'arabic', 'turkish', 'persian', 'israeli',
  // East Asian
  'anime', 'japanese', 'korean', 'chinese',
  // Caribbean
  'reggae', 'dancehall', 'soca', 'calypso',
  // Lo-fi & Chill
  'lo-fi', 'chillhop', 'chill', 'downtempo', 'trip-hop', 'chillwave',
  // Ambient & New Age
  'ambient', 'new age', 'meditation', 'nature sounds', 'sleep', 'healing',
  // Metal & Heavy
  'metal', 'heavy metal', 'death metal', 'black metal', 'metalcore',
  'nu metal', 'power metal', 'symphonic metal',
  // Other
  'disco', 'ska', 'world music', 'gospel', 'christian', 'worship',
  'soundtrack', 'musical theater', 'spoken word', 'podcast',
  'instrumental', 'acoustic', 'study', 'workout', 'piano',
];

// Comprehensive language list for music preferences

export const MUSIC_LANGUAGES: string[] = [
  'English', 'Hindi', 'Spanish', 'French', 'Portuguese', 'German', 'Italian',
  'Korean', 'Japanese', 'Chinese (Mandarin)', 'Chinese (Cantonese)',
  'Arabic', 'Turkish', 'Persian', 'Russian', 'Polish', 'Dutch', 'Swedish',
  'Norwegian', 'Danish', 'Finnish', 'Thai', 'Vietnamese', 'Indonesian', 'Malay',
  'Filipino', 'Tamil', 'Telugu', 'Bengali', 'Punjabi', 'Marathi', 'Gujarati',
  'Kannada', 'Malayalam', 'Urdu', 'Nepali', 'Sinhala',
  'Swahili', 'Yoruba', 'Zulu', 'Amharic',
  'Hebrew', 'Greek', 'Romanian', 'Hungarian', 'Czech', 'Ukrainian',
  'Instrumental / No Lyrics',
];

// Decade options

export const DECADE_OPTIONS: string[] = [
  '2020s', '2010s', '2000s', '90s', '80s', '70s', '60s & older',
];
