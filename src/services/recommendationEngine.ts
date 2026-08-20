/**
 * MoodMap — Music Recommendation Engine
 *
 * 5-layer recommendation system:
 *   Layer 1: Rule-based mood → genre/keyword mapping (instant, no data needed)
 *   Layer 2: Personal learning from SQLite play history (grows over time)
 *   Layer 3: Preference-aware Spotify search (VIP only — smart query construction)
 *   Layer 4: Artist discovery via related artists (VIP only)
 *   Layer 5: Playlist mining — scores user's playlist tracks for mood (VIP only)
 */

import type { MoodType } from '@/constants/moods';
import type { Track } from '@/context/MusicContext';
import { execute, queryAll, queryFirst } from '@/db/client';
import type { MusicPreferences } from './musicPreferenceService';
import type { SpotifyPlaylist, SpotifyTrack } from './spotify';
import type { SpotifyUserDataSnapshot } from './spotifyDataCacheService';

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// TYPES

export interface MoodMusicProfile {
  genres: string[];
  keywords: string[];
  tempo: 'slow' | 'medium' | 'fast';
  energy: 'very low' | 'low' | 'medium' | 'high' | 'very high';
  /** Feather icon name for UI */
  icon: string;
  /** Short label for the recommendation section */
  label: string;
  /** Target valence range [min, max] — 0.0 to 1.0 */
  valence: [number, number];
  /** Target danceability range */
  danceability: [number, number];
}

export interface MoodMusicTag {
  id: string;
  moodEntryId: string | null;
  moodType: string;
  trackId: string;
  trackName: string;
  artistName: string;
  trackSource: 'local' | 'soundhelix' | 'spotify';
  albumArt: string | null;
  playCount: number;
  lastPlayedAt: string;
  userId: string | null;
}

export interface RecommendedTrack {
  track: Track;
  reason: string;
  source: 'rule' | 'personal' | 'spotify' | 'discovery' | 'playlist' | 'familiar';
  score: number; // 0-100
}

/** Optional controls for deliberately requesting a fresh recommendation batch. */
export interface RecommendationRequestOptions {
  /** Tracks already visible to the listener; these must not be suggested again. */
  excludeTrackIds?: string[];
  /** Varies query order and result offsets while preserving the current mood profile. */
  refreshSeed?: number;
  /** Previously sampled artists in current session, used to ensure >=50% new artists on Load More / Refresh. */
  previousArtistNames?: string[];
}

/** Internal scoring breakdown for a candidate track */
interface TrackScoreBreakdown {
  moodRelevance: number;      // 0-30
  preferenceMatch: number;    // 0-25
  personalAffinity: number;   // 0-20
  artistFamiliarity: number;  // 0-10
  freshness: number;          // -5 to +5
  contextBonus: number;       // 0-5
  trajectoryBonus: number;    // 0-5
  total: number;              // Clamped 0-100
}

/** Time-of-day context for contextual scoring */
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** Mood trajectory direction */
type MoodTrajectory = 'improving' | 'declining' | 'stable';

// LAYER 1: MOOD → GENRE MAPPING (Rule-Based)

export function getTodayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Generate a deterministic seed from the current date, mood, and refresh counter.
 * Changes daily at midnight, changes per mood, and shifts on refresh.
 */
