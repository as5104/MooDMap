/**
 * MoodMap — Mood-Music Recommendation Engine
 *
 * 3-layer recommendation system:
 *   Layer 1: Rule-based mood → genre/keyword mapping (instant, no data needed)
 *   Layer 2: Personal learning from SQLite history (grows over time)
 *   Layer 3: Spotify catalog search (VIP only, handled externally)
 *
 * Works for ALL users. VIP users get an additional Spotify-powered layer.
 */

import type { MoodType } from '@/constants/moods';
import type { Track } from '@/context/MusicContext';
import { queryAll, execute, queryFirst } from '@/db/client';
import { v4 as uuid } from 'uuid';

// Types

export interface MoodMusicProfile {
  genres: string[];
  keywords: string[];
  tempo: 'slow' | 'medium' | 'fast';
  energy: 'very low' | 'low' | 'medium' | 'high' | 'very high';
  /** Feather icon name for UI */
  icon: string;
  /** Short label for the recommendation section */
  label: string;
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
  reason: string;         // "Matches your calm mood" / "You play this when anxious"
  source: 'rule' | 'personal' | 'spotify';
  score: number;          // 0-100, used for sorting
}

// Layer 1: Rule-Based Mood → Genre Mapping

export const MOOD_GENRE_MAP: Record<MoodType, MoodMusicProfile> = {
  anxious: {
    genres: ['ambient', 'lo-fi', 'nature sounds', 'classical'],
    keywords: ['calm', 'peaceful', 'meditation', 'sleep', 'soft'],
    tempo: 'slow',
    energy: 'low',
    icon: 'wind',
    label: 'Calming Picks',
  },
  stressed: {
    genres: ['ambient', 'chill', 'acoustic', 'piano'],
    keywords: ['relax', 'unwind', 'zen', 'spa', 'soothing'],
    tempo: 'slow',
    energy: 'low',
    icon: 'sunset',
    label: 'Stress Relief',
  },
  sad: {
    genres: ['acoustic', 'indie folk', 'piano', 'chill'],
    keywords: ['comfort', 'gentle', 'warm', 'soft', 'healing'],
    tempo: 'slow',
    energy: 'medium',
    icon: 'cloud-rain',
    label: 'Comfort Sounds',
  },
  happy: {
    genres: ['pop', 'indie pop', 'dance', 'funk'],
    keywords: ['upbeat', 'feel good', 'sunshine', 'happy', 'joy'],
    tempo: 'fast',
    energy: 'high',
    icon: 'sun',
    label: 'Feel-Good Vibes',
  },
  motivated: {
    genres: ['hip-hop', 'electronic', 'rock', 'workout'],
    keywords: ['energy', 'power', 'pump', 'beast mode', 'drive'],
    tempo: 'fast',
    energy: 'high',
    icon: 'zap',
    label: 'Power Tracks',
  },
  calm: {
    genres: ['jazz', 'bossa nova', 'lo-fi', 'classical'],
    keywords: ['smooth', 'chill', 'mellow', 'easy', 'lounge'],
    tempo: 'medium',
    energy: 'low',
    icon: 'coffee',
    label: 'Mellow Mix',
  },
  focused: {
    genres: ['lo-fi', 'electronic', 'minimal', 'study'],
    keywords: ['focus', 'concentrate', 'deep work', 'study', 'flow'],
    tempo: 'medium',
    energy: 'medium',
    icon: 'target',
    label: 'Deep Focus',
  },
  angry: {
    genres: ['rock', 'metal', 'punk', 'electronic'],
    keywords: ['intense', 'rage', 'heavy', 'loud', 'cathartic'],
    tempo: 'fast',
    energy: 'very high',
    icon: 'volume-2',
    label: 'Release Energy',
  },
  peaceful: {
    genres: ['new age', 'ambient', 'nature', 'meditation'],
    keywords: ['serene', 'tranquil', 'zen', 'mindful', 'stillness'],
    tempo: 'slow',
    energy: 'very low',
    icon: 'feather',
    label: 'Inner Peace',
  },
  tired: {
    genres: ['ambient', 'sleep', 'lo-fi', 'piano'],
    keywords: ['rest', 'sleep', 'lullaby', 'dream', 'gentle'],
    tempo: 'slow',
    energy: 'very low',
    icon: 'moon',
    label: 'Wind Down',
  },
};

