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
import { v4 as uuid } from 'uuid';
import type { MusicPreferences } from './musicPreferenceService';
import type { SpotifyPlaylist, SpotifyTrack } from './spotify';

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
  source: 'rule' | 'personal' | 'spotify' | 'discovery' | 'playlist';
  score: number; // 0-100
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
          uuid(), moodEntryId, moodType, track.id, track.title, track.artist,
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
  limit: number = 8
): RecommendedTrack[] {
  const personal = getPersonalRecommendations(mood, availableTracks, userId, 5);
  const ruleBased = getRuleBasedRecommendations(mood, availableTracks, limit);

  const seen = new Set(personal.map((r) => r.track.id));
  const merged = [...personal];

  for (const rec of ruleBased) {
    if (!seen.has(rec.track.id) && merged.length < limit) {
      seen.add(rec.track.id);
      merged.push(rec);
    }
  }

  return merged.sort((a, b) => b.score - a.score);
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
      [uuid(), userId, trackId, moodType, signalType, new Date().toISOString()]
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
const ARTIST_TRACK_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

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

  return Array.from(new Set(queries));
}

/**
 * Layer 3: Execute preference-aware Spotify searches with online fallback.
 */
async function getPreferenceAwareSearchResults(
  accessToken: string,
  mood: MoodType,
  moodScore: number,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
): Promise<RecommendedTrack[]> {
  const queries = buildMoodSearchQueries(mood, preferences);
  if (queries.length === 0) return [];

  const allTracks: SpotifyTrack[] = [];
  const seenIds = new Set<string>();

  // Execute Spotify search if token is present (top 6 queries to prevent quota burnout)
  if (accessToken) {
    const { searchTracks } = require('./spotify');
    const spotifyQueries = queries.slice(0, 6);
    const results = await Promise.allSettled(
      spotifyQueries.map(async (query) => {
        const cacheKey = `search_${mood}_${query}`;
        const cached = getCached(_searchCache, cacheKey);
        if (cached) return cached;

        const tracks: SpotifyTrack[] = await searchTracks(accessToken, query, 10);
        setCache(_searchCache, cacheKey, tracks, SEARCH_CACHE_TTL);
        return tracks;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        for (const track of result.value) {
          if (!seenIds.has(track.id) && track.type !== 'episode' && !track.is_local) {
            seenIds.add(track.id);
            allTracks.push(track);
          }
        }
      }
    }
  }

  // Universal Online Music Search Fallback (if Spotify token is missing or returned < 5 tracks)
  if (allTracks.length < 5) {
    const fallbackQueries = queries.slice(0, 6);
    const fallbackResults = await Promise.allSettled(
      fallbackQueries.map(async (rawQ) => {
        // Strip artist: and quotes for clean Deezer search
        const cleanQ = rawQ.replace(/artist:"/gi, '').replace(/"/g, '').trim();
        if (!cleanQ) return [];

        const cacheKey = `dz_search_${mood}_${cleanQ}`;
        const cached = getCached(_searchCache, cacheKey);
        if (cached) return cached;

        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(cleanQ)}&limit=15`);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data?.data?.length) return [];

        const converted: SpotifyTrack[] = data.data.map((item: any) => ({
          id: `dz_${item.id}`,
          name: item.title,
          artists: [{ id: `dz_art_${item.artist?.id || 0}`, name: item.artist?.name || 'Artist' }],
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

        setCache(_searchCache, cacheKey, converted, SEARCH_CACHE_TTL);
        return converted;
      })
    );

    for (const result of fallbackResults) {
      if (result.status === 'fulfilled' && result.value) {
        for (const track of result.value) {
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            allTracks.push(track);
          }
        }
      }
    }
  }

  // Score all tracks
  return allTracks.map(st => {
    const { score, reason, source } = scoreSpotifyTrack(
      st, mood, moodScore, preferences, userId, timeContext, trajectory
    );
    return {
      track: spotifyTrackToAppTrack(st),
      reason,
      source,
      score: score.total,
    };
  }).sort((a, b) => b.score - a.score);
}

// LAYER 4: ARTIST DISCOVERY

/**
 * Layer 4: Get tracks from preferred and related artists, scored for mood.
 */
async function getArtistDiscoveryTracks(
  accessToken: string,
  mood: MoodType,
  moodScore: number,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
): Promise<RecommendedTrack[]> {
  if (!preferences || (!preferences.favoriteArtistNames?.length && !preferences.favoriteArtistIds?.length)) return [];

  const { searchTracks } = require('./spotify');
  const allTracks: SpotifyTrack[] = [];
  const seenIds = new Set<string>();

  const artistNamesToFetch = (preferences.favoriteArtistNames || []).slice(0, 5);
  if (accessToken && artistNamesToFetch.length > 0) {
    const topTrackResults = await Promise.allSettled(
      artistNamesToFetch.map(async (artistName) => {
        const cacheKey = `artist_search_${artistName.toLowerCase()}`;
        const cached = getCached(_artistTrackCache, cacheKey);
        if (cached) return cached;

        const tracks: SpotifyTrack[] = await searchTracks(accessToken, artistName, 10);
        setCache(_artistTrackCache, cacheKey, tracks, ARTIST_TRACK_CACHE_TTL);
        return tracks;
      })
    );

    for (const result of topTrackResults) {
      if (result.status === 'fulfilled' && result.value) {
        for (const track of result.value) {
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            allTracks.push(track);
          }
        }
      }
    }
  }

  // Score and return
  return allTracks.map(st => {
    const { score, reason, source } = scoreSpotifyTrack(
      st, mood, moodScore, preferences, userId, timeContext, trajectory
    );
    return {
      track: spotifyTrackToAppTrack(st),
      reason,
      source: source === 'personal' ? source : 'discovery' as const,
      score: score.total,
    };
  }).sort((a, b) => b.score - a.score);
}

// LAYER 5: PLAYLIST MINING

/**
 * Layer 5: Mine user's Spotify playlists for mood-appropriate tracks.
 */
async function minePlaylistsForMood(
  accessToken: string,
  playlists: SpotifyPlaylist[],
  mood: MoodType,
  moodScore: number,
  preferences: MusicPreferences | null,
  userId: string | null,
  timeContext: TimeOfDay,
  trajectory: MoodTrajectory,
): Promise<RecommendedTrack[]> {
  if (playlists.length === 0) return [];

  const { getPlaylistTracks } = require('./spotify');
  const allTracks: RecommendedTrack[] = [];
  const seenIds = new Set<string>();

  // Mine top 3 playlists (to limit API calls)
  const playlistsToMine = playlists.slice(0, 3);

  const results = await Promise.allSettled(
    playlistsToMine.map(async (playlist) => {
      const cacheKey = `playlist_tracks_${playlist.id}`;
      const cached = getCached(_searchCache, cacheKey);
      let tracks: SpotifyTrack[];
      if (cached) {
        tracks = cached;
      } else {
        tracks = await getPlaylistTracks(accessToken, playlist.id, 100);
        setCache(_searchCache, cacheKey, tracks, SEARCH_CACHE_TTL);
      }
      return { tracks, playlistName: playlist.name };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      for (const track of result.value.tracks) {
        if (track && track.id && !seenIds.has(track.id) && track.type !== 'episode' && !track.is_local) {
          seenIds.add(track.id);
          const { score, reason } = scoreSpotifyTrack(
            track, mood, moodScore, preferences, userId, timeContext, trajectory,
            true, result.value.playlistName
          );
          allTracks.push({
            track: spotifyTrackToAppTrack(track),
            reason,
            source: 'playlist',
            score: score.total,
          });
        }
      }
    }
  }

  return allTracks.sort((a, b) => b.score - a.score);
}

// DIVERSITY ENFORCEMENT

/**
 * Enforce diversity rules on the final recommendation list.
 * - Max 2 tracks per artist
 * - At least 3 different genres/sources
 * - Mix of sources (personal, discovery, playlist)
 */
function enforceDiversity(tracks: RecommendedTrack[], limit: number): RecommendedTrack[] {
  const artistCounts = new Map<string, number>();
  const result: RecommendedTrack[] = [];

  for (const rec of tracks) {
    if (result.length >= limit) break;

    const artist = rec.track.artist.split(',')[0].trim().toLowerCase();
    const count = artistCounts.get(artist) ?? 0;

    // Max 2 per artist
    if (count >= 2) continue;

    artistCounts.set(artist, count + 1);
    result.push(rec);
  }

  return result;
}

// SMART BLENDING (Slot-Based Interleaving)

/**
 * Interleave tracks using a slot-based system for variety.
 * Ensures the recommendation list alternates between familiar, discovery, and fresh picks.
 */
function smartBlend(
  personal: RecommendedTrack[],
  search: RecommendedTrack[],
  discovery: RecommendedTrack[],
  playlist: RecommendedTrack[],
  ruleBased: RecommendedTrack[],
  limit: number,
): RecommendedTrack[] {
  // Combine all into pools
  const allSorted = [...personal, ...search, ...discovery, ...playlist, ...ruleBased]
    .sort((a, b) => b.score - a.score);

  // Create category pools
  const personalPool = [...personal].sort((a, b) => b.score - a.score);
  const discoveryPool = [...discovery, ...search.filter(t => t.source === 'discovery')]
    .sort((a, b) => b.score - a.score);
  const preferencePool = [...search.filter(t => t.source === 'spotify')]
    .sort((a, b) => b.score - a.score);
  const playlistPool = [...playlist].sort((a, b) => b.score - a.score);
  const rulePool = [...ruleBased].sort((a, b) => b.score - a.score);

  // Slot pattern: defines the type of track for each position
  const slotPattern = ['best', 'personal', 'discovery', 'preference', 'fresh',
    'personal', 'discovery', 'preference', 'playlist',
    'discovery', 'preference', 'fresh'];

  const result: RecommendedTrack[] = [];
  const usedIds = new Set<string>();

  function pickFromPool(pool: RecommendedTrack[]): RecommendedTrack | null {
    for (let i = 0; i < pool.length; i++) {
      if (!usedIds.has(pool[i].track.id)) {
        usedIds.add(pool[i].track.id);
        return pool.splice(i, 1)[0];
      }
    }
    return null;
  }

  for (let i = 0; i < Math.min(limit, slotPattern.length); i++) {
    const slot = slotPattern[i];
    let pick: RecommendedTrack | null = null;

    switch (slot) {
      case 'best':
        pick = pickFromPool(allSorted);
        break;
      case 'personal':
        pick = pickFromPool(personalPool) || pickFromPool(rulePool);
        break;
      case 'discovery':
        pick = pickFromPool(discoveryPool);
        break;
      case 'preference':
        pick = pickFromPool(preferencePool) || pickFromPool(discoveryPool);
        break;
      case 'playlist':
        pick = pickFromPool(playlistPool);
        break;
      case 'fresh':
        pick = pickFromPool(rulePool) || pickFromPool(discoveryPool);
        break;
    }

    // Fallback: pick highest-scored unused track from all
    if (!pick) {
      pick = pickFromPool(allSorted);
    }

    if (pick) result.push(pick);
  }

  // Fill remaining slots if we haven't reached limit
  while (result.length < limit) {
    const pick = pickFromPool(allSorted);
    if (!pick) break;
    result.push(pick);
  }

  return result;
}

// VIP SMART RECOMMENDATIONS (Top-Level Orchestrator)

/**
 * Get advanced personalized recommendations for VIP users.
 * Orchestrates all 5 layers + scoring + diversity + blending.
 *
 * @param mood - Current mood type
 * @param moodScore - Mood intensity (1-10)
 * @param localTracks - Local library tracks for Layer 1
 * @param userId - Current user ID
 * @param spotifyToken - Valid Spotify access token
 * @param userPlaylists - User's Spotify playlists for Layer 5
 * @param preferences - User's music preferences from survey (null if not set)
 * @param limit - Max results to return
 */
export async function getVIPSmartRecommendations(
  mood: MoodType,
  moodScore: number,
  localTracks: Track[],
  userId: string,
  spotifyToken: string,
  userPlaylists: SpotifyPlaylist[],
  preferences: MusicPreferences | null,
  limit: number = 12,
): Promise<RecommendedTrack[]> {
  try {
    // Compute context
    const timeContext = getTimeOfDay();
    const trajectory = computeMoodTrajectory(userId, moodScore);

    // Layer 1: Rule-based (sync, instant)
    const ruleBasedRecs = getRuleBasedRecommendations(mood, localTracks, 8);

    // Layer 2: Personal history (sync, instant)
    const personalRecs = getPersonalRecommendations(mood, localTracks, userId, 5);

    // Layers 3, 4, 5: Async Spotify-powered (parallel)
    const [searchResults, discoveryResults, playlistResults] = await Promise.all([
      getPreferenceAwareSearchResults(
        spotifyToken, mood, moodScore, preferences, userId, timeContext, trajectory
      ).catch(e => {
        console.warn('[Recommendations] Layer 3 (search) failed:', e);
        return [] as RecommendedTrack[];
      }),
      getArtistDiscoveryTracks(
        spotifyToken, mood, moodScore, preferences, userId, timeContext, trajectory
      ).catch(e => {
        console.warn('[Recommendations] Layer 4 (discovery) failed:', e);
        return [] as RecommendedTrack[];
      }),
      minePlaylistsForMood(
        spotifyToken, userPlaylists, mood, moodScore, preferences, userId, timeContext, trajectory
      ).catch(e => {
        console.warn('[Recommendations] Layer 5 (playlist mining) failed:', e);
        return [] as RecommendedTrack[];
      }),
    ]);

    // Smart blend all layers — prioritize online/Spotify tracks over local static files
    const hasOnlineTracks = searchResults.length > 0 || discoveryResults.length > 0 || playlistResults.length > 0;
    const onlineRuleFallback = hasOnlineTracks ? [] : ruleBasedRecs;

    const blended = smartBlend(
      personalRecs, searchResults, discoveryResults, playlistResults, onlineRuleFallback, limit * 2
    );

    // Enforce diversity
    const diversified = enforceDiversity(blended, limit);

    // Guarantee 100% Spotify/online streaming music when online results exist
    const finalRecs = hasOnlineTracks
      ? diversified.filter(r => r.track.category === 'spotify' || r.track.id.startsWith('spotify_'))
      : diversified;

    // Update cache tracking
    _lastRecommendedTrackIds = finalRecs.map(r => r.track.id.replace('spotify_', ''));
    _lastRecommendedAt = Date.now();

    return finalRecs.length > 0 ? finalRecs : diversified;
  } catch (e) {
    console.error('[Recommendations] VIP engine failed, falling back:', e);
    return getSmartRecommendations(mood, localTracks, userId, limit);
  }
}

// INSIGHTS QUERIES (Preserved from original)

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