export function getMoodDailySeed(mood?: MoodType, refreshSeed: number = 0): number {
  const today = getTodayDateString();
  const key = `${today}_${mood || 'any'}_${refreshSeed}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailySeed(): number {
  return getMoodDailySeed();
}

/**
 * Simple seeded random number generator (mulberry32).
 * Returns a function that produces deterministic floats in [0, 1).
 */
function seededRng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const MOOD_GENRE_MAP: Record<MoodType, MoodMusicProfile> = {
  anxious: {
    genres: ['ambient', 'lo-fi', 'nature sounds', 'classical'],
    keywords: ['calm', 'peaceful', 'meditation', 'sleep', 'soft', 'soothing', 'gentle'],
    tempo: 'slow',
    energy: 'low',
    icon: 'wind',
    label: 'Calming Picks',
    valence: [0.1, 0.4],
    danceability: [0.1, 0.3],
  },
  stressed: {
    genres: ['ambient', 'chill', 'acoustic', 'piano'],
    keywords: ['relax', 'unwind', 'zen', 'spa', 'soothing', 'relief', 'easy'],
    tempo: 'slow',
    energy: 'low',
    icon: 'sunset',
    label: 'Stress Relief',
    valence: [0.2, 0.5],
    danceability: [0.1, 0.4],
  },
  sad: {
    genres: ['acoustic', 'indie folk', 'piano', 'chill'],
    keywords: ['comfort', 'gentle', 'warm', 'soft', 'healing', 'melancholy', 'emotional'],
    tempo: 'slow',
    energy: 'medium',
    icon: 'cloud-rain',
    label: 'Comfort Sounds',
    valence: [0.0, 0.35],
    danceability: [0.1, 0.4],
  },
  happy: {
    genres: ['pop', 'indie pop', 'dance', 'funk'],
    keywords: ['upbeat', 'feel good', 'sunshine', 'happy', 'joy', 'celebration', 'bright'],
    tempo: 'fast',
    energy: 'high',
    icon: 'sun',
    label: 'Feel-Good Vibes',
    valence: [0.7, 1.0],
    danceability: [0.6, 1.0],
  },
  motivated: {
    genres: ['hip-hop', 'electronic', 'rock', 'workout'],
    keywords: ['energy', 'power', 'pump', 'beast mode', 'drive', 'hustle', 'intense'],
    tempo: 'fast',
    energy: 'high',
    icon: 'zap',
    label: 'Power Tracks',
    valence: [0.5, 0.9],
    danceability: [0.5, 0.9],
  },
  calm: {
    genres: ['jazz', 'bossa nova', 'lo-fi', 'classical'],
    keywords: ['smooth', 'chill', 'mellow', 'easy', 'lounge', 'serene', 'laid back'],
    tempo: 'medium',
    energy: 'low',
    icon: 'coffee',
    label: 'Mellow Mix',
    valence: [0.3, 0.6],
    danceability: [0.2, 0.5],
  },
  focused: {
    genres: ['lo-fi', 'electronic', 'minimal', 'study'],
    keywords: ['focus', 'concentrate', 'deep work', 'study', 'flow', 'productive', 'ambient'],
    tempo: 'medium',
    energy: 'medium',
    icon: 'target',
    label: 'Deep Focus',
    valence: [0.3, 0.6],
    danceability: [0.2, 0.5],
  },
  angry: {
    genres: ['rock', 'metal', 'punk', 'electronic'],
    keywords: ['intense', 'rage', 'heavy', 'loud', 'cathartic', 'aggressive', 'raw'],
    tempo: 'fast',
    energy: 'very high',
    icon: 'volume-2',
    label: 'Release Energy',
    valence: [0.1, 0.5],
    danceability: [0.3, 0.7],
  },
  peaceful: {
    genres: ['new age', 'ambient', 'nature', 'meditation'],
    keywords: ['serene', 'tranquil', 'zen', 'mindful', 'stillness', 'harmony', 'calm'],
    tempo: 'slow',
    energy: 'very low',
    icon: 'feather',
    label: 'Inner Peace',
    valence: [0.3, 0.6],
    danceability: [0.1, 0.3],
  },
  tired: {
    genres: ['ambient', 'sleep', 'lo-fi', 'piano'],
    keywords: ['rest', 'sleep', 'lullaby', 'dream', 'gentle', 'quiet', 'night'],
    tempo: 'slow',
    energy: 'very low',
    icon: 'moon',
    label: 'Wind Down',
    valence: [0.1, 0.4],
    danceability: [0.0, 0.3],
  },
};

// Category - mood affinity for scoring local library tracks

const CATEGORY_MOOD_AFFINITY: Record<string, Partial<Record<MoodType, number>>> = {
  midnight: {
    calm: 85, peaceful: 90, sad: 70, tired: 80, anxious: 60,
    focused: 50, stressed: 55,
  },
  chill: {
    calm: 90, peaceful: 80, happy: 60, focused: 65,
    sad: 55, tired: 60, stressed: 70,
  },
  energy: {
    motivated: 95, happy: 85, focused: 70, angry: 60,
  },
  heartbeat: {
    motivated: 80, happy: 75, focused: 60, angry: 50, stressed: 40,
  },
  ambient: {
    peaceful: 95, calm: 90, anxious: 75, stressed: 80,
    tired: 85, sad: 65, focused: 70,
  },
  local: {
    happy: 40, calm: 40, focused: 40, peaceful: 40,
    sad: 40, tired: 40, anxious: 40, angry: 40,
    stressed: 40, motivated: 40,
  },
};

// CONTEXT HELPERS

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Moods that pair well with each time-of-day context */
const TIME_MOOD_AFFINITY: Record<TimeOfDay, MoodType[]> = {
  morning: ['calm', 'peaceful', 'focused', 'happy', 'motivated'],
  afternoon: ['focused', 'motivated', 'happy', 'calm'],
  evening: ['calm', 'peaceful', 'happy', 'sad', 'tired'],
  night: ['tired', 'calm', 'peaceful', 'sad', 'anxious'],
};

/**
 * Compute the user's mood trajectory based on recent mood entries.
 * Compares today's mood score against the average of recent entries.
 */
function computeMoodTrajectory(userId: string | null, todayScore: number): MoodTrajectory {
  try {
    const result = queryFirst<{ avg_score: number }>(
      `SELECT AVG(mood_score) as avg_score FROM mood_entries
       WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL))
         AND date >= date('now', '-7 days')
         AND date < date('now')`,
      [userId, userId]
    );
    if (!result || result.avg_score === null) return 'stable';
    const diff = todayScore - result.avg_score;
    if (diff > 1.5) return 'improving';
    if (diff < -1.5) return 'declining';
    return 'stable';
  } catch {
    return 'stable';
  }
}

// LAYER 1: RULE-BASED RECOMMENDATIONS

/**
 * Score and sort existing local library tracks by mood affinity.
 */
export function getRuleBasedRecommendations(
  mood: MoodType,
  availableTracks: Track[],
  limit: number = 8
): RecommendedTrack[] {
  const profile = MOOD_GENRE_MAP[mood];
  if (!profile) return [];

  const scored: RecommendedTrack[] = availableTracks.map((track) => {
    const categoryAffinities = CATEGORY_MOOD_AFFINITY[track.category] ?? {};
    const affinityScore = categoryAffinities[mood] ?? 30;

    const titleLower = track.title.toLowerCase();
    const artistLower = track.artist.toLowerCase();
    const keywordBonus = profile.keywords.some(
      (kw) => titleLower.includes(kw) || artistLower.includes(kw)
    ) ? 15 : 0;

    return {
      track,
      reason: `Matches your ${mood} mood`,
      source: 'rule' as const,
      score: Math.min(affinityScore + keywordBonus, 100),
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// LAYER 2: PERSONAL LEARNING

/**
 * Record that a track was played during a specific mood.
 */
export function tagTrackToMood(
  moodType: MoodType,
  track: Track,
  moodEntryId: string | null,
  userId: string | null
): void {
  try {
    const source: 'local' | 'soundhelix' | 'spotify' =
      track.category === 'local' ? 'local' :
        track.id.startsWith('spotify_') ? 'spotify' : 'soundhelix';

    const existing = queryFirst<{ id: string; play_count: number }>(
      `SELECT id, play_count FROM mood_music_tags
       WHERE mood_type = ? AND track_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [moodType, track.id, userId, userId]
    );

    if (existing) {
      execute(
        `UPDATE mood_music_tags
         SET play_count = play_count + 1, last_played_at = ?, mood_entry_id = ?
         WHERE id = ?`,
        [new Date().toISOString(), moodEntryId, existing.id]
      );
    } else {
      execute(
        `INSERT INTO mood_music_tags
         (id, mood_entry_id, mood_type, track_id, track_name, artist_name,
          track_source, album_art, play_count, last_played_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          generateId(), moodEntryId, moodType, track.id, track.title, track.artist,
          source, track.cover, new Date().toISOString(), userId,
        ]
      );
    }
  } catch (e) {
    console.error('[Recommendations] Failed to tag track:', e);
  }
}

/**
 * Get tracks the user frequently plays during a specific mood.
 */
export function getPersonalMoodTracks(
  mood: MoodType,
  userId: string | null,
  limit: number = 5
): MoodMusicTag[] {
  try {
    return queryAll<MoodMusicTag>(
      `SELECT * FROM mood_music_tags
       WHERE mood_type = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
       ORDER BY play_count DESC, last_played_at DESC
       LIMIT ?`,
      [mood, userId, userId, limit]
    );
  } catch (e) {
    console.error('[Recommendations] Failed to query personal tracks:', e);
    return [];
  }
}

/**
 * Get total mood-music tag count for a user.
 */
export function getMoodMusicTagCount(userId: string | null): number {
  try {
    const result = queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM mood_music_tags
       WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)`,
      [userId, userId]
    );
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Build personal recommendations from stored mood-track associations.
 */
export function getPersonalRecommendations(
  mood: MoodType,
  availableTracks: Track[],
  userId: string | null,
  limit: number = 5
): RecommendedTrack[] {
  const personalTags = getPersonalMoodTracks(mood, userId, limit);
  if (personalTags.length === 0) return [];

  const trackMap = new Map(availableTracks.map((t) => [t.id, t]));
  const results: RecommendedTrack[] = [];

  for (const tag of personalTags) {
    const track = trackMap.get(tag.trackId);
    if (track) {
      results.push({
        track,
        reason: `You play this when ${mood} (${tag.playCount}x)`,
        source: 'personal',
        score: Math.min(60 + tag.playCount * 8, 100),
      });
    }
  }

  return results;
}

// LAYER 1+2 COMBINED (for non-VIP users)

/**
 * Get blended recommendations from Layers 1+2 (non-VIP).
 */
export function getSmartRecommendations(
  mood: MoodType,
  availableTracks: Track[],
  userId: string | null,
  limit: number = 8,
  options: RecommendationRequestOptions = {},
): RecommendedTrack[] {
  // Build a wider candidate pool before excluding the current cards. Previously
  // this stopped at the first `limit` tracks, so a refresh had nothing new to
  // choose even when the local library contained valid alternatives.
  const personal = getPersonalRecommendations(mood, availableTracks, userId, Math.max(limit * 3, 12));
  const ruleBased = getRuleBasedRecommendations(mood, availableTracks, availableTracks.length);

  const seen = new Set(personal.map((r) => r.track.id));
  const merged = [...personal];

  for (const rec of ruleBased) {
    if (!seen.has(rec.track.id) && merged.length < limit) {
      seen.add(rec.track.id);
      merged.push(rec);
    }
  }

  const excluded = new Set(options.excludeTrackIds ?? []);
  const fresh = merged.filter(rec => !excluded.has(rec.track.id));
  // Never quietly put the old cards back into a user-requested refresh. If the
  // local library has been exhausted, the UI can clearly show fewer cards.
  return fresh.sort((a, b) => b.score - a.score).slice(0, limit);
}

// SIGNAL TRACKING (Skip / Complete / Favorite)

/**
 * Record a recommendation signal (skip, complete, or favorite).
 */
export function recordRecommendationSignal(
  userId: string | null,
  trackId: string,
  moodType: string,
  signalType: 'skip' | 'complete' | 'favorite'
): void {
  try {
    execute(
      `INSERT INTO recommendation_signals (id, user_id, track_id, mood_type, signal_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), userId, trackId, moodType, signalType, new Date().toISOString()]
    );
  } catch (e) {
    console.error('[Recommendations] Failed to record signal:', e);
  }
}

/**
 * Get signal counts for a track during a mood.
 * Returns { skips, completions, favorites }.
 */
function getTrackSignals(
  userId: string | null,
  trackId: string,
  moodType: string
): { skips: number; completions: number; favorites: number } {
  try {
    const rows = queryAll<{ signal_type: string; count: number }>(
      `SELECT signal_type, COUNT(*) as count FROM recommendation_signals
       WHERE track_id = ? AND mood_type = ?
         AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
       GROUP BY signal_type`,
      [trackId, moodType, userId, userId]
    );
    const result = { skips: 0, completions: 0, favorites: 0 };
    for (const row of rows) {
      if (row.signal_type === 'skip') result.skips = row.count;
      if (row.signal_type === 'complete') result.completions = row.count;
      if (row.signal_type === 'favorite') result.favorites = row.count;
    }
    return result;
  } catch {
    return { skips: 0, completions: 0, favorites: 0 };
  }
}

// RECOMMENDATION CACHE

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _searchCache = new Map<string, CacheEntry<SpotifyTrack[]>>();
const _artistTrackCache = new Map<string, CacheEntry<SpotifyTrack[]>>();
let _lastRecommendedTrackIds: string[] = [];
let _lastRecommendedAt = 0;

const SEARCH_CACHE_TTL = 60 * 60 * 1000;       // 1 hour
const ARTIST_TRACK_CACHE_TTL = 60 * 60 * 1000;  // 1 hour (was 6h — shorter TTL ensures mid-day re-logs fetch fresh songs)

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/** Clear all recommendation caches (called on mood/preference change) */
export function clearRecommendationCache(): void {
  _searchCache.clear();
  _artistTrackCache.clear();
  _lastRecommendedTrackIds = [];
  _lastRecommendedAt = 0;
}

// MULTI-SIGNAL SCORING

/**
 * Score a Spotify track across 7 dimensions for a given mood + preferences.
 */
function scoreSpotifyTrack(
  spotifyTrack: SpotifyTrack,
  mood: MoodType,
  moodScore: number,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
  isFromPlaylist: boolean = false,
  playlistName?: string,
): { score: TrackScoreBreakdown; reason: string; source: RecommendedTrack['source'] } {
  const profile = MOOD_GENRE_MAP[mood];
  const trackNameLower = spotifyTrack.name.toLowerCase();
  const artistNames = spotifyTrack.artists.map(a => a.name);
  const artistNamesLower = artistNames.map(a => a.toLowerCase());
  const artistGenres = spotifyTrack.artists.flatMap(a => a.genres ?? []);

  // 1. Mood Relevance (0-30)
  let moodRelevance = 0;
  // Keyword match in title
  const titleKeywordMatch = profile.keywords.some(kw => trackNameLower.includes(kw));
  if (titleKeywordMatch) moodRelevance += 12;
  // Keyword match in artist name
  const artistKeywordMatch = profile.keywords.some(kw =>
    artistNamesLower.some(an => an.includes(kw))
  );
  if (artistKeywordMatch) moodRelevance += 8;
  // Genre overlap with mood genres
  const moodGenreOverlap = artistGenres.filter(g =>
    profile.genres.some(mg => g.toLowerCase().includes(mg.toLowerCase()) || mg.toLowerCase().includes(g.toLowerCase()))
  ).length;
  moodRelevance += Math.min(moodGenreOverlap * 5, 15);
  moodRelevance = Math.min(moodRelevance, 30);

  // 2. Preference Match (0-25)
  let preferenceMatch = 0;
  let dominantReason = '';
  if (preferences) {
    // Artist in favorites
    const isFavoriteArtist = spotifyTrack.artists.some(a =>
      preferences.favoriteArtistIds.includes(a.id)
    );
    if (isFavoriteArtist) {
      preferenceMatch += 15;
      const matchedArtist = artistNames.find((_, i) =>
        preferences.favoriteArtistIds.includes(spotifyTrack.artists[i]?.id)
      );
      dominantReason = `Because you like ${matchedArtist || artistNames[0]}`;
    }

    // Genre overlap with preferred genres
    const prefGenreOverlap = artistGenres.filter(g =>
      preferences.favoriteGenres.some(pg =>
        g.toLowerCase().includes(pg.toLowerCase()) || pg.toLowerCase().includes(g.toLowerCase())
      )
    ).length;
    if (prefGenreOverlap > 0) {
      preferenceMatch += Math.min(prefGenreOverlap * 5, 10);
      if (!dominantReason) {
        const matchedGenre = preferences.favoriteGenres.find(pg =>
          artistGenres.some(ag =>
            ag.toLowerCase().includes(pg.toLowerCase()) || pg.toLowerCase().includes(ag.toLowerCase())
          )
        );
        dominantReason = `Matches your ${matchedGenre || 'preferred genre'} taste`;
      }
    }

    // Release year in preferred decade
    if (preferences.preferredDecades.length > 0 && spotifyTrack.album?.release_date) {
      const year = parseInt(spotifyTrack.album.release_date.substring(0, 4), 10);
      const matchesDecade = preferences.preferredDecades.some(d => {
        if (d === '60s & older') return year < 1970;
        const decadeStart = parseInt(d.replace('s', ''), 10);
        const fullDecade = decadeStart < 100 ? 1900 + decadeStart : decadeStart;
        return year >= fullDecade && year < fullDecade + 10;
      });
      if (matchesDecade) preferenceMatch += 3;
    }
  }
  preferenceMatch = Math.min(preferenceMatch, 25);

  // 3. Personal Affinity (0-20)
  let personalAffinity = 0;
  const trackId = `spotify_${spotifyTrack.id}`;
  const signals = getTrackSignals(userId, trackId, mood);
  if (signals.favorites > 0) personalAffinity += 15;
  if (signals.completions > 0) personalAffinity += Math.min(signals.completions * 4, 12);
  if (signals.skips > 0) personalAffinity -= Math.min(signals.skips * 8, 20);

  // Check mood_music_tags for play history
  try {
    const tag = queryFirst<{ play_count: number }>(
      `SELECT play_count FROM mood_music_tags
       WHERE track_id = ? AND mood_type = ?
         AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [trackId, mood, userId, userId]
    );
    if (tag) {
      personalAffinity += Math.min(tag.play_count * 4, 12);
      if (!dominantReason && tag.play_count >= 2) {
        dominantReason = `You play this when ${mood} (${tag.play_count}x)`;
      }
    }
  } catch { /* non-critical */ }
  personalAffinity = Math.max(Math.min(personalAffinity, 20), -10);

  // 4. Artist Familiarity (0-10)
  let artistFamiliarity = 0;
  if (preferences) {
    const isFav = spotifyTrack.artists.some(a => preferences.favoriteArtistIds.includes(a.id));
    if (isFav) artistFamiliarity += 10;
  }
  // Also check if we've seen this artist in play history
  try {
    const artistTag = queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM mood_music_tags
       WHERE artist_name = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [artistNames[0], userId, userId]
    );
    if (artistTag && artistTag.count > 0 && artistFamiliarity < 10) {
      artistFamiliarity += Math.min(artistTag.count, 5);
    }
  } catch { /* non-critical */ }
  artistFamiliarity = Math.min(artistFamiliarity, 10);

  // 5. Freshness (-5 to +5)
  let freshness = 5; // Start with full freshness bonus
  if (_lastRecommendedTrackIds.includes(spotifyTrack.id)) {
    const hoursSinceLast = (Date.now() - _lastRecommendedAt) / (1000 * 60 * 60);
    if (hoursSinceLast < 1) freshness = -5;       // Recommended within the hour
    else if (hoursSinceLast < 6) freshness = -2;   // Within 6 hours
    else if (hoursSinceLast < 24) freshness = 0;   // Within 24 hours
    else freshness = 3;                             // Over 24 hours ago
  }

  // 6. Context Bonus (0-5)
  let contextBonus = 0;
  const timeMoods = TIME_MOOD_AFFINITY[timeContext];
  if (timeMoods.includes(mood)) contextBonus += 2;
  // High intensity mood → boost strongly matching tracks
  if (moodScore >= 8 && moodRelevance >= 20) contextBonus += 3;
  else if (moodScore >= 6 && moodRelevance >= 15) contextBonus += 1;
  contextBonus = Math.min(contextBonus, 5);

  // 7. Trajectory Bonus (0-5)
  let trajectoryBonus = 0;
  if (trajectory === 'declining') {
    // Boost uplifting tracks when mood is declining
    const upliftingMoods: MoodType[] = ['happy', 'motivated', 'calm', 'peaceful'];
    const isUplifting = profile.keywords.some(kw =>
      ['upbeat', 'happy', 'joy', 'energy', 'calm', 'peaceful'].includes(kw)
    );
    if (isUplifting || upliftingMoods.includes(mood)) trajectoryBonus += 3;
    if (titleKeywordMatch) trajectoryBonus += 2;
  } else if (trajectory === 'improving') {
    // Reinforce current mood direction
    trajectoryBonus += 2;
  }
  trajectoryBonus = Math.min(trajectoryBonus, 5);

  // Total
  const total = Math.max(0, Math.min(100,
    moodRelevance + preferenceMatch + personalAffinity +
    artistFamiliarity + freshness + contextBonus + trajectoryBonus
  ));

  // Generate explanation
  let reason = dominantReason;
  if (!reason) {
    if (isFromPlaylist && playlistName) {
      reason = `From your playlist "${playlistName}"`;
    } else if (moodRelevance >= 20) {
      reason = `Great for ${mood} moods`;
    } else if (preferenceMatch >= 15) {
      reason = `Matches your music taste`;
    } else if (artistFamiliarity >= 5) {
      reason = `Artist you might know`;
    } else if (freshness >= 4) {
      reason = `New for you`;
    } else {
      reason = `Recommended for you`;
    }
  }

  const source: RecommendedTrack['source'] =
    isFromPlaylist ? 'playlist' :
      artistFamiliarity >= 8 ? 'personal' :
        preferenceMatch >= 10 ? 'spotify' : 'discovery';

  return {
    score: {
      moodRelevance, preferenceMatch, personalAffinity,
      artistFamiliarity, freshness, contextBonus, trajectoryBonus, total,
    },
    reason,
    source,
  };
}