// Category - Mood Affinity (for matching existing tracks)

/**
 * Maps existing MoodMap track categories to mood affinities.
 * Score 0-100: how well the category matches a mood.
 */
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
    // Local tracks get a neutral score — personal learning will refine
    happy: 40, calm: 40, focused: 40, peaceful: 40,
    sad: 40, tired: 40, anxious: 40, angry: 40,
    stressed: 40, motivated: 40,
  },
};

// Layer 1: Get Rule-Based Recommendations

/**
 * Score and sort existing tracks by mood affinity.
 * Returns tracks sorted by how well they match the given mood.
 */
export function getRuleBasedRecommendations(
  mood: MoodType,
  availableTracks: Track[],
  limit: number = 8
): RecommendedTrack[] {
  const profile = MOOD_GENRE_MAP[mood];
  if (!profile) return [];

  const scored: RecommendedTrack[] = availableTracks.map((track) => {
    // Get category affinity score
    const categoryAffinities = CATEGORY_MOOD_AFFINITY[track.category] ?? {};
    const affinityScore = categoryAffinities[mood] ?? 30;

    // Bonus: check if track title/artist matches keywords
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

  // Sort by score descending, take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Layer 2: Personal Learning

/**
 * Record that a track was played during a specific mood.
 * Called automatically when music plays while a mood is logged.
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

    // Check if this mood-track combo already exists
    const existing = queryFirst<{ id: string; play_count: number }>(
      `SELECT id, play_count FROM mood_music_tags
       WHERE mood_type = ? AND track_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [moodType, track.id, userId, userId]
    );

    if (existing) {
      // Increment play count
      execute(
        `UPDATE mood_music_tags
         SET play_count = play_count + 1, last_played_at = ?, mood_entry_id = ?
         WHERE id = ?`,
        [new Date().toISOString(), moodEntryId, existing.id]
      );
    } else {
      // Insert new tag
      execute(
        `INSERT INTO mood_music_tags
         (id, mood_entry_id, mood_type, track_id, track_name, artist_name,
          track_source, album_art, play_count, last_played_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          uuid(),
          moodEntryId,
          moodType,
          track.id,
          track.title,
          track.artist,
          source,
          track.cover,
          new Date().toISOString(),
          userId,
        ]
      );
    }
  } catch (e) {
    console.error('[Recommendations] Failed to tag track:', e);
  }
}

/**
 * Get tracks the user frequently plays during a specific mood.
 * Returns track IDs sorted by play frequency.
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
 * Get the total number of mood-music tags for a user.
 * Used to determine if we have enough data for personal recommendations.
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
 * Build personal recommendations by matching stored mood-track associations
 * against the available track library.
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
        score: Math.min(60 + tag.playCount * 8, 100), // Higher play count = higher score
      });
    }
  }

  return results;
}

// Layer 3: Combined Smart Recommendations

/**
 * Get blended recommendations from all layers.
 * Personal recommendations are prioritized over rule-based ones.
 */
export function getSmartRecommendations(
  mood: MoodType,
  availableTracks: Track[],
  userId: string | null,
  limit: number = 8
): RecommendedTrack[] {
  // Get personal recommendations first (highest priority)
  const personal = getPersonalRecommendations(mood, availableTracks, userId, 5);

  // Get rule-based recommendations
  const ruleBased = getRuleBasedRecommendations(mood, availableTracks, limit);

  // Merge: personal first, then fill with rule-based (deduplicated)
  const seen = new Set(personal.map((r) => r.track.id));
  const merged = [...personal];

  for (const rec of ruleBased) {
    if (!seen.has(rec.track.id) && merged.length < limit) {
      seen.add(rec.track.id);
      merged.push(rec);
    }
  }

  // Sort by score descending
  return merged.sort((a, b) => b.score - a.score);
}

// Insights Queries

/**
 * Get the user's top mood-music correlations for insights.
 * Returns: "When you feel X, you tend to listen to Y"
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
