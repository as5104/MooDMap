/**
 * MoodMap — Spotify User Data Cache Service
 *
 * Fetches the user's current Spotify listening data once daily and stores it
 * locally in SQLite. This data is used by the recommendation engine to produce
 * daily-fresh, taste-aware song lists.
 *
 * Data collected:
 *   - Top tracks (short_term — last ~4 weeks)
 *   - Top tracks (medium_term — last ~6 months)
 *   - Recently played (last 50 tracks)
 *   - Top artists (short_term — for genre extraction)
 */

import { execute, queryFirst } from '@/db/client';

// Types

export interface CachedSpotifyTrack {
  id: string;
  name: string;
  artistIds: string[];
  artistNames: string[];
  genres: string[]; // flattened from artist genres
  uri: string;
  coverUrl: string;
  duration: string;
  durationMs: number;
}

export interface SpotifyUserDataSnapshot {
  /** Top tracks from the last ~4 weeks */
  topTracksShort: CachedSpotifyTrack[];
  /** Top tracks from the last ~6 months */
  topTracksMedium: CachedSpotifyTrack[];
  /** Last 50 recently played tracks */
  recentlyPlayed: CachedSpotifyTrack[];
  /** Top artist IDs + names + genres from short_term */
  topArtistsShort: Array<{
    id: string;
    name: string;
    genres: string[];
  }>;
  /** ISO timestamp when this snapshot was fetched */
  fetchedAt: string;
}

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a fresh Spotify data fetch is needed (cache is stale or missing).
 */
export function isSpotifyDataStale(userId: string): boolean {
  try {
    const row = queryFirst<{ data: string; fetched_at: string }>(
      'SELECT data, fetched_at FROM spotify_user_data_cache WHERE user_id = ?',
      [userId]
    );
    if (!row) return true;
    const fetchedAt = new Date(row.fetched_at).getTime();
    if (Date.now() - fetchedAt > CACHE_TTL_MS) return true;

    // Check if existing cached tracks are missing coverUrl (from previous schema)
    const parsed = JSON.parse(row.data) as SpotifyUserDataSnapshot;
    if (parsed.topTracksShort?.length > 0 && !parsed.topTracksShort[0].coverUrl) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Fetch and cache the user's Spotify listening data.
 * Only makes API calls if the cache is stale (>24h old).
 *
 * @returns The fresh snapshot, or null if fetch failed.
 */
export async function refreshSpotifyUserData(
  userId: string,
  accessToken: string,
): Promise<SpotifyUserDataSnapshot | null> {
  if (!accessToken) return getLatestSpotifyUserData(userId);
  if (!isSpotifyDataStale(userId)) return getLatestSpotifyUserData(userId);

  try {
    const {
      getTopTracks,
      getTopArtists,
      getRecentlyPlayed,
    } = require('./spotify');

    // Fetch all 4 data sources in parallel
    const [topShort, topMedium, recent, artists] = await Promise.all([
      getTopTracks(accessToken, 'short_term', 30).catch(() => []),
      getTopTracks(accessToken, 'medium_term', 30).catch(() => []),
      getRecentlyPlayed(accessToken, 50).catch(() => []),
      getTopArtists(accessToken, 'short_term', 20).catch(() => []),
    ]);

    // Convert SpotifyTrack to CachedSpotifyTrack with cover, duration, and URI
    const mapTrack = (t: any): CachedSpotifyTrack => {
      const bestImg = t.album?.images?.reduce((p: any, c: any) =>
        Math.abs((c.width || 0) - 300) < Math.abs((p.width || 0) - 300) ? c : p,
        t.album?.images?.[0] || {}
      );
      const totalSecs = Math.floor((t.duration_ms || 0) / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const formattedDur = `${mins}:${secs.toString().padStart(2, '0')}`;

      return {
        id: t.id,
        name: t.name || 'Unknown Track',
        artistIds: (t.artists || []).map((a: any) => a.id),
        artistNames: (t.artists || []).map((a: any) => a.name || 'Unknown Artist'),
        genres: (t.artists || []).flatMap((a: any) => a.genres || []),
        uri: t.uri || `spotify:track:${t.id}`,
        coverUrl: bestImg?.url || '',
        duration: formattedDur,
        durationMs: t.duration_ms || 0,
      };
    };

    const snapshot: SpotifyUserDataSnapshot = {
      topTracksShort: (topShort || []).map(mapTrack),
      topTracksMedium: (topMedium || []).map(mapTrack),
      recentlyPlayed: (recent || []).map((item: any) =>
        mapTrack(item.track ?? item)
      ),
      topArtistsShort: (artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        genres: a.genres || [],
      })),
      fetchedAt: new Date().toISOString(),
    };

    // Store in SQLite
    execute(
      `INSERT OR REPLACE INTO spotify_user_data_cache (user_id, data, fetched_at)
       VALUES (?, ?, ?)`,
      [userId, JSON.stringify(snapshot), snapshot.fetchedAt]
    );

    console.log(
      `[SpotifyDataCache] Refreshed data for user ${userId}: ` +
      `${snapshot.topTracksShort.length} short-term, ` +
      `${snapshot.topTracksMedium.length} medium-term, ` +
      `${snapshot.recentlyPlayed.length} recent, ` +
      `${snapshot.topArtistsShort.length} artists`
    );

    return snapshot;
  } catch (e) {
    console.warn('[SpotifyDataCache] Failed to refresh:', e);
    // Fall back to cached data
    return getLatestSpotifyUserData(userId);
  }
}

/**
 * Get the most recently cached Spotify user data.
 * Returns null if no data has ever been cached.
 */
export function getLatestSpotifyUserData(
  userId: string,
): SpotifyUserDataSnapshot | null {
  try {
    const row = queryFirst<{ data: string }>(
      'SELECT data FROM spotify_user_data_cache WHERE user_id = ?',
      [userId]
    );
    if (!row) return null;
    return JSON.parse(row.data) as SpotifyUserDataSnapshot;
  } catch (e) {
    console.warn('[SpotifyDataCache] Failed to read cache:', e);
    return null;
  }
}

/**
 * Clear cached Spotify user data (e.g., on sign-out or disconnect).
 */
export function clearSpotifyUserDataCache(userId: string): void {
  try {
    execute('DELETE FROM spotify_user_data_cache WHERE user_id = ?', [userId]);
  } catch (e) {
    console.warn('[SpotifyDataCache] Failed to clear cache:', e);
  }
}