// TRACK QUALITY FILTERS

/**
 * Patterns that indicate a compilation, playlist-type, or junk track rather than
 * an actual official single/album song. Case-insensitive matching.
 */
const JUNK_TRACK_PATTERNS = [
  /\btop\s*(\d+|hits?|music|songs?)\b/i,
  /\bbest\s*(of|songs?|hits?|tracks?)\b/i,
  /\bgreatest\s*hits?\b/i,
  /\bhits?\s*(collection|compilation|mix|medley)\b/i,
  /\b(mega|super|ultimate)\s*mix\b/i,
  /\bnon[\s-]*stop\b/i,
  /\bmedley\b/i,
  /\b(dj\s*mix|mashup|mash[\s-]*up)\b/i,
  /\b(workout|gym|running)\s*mix\b/i,
  /\b(party|club)\s*mix\b/i,
  /\bcountdown\b/i,
  /\bjukebox\b/i,
  /\b(karaoke|tribute)\b/i,
  /\b(8d|slowed|reverb|sped\s*up)\s*(audio|version|remix)?\b/i,
  /\bringtone\b/i,
];

/** Album names that indicate a compilation rather than a real album */
const JUNK_ALBUM_PATTERNS = [
  /\btop\s*(\d+|hits?)\b/i,
  /\bgreatest\s*hits?\b/i,
  /\bnow\s*that'?s?\s*what\s*i\s*call/i,
  /\b(hits?|songs?)\s*(of|from)\s*(the\s*)?\d{4}/i,
  /\b(various\s*artists?|compilation)\b/i,
];

