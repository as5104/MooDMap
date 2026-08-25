import { queryAll, queryFirst, execute } from '@/db/client';
import { JournalEntryRow } from './journalService';
import type { Track } from '@/context/MusicContext';

export interface ComfortTrackRow {
  id: string; // trackId
  track_name: string;
  artist_name: string;
  track_source: string;
  album_art: string | null;
  audio_url: string | null;
  duration: string | null;
  is_comfort: number;
  last_shown_at: string | null;
  created_at: string;
  user_id: string | null;
}

export type ComfortItemType = 'journal' | 'track';

export interface ComfortSurfacedItem {
  id: string;
  type: ComfortItemType;
  title: string;
  subtitle: string;
  content?: string;
  image?: string | null;
  albumArt?: string | null;
  track?: Track;
  date?: string;
  lastShownAt?: string | null;
}

/**
 * Toggle comfort status for a journal entry
 */
export function toggleJournalComfort(journalId: string, isComfort: boolean): void {
  execute(
    `UPDATE journal_entries SET is_comfort = ?, updated_at = ? WHERE id = ?`,
    [isComfort ? 1 : 0, new Date().toISOString(), journalId]
  );
}

/**
 * Toggle comfort status for a music track
 */
export function toggleTrackComfort(
  track: {
    id: string;
    title: string;
    artist: string;
    source?: string;
    cover?: string;
    url?: string;
    duration?: string;
  },
  isComfort: boolean,
  userId?: string
): void {
  if (!track.id) return;

  const altId = track.id.startsWith('spotify_')
    ? track.id.replace('spotify_', '')
    : `spotify_${track.id}`;

  const existing = queryFirst<ComfortTrackRow>(
    `SELECT id FROM comfort_tracks WHERE id = ? OR id = ?`,
    [track.id, altId]
  );

  const now = new Date().toISOString();

  if (existing) {
    execute(
      `UPDATE comfort_tracks SET is_comfort = ?, track_name = ?, artist_name = ?, album_art = ?, audio_url = ?, duration = ? WHERE id = ?`,
      [
        isComfort ? 1 : 0,
        track.title,
        track.artist,
        track.cover || null,
        track.url || null,
        track.duration || null,
        existing.id,
      ]
    );
  } else if (isComfort) {
    execute(
      `INSERT INTO comfort_tracks (id, track_name, artist_name, track_source, album_art, audio_url, duration, is_comfort, last_shown_at, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      [
        track.id,
        track.title,
        track.artist,
        track.source || 'ambient',
        track.cover || null,
        track.url || null,
        track.duration || null,
        now,
        userId || null,
      ]
    );
  }
}

/**
 * Check if a track is marked as comfort anchor
 */
export function isTrackComfort(trackId: string): boolean {
  if (!trackId) return false;

  const altId = trackId.startsWith('spotify_')
    ? trackId.replace('spotify_', '')
    : `spotify_${trackId}`;

  const row = queryFirst<{ is_comfort: number }>(
    `SELECT is_comfort FROM comfort_tracks WHERE (id = ? OR id = ?) AND is_comfort = 1`,
    [trackId, altId]
  );
  return Boolean(row && row.is_comfort === 1);
}

/**
 * Get all comfort journal entries
 */
export function getComfortJournals(userId?: string): JournalEntryRow[] {
  if (userId) {
    return queryAll<JournalEntryRow>(
      `SELECT * FROM journal_entries WHERE is_comfort = 1 AND user_id = ? ORDER BY date DESC, created_at DESC`,
      [userId]
    );
  }
  return queryAll<JournalEntryRow>(
    `SELECT * FROM journal_entries WHERE is_comfort = 1 ORDER BY date DESC, created_at DESC`
  );
}

/**
 * Get all comfort tracks
 */
export function getComfortTracks(userId?: string): ComfortTrackRow[] {
  if (userId) {
    return queryAll<ComfortTrackRow>(
      `SELECT * FROM comfort_tracks WHERE is_comfort = 1 AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC`,
      [userId]
    );
  }
  return queryAll<ComfortTrackRow>(
    `SELECT * FROM comfort_tracks WHERE is_comfort = 1 ORDER BY created_at DESC`
  );
}

/**
 * Get counts of all comfort anchors
 */
export function getComfortCounts(userId?: string): { total: number; journals: number; tracks: number } {
  const journals = getComfortJournals(userId).length;
  const tracks = getComfortTracks(userId).length;
  return {
    total: journals + tracks,
    journals,
    tracks,
  };
}

/**
 * Core Surfacing Algorithm
 */
export function getSurfacedComfortItem(userId?: string): ComfortSurfacedItem | null {
  // Query 3 least-recently-shown journals
  const journalSql = userId
    ? `SELECT * FROM journal_entries 
       WHERE is_comfort = 1 AND user_id = ? 
       ORDER BY CASE WHEN last_shown_at IS NULL THEN 0 ELSE 1 END, last_shown_at ASC, created_at DESC 
       LIMIT 3`
    : `SELECT * FROM journal_entries 
       WHERE is_comfort = 1 
       ORDER BY CASE WHEN last_shown_at IS NULL THEN 0 ELSE 1 END, last_shown_at ASC, created_at DESC 
       LIMIT 3`;
  const candidateJournals = queryAll<JournalEntryRow>(journalSql, userId ? [userId] : []);

  // Query 3 least-recently-shown tracks
  const trackSql = userId
    ? `SELECT * FROM comfort_tracks 
       WHERE is_comfort = 1 AND (user_id = ? OR user_id IS NULL) 
       ORDER BY CASE WHEN last_shown_at IS NULL THEN 0 ELSE 1 END, last_shown_at ASC, created_at DESC 
       LIMIT 3`
    : `SELECT * FROM comfort_tracks 
       WHERE is_comfort = 1 
       ORDER BY CASE WHEN last_shown_at IS NULL THEN 0 ELSE 1 END, last_shown_at ASC, created_at DESC 
       LIMIT 3`;
  const candidateTracks = queryAll<ComfortTrackRow>(trackSql, userId ? [userId] : []);

  // Transform candidates
  const combinedPool: ComfortSurfacedItem[] = [];

  for (const j of candidateJournals) {
    let firstImage: string | null = null;
    if (j.images) {
      try {
        const parsed = JSON.parse(j.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          firstImage = parsed[0];
        }
      } catch {}
    }

    combinedPool.push({
      id: j.id,
      type: 'journal',
      title: j.title || 'Comfort Memory',
      subtitle: j.date,
      content: j.content,
      image: firstImage,
      date: j.date,
      lastShownAt: j.last_shown_at,
    });
  }

  for (const t of candidateTracks) {
    const trackObj: Track = {
      id: t.id,
      title: t.track_name,
      artist: t.artist_name,
      category: (t.track_source as any) || 'ambient',
      cover: t.album_art || '',
      url: t.audio_url || '',
      duration: t.duration || '3:30',
      durationSec: 210,
    };

    combinedPool.push({
      id: t.id,
      type: 'track',
      title: t.track_name,
      subtitle: t.artist_name,
      albumArt: t.album_art,
      track: trackObj,
      lastShownAt: t.last_shown_at,
    });
  }

  if (combinedPool.length === 0) {
    return null;
  }

  // Pick 1 at random from combined candidate pool
  const randomIndex = Math.floor(Math.random() * combinedPool.length);
  const chosen = combinedPool[randomIndex];

  // Update chosen item's last_shown_at
  const now = new Date().toISOString();
  if (chosen.type === 'journal') {
    execute(`UPDATE journal_entries SET last_shown_at = ? WHERE id = ?`, [now, chosen.id]);
  } else {
    execute(`UPDATE comfort_tracks SET last_shown_at = ? WHERE id = ?`, [now, chosen.id]);
  }

  return chosen;
}