/**
 * Returns true if the track looks like a compilation, junk, or non-official track.
 * Checks both track name and album name.
 */
function isJunkOrCompilationTrack(track: SpotifyTrack): boolean {
  const name = track.name || '';
  const albumName = track.album?.name || '';

  // Reject if track name matches junk patterns
  if (JUNK_TRACK_PATTERNS.some(p => p.test(name))) return true;

  // Reject if album name matches compilation patterns
  if (JUNK_ALBUM_PATTERNS.some(p => p.test(albumName))) return true;

  // Reject very short tracks (likely intros, skits, or sound effects — under 45 seconds)
  if (track.duration_ms && track.duration_ms < 45000) return true;

  // Reject tracks with no real artist ("Various Artists")
  if (track.artists.length === 1 && /various\s*artists?/i.test(track.artists[0].name)) return true;

  return false;
}

/**
 * Create a normalized fingerprint from track name + primary artist for deduplication.
 * This catches the same song appearing under different album releases or IDs.
 */
function getTrackFingerprint(track: SpotifyTrack): string {
  const name = (track.name || '').toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')   // remove parenthetical info like (feat. X), (Remix)
    .replace(/\s*\[.*?\]\s*/g, '')   // remove bracket info like [Deluxe]
    .replace(/[^a-z0-9]/g, '');       // strip punctuation & whitespace
  const artist = (track.artists[0]?.name || '').toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${artist}_${name}`;
}

/**
 * Validate and deduplicate a batch of SpotifyTracks.
 * Rejects junk/compilation tracks and removes name+artist duplicates.
 */
function filterAndDedup(
  tracks: SpotifyTrack[],
  seenIds: Set<string>,
  seenFingerprints: Set<string>,
): SpotifyTrack[] {
  const accepted: SpotifyTrack[] = [];
  for (const track of tracks) {
    if (!track || !track.id) continue;
    if (seenIds.has(track.id)) continue;
    if (track.type === 'episode' || track.is_local) continue;
    if (isJunkOrCompilationTrack(track)) continue;

    const fp = getTrackFingerprint(track);
    if (seenFingerprints.has(fp)) continue;

    seenIds.add(track.id);
    seenFingerprints.add(fp);
    accepted.push(track);
  }
  return accepted;
}

// SPOTIFY TRACK - APP TRACK CONVERTER

function spotifyTrackToAppTrack(st: SpotifyTrack): Track {
  const { getBestImage, formatDuration } = require('./spotify');
  return {
    id: `spotify_${st.id}`,
    title: st.name,
    artist: st.artists.map(a => a.name).join(', '),
    url: st.uri,
    cover: getBestImage(st.album?.images ?? [], 300) ?? '',
    duration: formatDuration(st.duration_ms),
    durationSec: Math.floor(st.duration_ms / 1000),
    category: 'spotify' as const,
  };
}

// LAYER 3: PREFERENCE-AWARE SPOTIFY SEARCH

/**
 * Build smart search queries by fusing mood profile + user preferences.
 */
/**
 * Build high-yield search queries by fusing mood profile + user preferences.
 * Produces clean terms that Spotify and online music APIs return results for.
 */
function buildMoodSearchQueries(
  mood: MoodType,
  preferences: MusicPreferences | null,
  refreshSeed?: number,
  spotifyUserData?: SpotifyUserDataSnapshot,
): string[] {
  const profile = MOOD_GENRE_MAP[mood];
  const queries: string[] = [];

  const mainKw = profile.keywords[0] ?? mood;

  // 1. Direct artist searches for user's favorite artists from survey
  if (preferences?.favoriteArtistNames?.length) {
    for (const artist of preferences.favoriteArtistNames.slice(0, 5)) {
      queries.push(`artist:"${artist}"`);
      queries.push(`${artist}`);
      queries.push(`${artist} ${mainKw}`);
    }
  }

  // 1b. Inject artists from Spotify user data (recently played / top artists)
  if (spotifyUserData) {
    // Add top artists from short-term listening
    const topArtistNames = spotifyUserData.topArtistsShort
      .map(a => a.name)
      .filter(name => !preferences?.favoriteArtistNames?.includes(name))
      .slice(0, 3);
    for (const artist of topArtistNames) {
      queries.push(`${artist} ${mainKw}`);
      queries.push(`${artist}`);
    }

    // Add genres from user's current top artists
    const liveGenres = Array.from(new Set(
      spotifyUserData.topArtistsShort.flatMap(a => a.genres)
    )).slice(0, 4);
    for (const genre of liveGenres) {
      if (!preferences?.favoriteGenres?.includes(genre)) {
        queries.push(`${genre} ${mainKw}`);
      }
    }

    // Add recently played artists for variety
    const recentArtists = Array.from(new Set(
      spotifyUserData.recentlyPlayed.flatMap(t => t.artistNames)
    )).filter(name =>
      !preferences?.favoriteArtistNames?.includes(name) &&
      !topArtistNames.includes(name)
    ).slice(0, 2);
    for (const artist of recentArtists) {
      queries.push(`${artist} ${mainKw}`);
    }
  }

  // 2. Favorite genres + mood
  if (preferences?.favoriteGenres?.length) {
    for (const genre of preferences.favoriteGenres.slice(0, 4)) {
      queries.push(`${genre} ${mainKw}`);
      queries.push(`${genre}`);
    }
  }

  // 3. Preferred language + mood
  if (preferences?.preferredLanguages?.length) {
    for (const lang of preferences.preferredLanguages.slice(0, 2)) {
      if (lang !== 'Instrumental / No Lyrics') {
        queries.push(`${lang} ${mainKw}`);
      }
    }
  }

  // 4. Default mood profile genres & keywords
  for (const genre of profile.genres.slice(0, 3)) {
    queries.push(`${genre} ${mainKw}`);
    queries.push(`${genre}`);
  }
  for (const kw of profile.keywords.slice(0, 3)) {
    queries.push(`${kw} music`);
  }

  const uniqueQueries = Array.from(new Set(queries));

  // Apply daily seed + optional refresh seed for deterministic daily variation
  const dailySeed = getDailySeed();
  const combinedSeed = refreshSeed ? dailySeed + refreshSeed : dailySeed;
  const rng = seededRng(combinedSeed);

  // Fisher-Yates shuffle with seeded RNG
  const shuffled = [...uniqueQueries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Dynamically sample up to 15 artists from survey with >=50% new artist rotation
 * on refresh/pagination, weighted by user listening taste and current mood.
 */
export function selectDynamicSurveyArtists(
  allSurveyArtists: string[],
  previousArtistNames: string[] = [],
  spotifyUserData?: SpotifyUserDataSnapshot | null,
  mood?: MoodType,
  targetCount: number = 15,
): { selectedArtists: string[]; nextPreviousArtists: string[] } {
  const cleanAll = allSurveyArtists.map(a => a.replace(/"/g, '').trim()).filter(Boolean);
  if (cleanAll.length <= targetCount) {
    return { selectedArtists: cleanAll, nextPreviousArtists: cleanAll };
  }

  const prevSet = new Set(previousArtistNames.map(a => a.toLowerCase().trim()));
  const unseen = cleanAll.filter(a => !prevSet.has(a.toLowerCase().trim()));
  const seen = cleanAll.filter(a => prevSet.has(a.toLowerCase().trim()));

  // In-place Fisher-Yates shuffle
  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledUnseen = shuffle(unseen);
  const shuffledSeen = shuffle(seen);

  const selected: string[] = [];

  if (previousArtistNames.length > 0 && cleanAll.length > targetCount) {
    // Rotation mode: guarantee at least 50% (Math.ceil(targetCount / 2) = 8) from unseen
    const minUnseenCount = Math.min(Math.ceil(targetCount / 2), shuffledUnseen.length);
    selected.push(...shuffledUnseen.slice(0, minUnseenCount));

    // Fill remaining from unseen if available, else seen
    const remainingNeeded = targetCount - selected.length;
    const moreUnseen = shuffledUnseen.slice(minUnseenCount, minUnseenCount + remainingNeeded);
    selected.push(...moreUnseen);

    if (selected.length < targetCount) {
      const seenNeeded = targetCount - selected.length;
      selected.push(...shuffledSeen.slice(0, seenNeeded));
    }
  } else {
    // Initial generation: prioritize artists with recent listening / taste affinity
    const prioritized: string[] = [];
    const regular: string[] = [];

    const topListeningArtistNames = new Set(
      (spotifyUserData?.topArtistsShort || []).map(a => a.name.toLowerCase().trim())
    );

    for (const artist of cleanAll) {
      if (topListeningArtistNames.has(artist.toLowerCase().trim())) {
        prioritized.push(artist);
      } else {
        regular.push(artist);
      }
    }

    const shuffledPrioritized = shuffle(prioritized);
    const shuffledRegular = shuffle(regular);

    selected.push(...shuffledPrioritized.slice(0, 5)); // up to 5 affinity artists
    const remaining = targetCount - selected.length;
    selected.push(...shuffledRegular.slice(0, remaining));

    // If still short, backfill from remaining prioritized
    if (selected.length < targetCount) {
      selected.push(...shuffledPrioritized.slice(5, 5 + (targetCount - selected.length)));
    }
  }

  // Rolling history of previous artists (keep last 30 to allow long-term cycles)
  const nextPrevious = Array.from(new Set([...previousArtistNames, ...selected])).slice(-30);

  return {
    selectedArtists: selected.slice(0, targetCount),
    nextPreviousArtists: nextPrevious,
  };
}

/**
 * Universal online mood search fallback (via Deezer) when Spotify search is 429 or offline.
 * Guarantees real playable music with album art rather than SoundHelix sample files.
 */
async function fetchOnlineMoodTracksFallback(
  mood: MoodType,
  limit: number = 20,
): Promise<RecommendedTrack[]> {
  try {
    const profile = MOOD_GENRE_MAP[mood];
    const moodKeyword = profile?.keywords?.[0] ?? mood;
    const genre = profile?.genres?.[0] ?? 'pop';

    const queries = [`${genre} ${moodKeyword}`, `${moodKeyword} hits`, `${genre} chill`];
    const allTracks: RecommendedTrack[] = [];
    const seenIds = new Set<string>();

    const results = await Promise.allSettled(
      queries.map(async (q) => {
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10&index=0`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.data || [];
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const item of r.value) {
          if (!item || !item.id || seenIds.has(`dz_${item.id}`)) continue;
          seenIds.add(`dz_${item.id}`);

          const { formatDuration } = require('./spotify');
          const track: Track = {
            id: `spotify_dz_${item.id}`,
            title: item.title,
            artist: item.artist?.name || 'Artist',
            url: item.preview || item.link,
            cover: item.album?.cover_big || item.album?.cover_medium || '',
            duration: formatDuration((item.duration || 180) * 1000),
            durationSec: item.duration || 180,
            category: 'spotify',
          };

          allTracks.push({
            track,
            reason: `Great for ${mood} moods`,
            source: 'discovery',
            score: 75,
          });

          if (allTracks.length >= limit) break;
        }
      }
    }

    return allTracks.slice(0, limit);
  } catch (e) {
    console.warn('[Recommendations] Online fallback failed:', e);
    return [];
  }
}

// DIVERSITY ENFORCEMENT

/**
 * Enforce diversity rules on the final recommendation list.
 * - Max 3 tracks per artist
 * - No duplicate songs by name+artist fingerprint
 * - Mix of sources (personal, discovery, playlist)
 */
function enforceDiversity(tracks: RecommendedTrack[], limit: number, maxPerArtist: number = 3): RecommendedTrack[] {
  const artistCounts = new Map<string, number>();
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: RecommendedTrack[] = [];

  // Pass 1: Pick tracks respecting maxPerArtist and name dedup, preferring new artists
  for (const rec of tracks) {
    if (result.length >= limit) break;
    if (seenIds.has(rec.track.id)) continue;

    const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
    const count = artistCounts.get(artist) ?? 0;
    if (count >= maxPerArtist) continue;

    const nameKey = `${artist}_${rec.track.title.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')}`;
    if (seenNames.has(nameKey)) continue;

    // If we haven't reached minDistinctArtists yet, prefer new artists over repeat artists
    if (count > 0 && artistCounts.size < Math.ceil(limit / 2) && result.length < limit - 4) {
      continue;
    }

    seenIds.add(rec.track.id);
    seenNames.add(nameKey);
    artistCounts.set(artist, count + 1);
    result.push(rec);
  }

  // Pass 2: Pick any remaining valid tracks up to maxPerArtist
  if (result.length < limit) {
    for (const rec of tracks) {
      if (result.length >= limit) break;
      if (seenIds.has(rec.track.id)) continue;

      const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
      const count = artistCounts.get(artist) ?? 0;
      if (count >= maxPerArtist) continue;

      const nameKey = `${artist}_${rec.track.title.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')}`;
      if (seenNames.has(nameKey)) continue;

      seenIds.add(rec.track.id);
      seenNames.add(nameKey);
      artistCounts.set(artist, count + 1);
      result.push(rec);
    }
  }

  // Pass 3 (Guarantee Full Count): If still short of limit, backfill remaining candidates
  if (result.length < limit) {
    for (const rec of tracks) {
      if (result.length >= limit) break;
      if (seenIds.has(rec.track.id)) continue;

      const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
      const nameKey = `${artist}_${rec.track.title.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')}`;
      if (seenNames.has(nameKey)) continue;

      seenIds.add(rec.track.id);
      seenNames.add(nameKey);
      result.push(rec);
    }
  }

  return result;
}

// PROPORTION-BASED RECOMMENDATION ARCHITECTURE

/**
 * Record tracks recommended today in SQLite to prevent repeating them on the same day.
 */
export function recordDailyRecommendedTracks(
  userId: string | null,
  tracks: RecommendedTrack[]
): void {
  try {
    const today = getTodayDateString();
    for (const rec of tracks) {
      execute(
        `INSERT OR IGNORE INTO daily_recommended_tracks (id, user_id, track_id, track_title, artist_name, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          userId,
          rec.track.id,
          rec.track.title,
          rec.track.artist,
          today,
          new Date().toISOString(),
        ]
      );
    }

    // Prune entries older than 3 days to keep DB compact
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    execute('DELETE FROM daily_recommended_tracks WHERE date < ?', [cutoff]);
  } catch (e) {
    console.warn('[Recommendations] Failed to record daily recommended tracks:', e);
  }
}

/**
 * Get all track IDs and name+artist fingerprints recommended today for this user.
 */
export function getTodayRecommendedHistory(
  userId: string | null
): { seenIds: Set<string>; seenFingerprints: Set<string> } {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  try {
    const today = getTodayDateString();
    const rows = queryAll<{ track_id: string; track_title: string; artist_name: string }>(
      `SELECT track_id, track_title, artist_name FROM daily_recommended_tracks
       WHERE date = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [today, userId, userId]
    );

    for (const row of rows) {
      seenIds.add(row.track_id);
      const cleanArtist = row.artist_name.split(',')[0].trim().toLowerCase();
      const cleanTitle = row.track_title.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
      seenFingerprints.add(`${cleanArtist}_${cleanTitle}`);
    }
  } catch (e) {
    console.warn('[Recommendations] Failed to get today recommended history:', e);
  }
  return { seenIds, seenFingerprints };
}

// Helper: small non-blocking delay to prevent burst spikes
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch fresh, mood-aligned tracks by sampled survey artists.
 * Queries up to 15 artists in at most 3 batched OR queries to keep Spotify API calls minimal.
 */
async function fetchSurveyArtistMoodTracks(
  accessToken: string,
  mood: MoodType,
  moodScore: number,
  artistNames: string[],
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
  refreshSeed?: number,
  historySeenIds?: Set<string>,
  historySeenFingerprints?: Set<string>,
): Promise<RecommendedTrack[]> {
  if (artistNames.length === 0) return [];
  const { searchTracks } = require('./spotify');
  const profile = MOOD_GENRE_MAP[mood];
  const moodLabel = profile.label ?? mood;

  // Randomized keyword + offset per invocation for maximum song diversity
  // 7 keywords × 2 offsets = 14 unique combinations per artist per mood
  const availableKeywords = profile.keywords.length > 0 ? profile.keywords : [mood];

  const allTracks: SpotifyTrack[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  // Process sampled artists in chunks of 5 (max 3 chunks for 15 artists)
  const cleanAll = artistNames.map(a => a.replace(/"/g, '').trim()).filter(Boolean).slice(0, 15);
  const CHUNK_SIZE = 5;
  const artistChunks: string[][] = [];
  for (let i = 0; i < cleanAll.length; i += CHUNK_SIZE) {
    artistChunks.push(cleanAll.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of artistChunks) {
    // Pick a random keyword and safe offset (0 or 5) for each chunk
    const moodKeyword = availableKeywords[Math.floor(Math.random() * availableKeywords.length)];
    const resultOffset = Math.floor(Math.random() * 2) * 5; // 0 or 5 — safe within Spotify's limit

    const chunkKey = chunk.map(a => a.toLowerCase()).sort().join('_');
    const cacheKey = `survey_chunk_${chunkKey}_${mood}_${moodKeyword}_${resultOffset}`;
    const cached = getCached<SpotifyTrack[]>(_artistTrackCache, cacheKey);

    if (cached && cached.length > 0) {
      const filtered = filterAndDedup(cached, seenIds, seenFingerprints);
      allTracks.push(...filtered);
      continue;
    }

    let tracks: SpotifyTrack[] = [];
    if (accessToken) {
      // Query artists directly using OR clauses: artist:"A" OR artist:"B" OR artist:"C" OR artist:"D" OR artist:"E"
      // Spotify returns the top tracks for these artists, which are then scored and ranked for mood by scoreSpotifyTrack!
      const artistClauses = chunk.map(name => `artist:"${name}"`).join(' OR ');

      tracks = await searchTracks(accessToken, artistClauses, 10, resultOffset).catch(() => []);
      if (tracks.length < 3) {
        // Fallback: search without quotes if multi-artist OR had low yield
        const altOffset = resultOffset === 0 ? 5 : 0;
        const fallbackQuery = chunk.join(' OR ');
        const fallbackTracks: SpotifyTrack[] = await searchTracks(accessToken, fallbackQuery, 10, altOffset).catch(() => []);
        tracks = [...tracks, ...fallbackTracks];
      }
    }

    // Online fallback via Deezer if Spotify is offline / rate limited / returned empty
    if (tracks.length === 0) {
      const deezerResults = await Promise.allSettled(
        chunk.map(async (artistName) => {
          const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${artistName}`)}&limit=6&index=0`);
          if (!res.ok) return [];
          const data = await res.json();
          if (!data?.data?.length) return [];
          return data.data.map((item: any) => ({
            id: `dz_${item.id}`,
            name: item.title,
            artists: [{ id: `dz_art_${item.artist?.id || 0}`, name: item.artist?.name || artistName }],
            album: {
              id: `dz_alb_${item.album?.id || 0}`,
              name: item.album?.title || 'Single',
              images: [{ url: item.album?.cover_big || item.album?.cover_medium || '' }],
            },
            duration_ms: (item.duration || 180) * 1000,
            uri: item.preview || item.link,
            popularity: 80,
            type: 'track' as const,
          }));
        })
      );

      for (const r of deezerResults) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          tracks.push(...r.value);
        }
      }
    }

    if (tracks.length > 0) {
      setCache(_artistTrackCache, cacheKey, tracks, ARTIST_TRACK_CACHE_TTL);
      const filtered = filterAndDedup(tracks, seenIds, seenFingerprints);
      allTracks.push(...filtered);
    }

    // Small 80ms throttle to prevent burst spikes
    await sleep(80);
  }

  // Score tracks against mood
  return allTracks.map(st => {
    const { score } = scoreSpotifyTrack(st, mood, moodScore, preferences, userId, timeContext, trajectory);
    const primaryArtist = st.artists?.[0]?.name || 'Your favorite artist';
    return {
      track: spotifyTrackToAppTrack(st),
      reason: `By ${primaryArtist} • ${moodLabel} vibe`,
      source: 'spotify' as const,
      score: score.total + 10, // boost user-selected artists
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Fetch and score tracks from the user's daily Spotify listening snapshot (favorites / top listened).
 */
function fetchSpotifyUserMoodTracks(
  spotifyUserData: SpotifyUserDataSnapshot | undefined,
  mood: MoodType,
  moodScore: number,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
  historySeenIds?: Set<string>,
  historySeenFingerprints?: Set<string>,
): RecommendedTrack[] {
  if (!spotifyUserData) return [];
  const tracks: RecommendedTrack[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  const allCached = [
    ...spotifyUserData.topTracksShort,
    ...spotifyUserData.topTracksMedium,
    ...spotifyUserData.recentlyPlayed,
  ];

  for (const cached of allCached) {
    if (!cached || seenIds.has(cached.id) || seenIds.has(`spotify_${cached.id}`)) continue;
    const cleanArtist = cached.artistNames[0]?.toLowerCase().trim() || '';
    const cleanTitle = cached.name.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    const fp = `${cleanArtist}_${cleanTitle}`;
    if (seenFingerprints.has(fp)) continue;

    seenIds.add(cached.id);
    seenIds.add(`spotify_${cached.id}`);
    seenFingerprints.add(fp);

    const appTrack: Track = {
      id: `spotify_${cached.id}`,
      title: cached.name,
      artist: cached.artistNames.join(', '),
      url: cached.uri || `spotify:track:${cached.id}`,
      cover: cached.coverUrl || '',
      duration: cached.duration || '3:30',
      durationSec: cached.durationMs ? Math.floor(cached.durationMs / 1000) : 210,
      category: 'spotify' as const,
    };

    const mockSpotifyTrack: SpotifyTrack = {
      id: cached.id,
      name: cached.name,
      artists: cached.artistNames.map((name, i) => ({ id: cached.artistIds[i] || '', name })),
      album: { id: '', name: '', images: cached.coverUrl ? [{ url: cached.coverUrl, width: 300, height: 300 }] : [] },
      duration_ms: cached.durationMs || 210000,
      uri: cached.uri,
      preview_url: null,
      external_urls: { spotify: `https://open.spotify.com/track/${cached.id}` },
      type: 'track',
    };

    const { score } = scoreSpotifyTrack(mockSpotifyTrack, mood, moodScore, preferences, userId, timeContext, trajectory);

    tracks.push({
      track: appTrack,
      reason: 'From your Spotify favorites',
      source: 'familiar' as const,
      score: score.total + 5,
    });
  }

  return tracks.sort((a, b) => b.score - a.score);
}

/**
 * Fetch mood discovery tracks from outside the user's picked artists & top history.
 * Consolidates queries to minimize Spotify API requests.
 */
async function fetchDiscoveryMoodTracks(
  accessToken: string,
  mood: MoodType,
  moodScore: number,
  excludedArtists: Set<string>,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
  refreshSeed?: number,
  historySeenIds?: Set<string>,
  historySeenFingerprints?: Set<string>,
): Promise<RecommendedTrack[]> {
  const profile = MOOD_GENRE_MAP[mood];
  const { searchTracks } = require('./spotify');
  // Randomize keyword for discovery too — ensures different genre+keyword combos each time
  const availableKeywords = profile.keywords.length > 0 ? profile.keywords : [mood];
  const moodKeyword = availableKeywords[Math.floor(Math.random() * availableKeywords.length)];
  // Clamp offset to 0 or 5 (Spotify standard API rejects offset > 10)
  const resultOffset = Math.floor(Math.random() * 2) * 5;

  // 2 clean, high-yield discovery queries (genre-based and keyword-based)
  const genre1 = profile.genres[0] ?? 'pop';
  const kw1 = profile.keywords[0] ?? mood;
  const kw2 = profile.keywords[1] ?? 'chill';
  const query1 = `genre:"${genre1}" ${kw1}`;
  const query2 = `${kw1} ${kw2} music`;
  const discoveryQueries = [query1, query2];

  const allTracks: SpotifyTrack[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  if (accessToken) {
    for (const query of discoveryQueries) {
      const cacheKey = `discovery_${mood}_${query}_${resultOffset}`;
      const cached = getCached<SpotifyTrack[]>(_searchCache, cacheKey);

      if (cached && cached.length > 0) {
        const filtered = filterAndDedup(cached, seenIds, seenFingerprints);
        allTracks.push(...filtered);
        continue;
      }

      const tracks: SpotifyTrack[] = await searchTracks(accessToken, query, 10, resultOffset).catch(() => []);
      if (tracks.length > 0) {
        setCache(_searchCache, cacheKey, tracks, SEARCH_CACHE_TTL);
        const filtered = filterAndDedup(tracks, seenIds, seenFingerprints);
        allTracks.push(...filtered);
      }

      // Small throttle between discovery queries
      await sleep(60);
    }
  }

  // Filter out any track whose primary artist is in excludedArtists, but retain all if filtered is empty
  let candidateTracks = allTracks.filter(st => {
    const primary = st.artists?.[0]?.name?.toLowerCase()?.trim() || '';
    return !excludedArtists.has(primary);
  });
  if (candidateTracks.length === 0) {
    candidateTracks = allTracks;
  }

  return candidateTracks.map(st => {
    const { score } = scoreSpotifyTrack(st, mood, moodScore, preferences, userId, timeContext, trajectory);
    return {
      track: spotifyTrackToAppTrack(st),
      reason: `Fresh discovery for your ${mood} mood`,
      source: 'discovery' as const,
      score: score.total,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Proportionately blends Artist Picks, Spotify Listening Data, and Discovery tracks
 * with intelligent soft deduplication (never drops to empty on duplicate check).
 *
 *   - Balanced (Default): 65% Artist Picks, 30% Spotify User Data, 5% Discovery
 *   - Familiar: 60% Artist Picks, 40% Spotify User Data, 0% Discovery
 *   - Adventurous: 70% Artist Picks, 10% Spotify User Data, 20% Discovery
 */
function proportionateBlend(
  artistPool: RecommendedTrack[],
  spotifyPool: RecommendedTrack[],
  discoveryPool: RecommendedTrack[],
  discoveryLevel: 'familiar' | 'balanced' | 'adventurous',
  limit: number,
  excludeTrackIds: Set<string>,
): RecommendedTrack[] {
  let artistRatio = 0.65;
  let spotifyRatio = 0.30;
  let discoveryRatio = 0.05;

  if (discoveryLevel === 'familiar') {
    artistRatio = 0.60;
    spotifyRatio = 0.40;
    discoveryRatio = 0.00;
  } else if (discoveryLevel === 'adventurous') {
    artistRatio = 0.70;
    spotifyRatio = 0.10;
    discoveryRatio = 0.20;
  }

  // Calculate quota numbers
  let targetArtist = Math.round(limit * artistRatio);
  let targetDiscovery = Math.round(limit * discoveryRatio);
  let targetSpotify = limit - targetArtist - targetDiscovery;

  const usedTrackIds = new Set<string>(excludeTrackIds);
  const pickedIds = new Set<string>();
  const artistCounts = new Map<string, number>();
  const maxPerArtist = 3;

  function pickTracksFromPool(pool: RecommendedTrack[], targetCount: number, strictFresh: boolean = true): RecommendedTrack[] {
    const picked: RecommendedTrack[] = [];
    for (const rec of pool) {
      if (picked.length >= targetCount) break;
      if (pickedIds.has(rec.track.id)) continue;
      if (strictFresh && usedTrackIds.has(rec.track.id)) continue;

      const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
      const currentCount = artistCounts.get(artist) ?? 0;
      if (currentCount >= maxPerArtist) continue;

      pickedIds.add(rec.track.id);
      artistCounts.set(artist, currentCount + 1);
      picked.push(rec);
    }
    return picked;
  }

  // Pass 1: Strict freshness (avoid tracks shown earlier today)
  const selectedArtist = pickTracksFromPool(artistPool, targetArtist, true);
  const selectedSpotify = pickTracksFromPool(spotifyPool, targetSpotify, true);
  const selectedDiscovery = pickTracksFromPool(discoveryPool, targetDiscovery, true);

  // Pass 2: Quota backfill using unseen tracks from other pools
  const remainingNeeded = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
  if (remainingNeeded > 0) {
    const backfillArtist = pickTracksFromPool(artistPool, remainingNeeded, true);
    selectedArtist.push(...backfillArtist);
    const stillNeeded1 = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
    if (stillNeeded1 > 0) {
      const backfillSpotify = pickTracksFromPool(spotifyPool, stillNeeded1, true);
      selectedSpotify.push(...backfillSpotify);
      const stillNeeded2 = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
      if (stillNeeded2 > 0) {
        const backfillDisc = pickTracksFromPool(discoveryPool, stillNeeded2, true);
        selectedDiscovery.push(...backfillDisc);
      }
    }
  }

  // Pass 3 (Soft Backfill): If quota is still not met (e.g. today's history excluded candidates),
  // backfill from the candidate pools ignoring strict daily exclusion so the user ALWAYS gets 20 tracks!
  const softNeeded = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
  if (softNeeded > 0) {
    const softArtist = pickTracksFromPool(artistPool, softNeeded, false);
    selectedArtist.push(...softArtist);
    const stillSoft1 = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
    if (stillSoft1 > 0) {
      const softSpotify = pickTracksFromPool(spotifyPool, stillSoft1, false);
      selectedSpotify.push(...softSpotify);
      const stillSoft2 = limit - (selectedArtist.length + selectedSpotify.length + selectedDiscovery.length);
      if (stillSoft2 > 0) {
        const softDisc = pickTracksFromPool(discoveryPool, stillSoft2, false);
        selectedDiscovery.push(...softDisc);
      }
    }
  }

  // Interleave proportionally for a smooth, natural playlist flow
  const result: RecommendedTrack[] = [];
  let aIdx = 0, sIdx = 0, dIdx = 0;

  while (result.length < limit && (aIdx < selectedArtist.length || sIdx < selectedSpotify.length || dIdx < selectedDiscovery.length)) {
    if (aIdx < selectedArtist.length && result.length < limit) result.push(selectedArtist[aIdx++]);
    if (aIdx < selectedArtist.length && result.length < limit) result.push(selectedArtist[aIdx++]);

    if (sIdx < selectedSpotify.length && result.length < limit) result.push(selectedSpotify[sIdx++]);

    if (dIdx < selectedDiscovery.length && (result.length % 5 === 0 || aIdx >= selectedArtist.length) && result.length < limit) {
      result.push(selectedDiscovery[dIdx++]);
    }
  }

  // Append any leftovers
  while (result.length < limit && aIdx < selectedArtist.length) result.push(selectedArtist[aIdx++]);
  while (result.length < limit && sIdx < selectedSpotify.length) result.push(selectedSpotify[sIdx++]);
  while (result.length < limit && dIdx < selectedDiscovery.length) result.push(selectedDiscovery[dIdx++]);

  return result.slice(0, limit);
}

// VIP SMART RECOMMENDATIONS (Top-Level Orchestrator)

/**
 * Get advanced personalized recommendations for VIP users.
 * Orchestrates dynamic artist sampling, Spotify listening data, and discovery in exact proportions.
 */
export async function getVIPSmartRecommendations(
  mood: MoodType,
  moodScore: number,
  localTracks: Track[],
  userId: string,
  spotifyToken: string,
  userPlaylists: SpotifyPlaylist[],
  preferences: MusicPreferences | null,
  limit: number = 20,
  options: RecommendationRequestOptions = {},
  spotifyUserData?: SpotifyUserDataSnapshot,
): Promise<RecommendedTrack[]> {
  try {
    const timeContext = getTimeOfDay();
    const trajectory = computeMoodTrajectory(userId, moodScore);
    const discoveryLevel = preferences?.discoveryLevel || 'balanced';

    // 1. Load today's recommendation history to prioritize new songs
    const todayHistory = getTodayRecommendedHistory(userId);
    const excludedIds = new Set<string>([
      ...Array.from(todayHistory.seenIds),
      ...(options.excludeTrackIds ?? []),
    ]);

    // 2. Determine survey artists with dynamic sampling (15 artists max with >=50% new artist rotation)
    let sampledArtistNames: string[] = [];
    const allSurveyArtists = (preferences?.favoriteArtistNames || []).filter(Boolean);

    if (allSurveyArtists.length > 0) {
      const samplingResult = selectDynamicSurveyArtists(
        allSurveyArtists,
        options.previousArtistNames || [],
        spotifyUserData,
        mood,
        15
      );
      sampledArtistNames = samplingResult.selectedArtists;
    } else if (spotifyUserData && spotifyUserData.topArtistsShort.length > 0) {
      // No survey fallback: use user's Spotify top artists
      sampledArtistNames = spotifyUserData.topArtistsShort.map(a => a.name).slice(0, 15);
    } else {
      // Generic fallback
      const profile = MOOD_GENRE_MAP[mood];
      sampledArtistNames = profile.keywords.slice(0, 5);
    }

    const excludedArtistsSet = new Set(sampledArtistNames.map(name => name.toLowerCase().trim()));
    if (spotifyUserData) {
      spotifyUserData.topArtistsShort.forEach(a => excludedArtistsSet.add(a.name.toLowerCase().trim()));
    }

    // 3. Fetch the 3 core pools in parallel
    const [artistPool, spotifyPool, discoveryPool] = await Promise.all([
      fetchSurveyArtistMoodTracks(
        spotifyToken, mood, moodScore, sampledArtistNames, preferences, userId, timeContext, trajectory,
        options.refreshSeed, todayHistory.seenIds, todayHistory.seenFingerprints
      ).catch(e => {
        console.warn('[Recommendations] Survey artist pool failed:', e);
        return [] as RecommendedTrack[];
      }),
      Promise.resolve(
        fetchSpotifyUserMoodTracks(
          spotifyUserData, mood, moodScore, preferences, userId, timeContext, trajectory,
          todayHistory.seenIds, todayHistory.seenFingerprints
        )
      ),
      fetchDiscoveryMoodTracks(
        spotifyToken, mood, moodScore, excludedArtistsSet, preferences, userId, timeContext, trajectory,
        options.refreshSeed, todayHistory.seenIds, todayHistory.seenFingerprints
      ).catch(e => {
        console.warn('[Recommendations] Discovery pool failed:', e);
        return [] as RecommendedTrack[];
      }),
    ]);

    // 4. Proportionate blending with soft deduplication
    const blended = proportionateBlend(
      artistPool,
      spotifyPool,
      discoveryPool,
      discoveryLevel,
      limit,
      excludedIds
    );

    if (blended.length > 0) {
      // Record today's recommended tracks in SQLite so they won't repeat on initial loads
      recordDailyRecommendedTracks(userId, blended);

      _lastRecommendedTrackIds = blended.map(r => r.track.id.replace('spotify_', ''));
      _lastRecommendedAt = Date.now();
      return blended;
    }

    // 5. Tier-2 Online Mood Fallback (guarantees real audio tracks if Spotify search was 429)
    const onlineFallback = await fetchOnlineMoodTracksFallback(mood, limit);
    if (onlineFallback.length > 0) {
      return onlineFallback;
    }

    // 6. Absolute offline zero-internet fallback
    return getRuleBasedRecommendations(mood, localTracks, limit);
  } catch (e) {
    console.error('[Recommendations] VIP engine failed, falling back:', e);
    return getSmartRecommendations(mood, localTracks, userId, limit, options);
  }
}

// INSIGHTS QUERIES

/**
 * Get the user's top mood-music correlations for insights.
 */
export function getMoodMusicInsights(
  userId: string | null,
  limit: number = 5
): Array<{ moodType: string; trackName: string; artistName: string; playCount: number }> {
  try {
    return queryAll(
      `SELECT mood_type as moodType, track_name as trackName,
              artist_name as artistName, play_count as playCount
       FROM mood_music_tags
       WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL))
         AND play_count >= 2
       ORDER BY play_count DESC
       LIMIT ?`,
      [userId, userId, limit]
    );
  } catch {
    return [];
  }
}

/**
 * Get top genres/categories per mood for visualization.
 */
export function getMoodGenreDistribution(
  userId: string | null
): Array<{ moodType: string; trackSource: string; count: number }> {
  try {
    return queryAll(
      `SELECT mood_type as moodType, track_source as trackSource,
              SUM(play_count) as count
       FROM mood_music_tags
       WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)
       GROUP BY mood_type, track_source
       ORDER BY count DESC`,
      [userId, userId]
    );
  } catch {
    return [];
  }
}

// CONTINUATION BATCH (Infinite Playback)

/**
 * Generate a continuation batch of recommendations based on listening signals.
 * Rotates at least 50% fresh artists and analyzes listening signals.
 */
export async function generateContinuationBatch(
  mood: MoodType,
  moodScore: number,
  completedTrackIds: string[],
  skippedTrackIds: string[],
  allPreviousTrackIds: string[],
  userId: string,
  spotifyToken: string,
  userPlaylists: SpotifyPlaylist[],
  preferences: MusicPreferences | null,
  spotifyUserData?: SpotifyUserDataSnapshot,
  limit: number = 20,
  previousArtistNames: string[] = [],
): Promise<RecommendedTrack[]> {
  try {
    // Generate a fresh batch using the main engine with all previous tracks excluded and artist rotation
    // Requesting exact `limit` (20) ensures proportionateBlend maintains exact 65% / 30% / 5% ratios
    const baseResults = await getVIPSmartRecommendations(
      mood,
      moodScore,
      [],
      userId,
      spotifyToken,
      userPlaylists,
      preferences,
      limit,
      {
        excludeTrackIds: allPreviousTrackIds,
        refreshSeed: Date.now(),
        previousArtistNames,
      },
      spotifyUserData,
    );

    if (baseResults.length === 0) return [];

    // Extract artist/genre signals from completed and skipped tracks
    const completedArtists = new Set<string>();
    const skippedArtists = new Set<string>();

    for (const trackId of completedTrackIds) {
      try {
        const tag = queryFirst<{ artist_name: string }>(
          'SELECT artist_name FROM mood_music_tags WHERE track_id = ?',
          [trackId]
        );
        if (tag) completedArtists.add(tag.artist_name.toLowerCase());
      } catch { /* non-critical */ }
    }

    for (const trackId of skippedTrackIds) {
      try {
        const tag = queryFirst<{ artist_name: string }>(
          'SELECT artist_name FROM mood_music_tags WHERE track_id = ?',
          [trackId]
        );
        if (tag) skippedArtists.add(tag.artist_name.toLowerCase());
      } catch { /* non-critical */ }
    }

    // Re-score based on listening signals
    const rescored = baseResults.map(rec => {
      let bonus = 0;
      const artist = rec.track.artist.split(',')[0].trim().toLowerCase();

      // Boost artists from completed tracks
      if (completedArtists.has(artist)) bonus += 15;

      // Penalize artists from skipped tracks
      if (skippedArtists.has(artist)) bonus -= 20;

      return {
        ...rec,
        score: Math.max(0, Math.min(100, rec.score + bonus)),
      };
    });

    // Filter out tracks from heavily-skipped artists (2+ skips)
    const skippedArtistCounts = new Map<string, number>();
    for (const trackId of skippedTrackIds) {
      try {
        const tag = queryFirst<{ artist_name: string }>(
          'SELECT artist_name FROM mood_music_tags WHERE track_id = ?',
          [trackId]
        );
        if (tag) {
          const name = tag.artist_name.toLowerCase();
          skippedArtistCounts.set(name, (skippedArtistCounts.get(name) ?? 0) + 1);
        }
      } catch { /* non-critical */ }
    }

    const heavilySkippedArtists = new Set(
      Array.from(skippedArtistCounts.entries())
        .filter(([, count]) => count >= 2)
        .map(([name]) => name)
    );

    const filtered = rescored.filter(rec => {
      const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
      return !heavilySkippedArtists.has(artist);
    });

    // If heavily-skipped filter removed tracks, backfill from baseResults to guarantee full count
    if (filtered.length < limit && baseResults.length >= limit) {
      const filteredIds = new Set(filtered.map(r => r.track.id));
      for (const rec of baseResults) {
        if (filtered.length >= limit) break;
        if (!filteredIds.has(rec.track.id)) {
          filtered.push(rec);
          filteredIds.add(rec.track.id);
        }
      }
    }

    return filtered.slice(0, limit);
  } catch (e) {
    console.error('[Recommendations] Continuation batch failed:', e);
    return getVIPSmartRecommendations(
      mood, moodScore, [], userId, spotifyToken, userPlaylists,
      preferences, limit,
      { excludeTrackIds: allPreviousTrackIds, refreshSeed: Date.now(), previousArtistNames },
      spotifyUserData,
    );
  }
}
