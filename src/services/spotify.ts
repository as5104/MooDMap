/**
 * MoodMap — Spotify Web API Service
 *
 * Handles all Spotify API interactions:
 * - OAuth 2.0 with PKCE (via expo-auth-session)
 * - User profile & top items
 * - Currently playing & recently played
 * - Playlists & search
 * - Remote playback control
 *
 * VIP-gated: only accessible when tierStore.isVIP is true.
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Config

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'moodmap',
  path: 'spotify-callback',
});

/** Scopes we request from the user */
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-recently-played',
  'user-top-read',
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
];

/** Discovery document for expo-auth-session */
export const SPOTIFY_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: SPOTIFY_AUTH_ENDPOINT,
  tokenEndpoint: SPOTIFY_TOKEN_ENDPOINT,
};

// Types

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string; width: number; height: number }>;
  product: 'premium' | 'free' | 'open';
  country: string;
}

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string; // "YYYY" or "YYYY-MM-DD"
  album_type?: string; // "album" | "single" | "compilation"
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  uri: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  type?: string; // "track" | "episode"
  is_local?: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks?: { total: number };
  items?: { total: number };
  owner: { id?: string; display_name: string };
  collaborative?: boolean;
  public?: boolean;
  uri: string;
  external_urls: { spotify: string };
}

export interface SpotifyCurrentTrack {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack;
  device: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
  };
}

export interface SpotifyPlayHistory {
  track: SpotifyTrack;
  played_at: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Auth Helpers

/**
 * Get the auth request config for expo-auth-session.
 * Used with AuthSession.useAuthRequest() in the hook.
 */
export function getAuthRequestConfig(): AuthSession.AuthRequestConfig {
  return {
    clientId: SPOTIFY_CLIENT_ID,
    scopes: SCOPES,
    usePKCE: true,
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    extraParams: {
      show_dialog: 'true',
    },
  };
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Uses PKCE — no client secret needed.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<SpotifyTokens | null> {
  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      console.warn('[Spotify] Token exchange failed:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch (e) {
    console.warn('[Spotify] Token exchange error:', e);
    return null;
  }
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<{ tokens: SpotifyTokens | null; isRevoked?: boolean }> {
  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SPOTIFY_CLIENT_ID,
      }).toString(),
    });

    if (response.status === 400 || response.status === 401) {
      console.warn('[Spotify] Token refresh revoked or invalid:', response.status);
      return { tokens: null, isRevoked: true };
    }

    if (!response.ok) {
      console.warn('[Spotify] Token refresh failed:', response.status);
      return { tokens: null, isRevoked: false };
    }

    const data = await response.json();
    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
      isRevoked: false,
    };
  } catch (e) {
    console.warn('[Spotify] Token refresh error:', e);
    return { tokens: null, isRevoked: false };
  }
}

// API Helpers

let _searchRateLimitedUntil = 0;
let _playerRateLimitedUntil = 0;

/**
 * Reset any active in-memory Spotify rate-limit cooldown.
 */
export function resetSpotifyRateLimitCooldown(): void {
  _searchRateLimitedUntil = 0;
  _playerRateLimitedUntil = 0;
}

/**
 * Make an authenticated request to the Spotify API.
 */
async function spotifyFetch<T>(
  accessToken: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T | null> {
  const isSearch = endpoint.startsWith('/search');
  const cooldown = isSearch ? _searchRateLimitedUntil : _playerRateLimitedUntil;

  // Fail-fast if currently in cooldown for this endpoint category
  if (Date.now() < cooldown) {
    return null;
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 204) return null;

    // Handle rate limiting — separate search cooldown from player/library endpoints
    if (response.status === 429) {
      const rawRetry = parseInt(response.headers.get('Retry-After') || '10', 10);
      const retryAfter = Math.min(Math.max(isNaN(rawRetry) ? 10 : rawRetry, 5), isSearch ? 30 : 10);
      if (isSearch) {
        _searchRateLimitedUntil = Date.now() + retryAfter * 1000;
      } else {
        _playerRateLimitedUntil = Date.now() + retryAfter * 1000;
      }
      console.warn(`[Spotify] Rate limited (429) on ${endpoint}. Cooldown active for ${retryAfter}s (raw: ${rawRetry}s).`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Spotify] API error ${response.status} for ${endpoint}:`, errorText);
      return null;
    }

    const text = await response.text();
    if (!text || text.trim() === '') return null;

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return null;
    }
  } catch (e) {
    console.warn(`[Spotify] Fetch error for ${endpoint}:`, e);
    return null;
  }
}

// User Data Endpoints

export async function getCurrentUser(accessToken: string): Promise<SpotifyUser | null> {
  return spotifyFetch<SpotifyUser>(accessToken, '/me');
}

export async function getTopTracks(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: SpotifyTrack[] }>(
    accessToken,
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
  );
  return data?.items ?? [];
}

export async function getTopArtists(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ items: SpotifyArtist[] }>(
    accessToken,
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`
  );
  return data?.items ?? [];
}

export async function getRecentlyPlayed(
  accessToken: string,
  limit: number = 20
): Promise<SpotifyPlayHistory[]> {
  const data = await spotifyFetch<{ items: SpotifyPlayHistory[] }>(
    accessToken,
    `/me/player/recently-played?limit=${limit}`
  );
  return data?.items ?? [];
}

// Playback Endpoints

export async function getCurrentlyPlaying(
  accessToken: string
): Promise<SpotifyCurrentTrack | null> {
  return spotifyFetch<SpotifyCurrentTrack>(accessToken, '/me/player/currently-playing');
}

export async function getPlaybackState(
  accessToken: string
): Promise<SpotifyCurrentTrack | null> {
  return spotifyFetch<SpotifyCurrentTrack>(accessToken, '/me/player');
}

export async function play(
  accessToken: string,
  uris?: string | string[],
  positionMs?: number,
  contextUri?: string,
  offset?: { position: number } | { uri: string }
): Promise<void> {
  const body: any = {};
  if (contextUri) {
    body.context_uri = contextUri;
    if (offset) {
      body.offset = offset;
    }
  } else if (uris) {
    body.uris = Array.isArray(uris) ? uris : [uris];
  }
  if (positionMs !== undefined) {
    body.position_ms = positionMs;
  }
  await spotifyFetch(
    accessToken,
    '/me/player/play',
    'PUT',
    body
  );
}

export async function getQueue(
  accessToken: string
): Promise<{ currently_playing: any; queue: any[] } | null> {
  return spotifyFetch<{ currently_playing: any; queue: any[] }>(accessToken, '/me/player/queue');
}

export async function pause(accessToken: string): Promise<void> {
  await spotifyFetch(accessToken, '/me/player/pause', 'PUT');
}

export async function nextTrack(accessToken: string): Promise<void> {
  await spotifyFetch(accessToken, '/me/player/next', 'POST');
}

export async function previousTrack(accessToken: string): Promise<void> {
  await spotifyFetch(accessToken, '/me/player/previous', 'POST');
}

export async function seekToPosition(
  accessToken: string,
  positionMs: number
): Promise<void> {
  await spotifyFetch(accessToken, `/me/player/seek?position_ms=${positionMs}`, 'PUT');
}

export async function addToQueue(
  accessToken: string,
  trackUri: string
): Promise<void> {
  await spotifyFetch(
    accessToken,
    `/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
    'POST'
  );
}

// Playlist Endpoints

export async function getUserPlaylists(
  accessToken: string,
  limit: number = 50
): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    accessToken,
    `/me/playlists?limit=${limit}`
  );
  return data?.items ?? [];
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
  limit: number = 500
): Promise<SpotifyTrack[]> {
  let allTracks: SpotifyTrack[] = [];
  let offset = 0;
  const pageSize = 100; // Spotify limit per request is 100

  try {
    while (allTracks.length < limit) {
      const currentLimit = Math.min(pageSize, limit - allTracks.length);
      const data = await spotifyFetch<{
        items: Array<{ track?: SpotifyTrack; item?: SpotifyTrack }>;
        next: string | null;
        total: number;
      }>(
        accessToken,
        `/playlists/${playlistId}/items?limit=${currentLimit}&offset=${offset}`
      );

      if (!data || !data.items || data.items.length === 0) {
        break;
      }

      const tracks = data.items
        .map((item) => item.track ?? item.item)
        .filter(Boolean) as SpotifyTrack[];

      allTracks = allTracks.concat(tracks);

      if (!data.next || allTracks.length >= data.total) {
        break;
      }

      offset += pageSize;
    }
  } catch (err) {
    console.warn(`[Spotify] Error fetching paginated playlist tracks for ${playlistId}:`, err);
  }

  return allTracks;
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description?: string
): Promise<SpotifyPlaylist | null> {
  const body: any = {
    name,
    description: description ?? '',
  };

  try {
    const endpoint = userId
      ? `/users/${encodeURIComponent(userId)}/playlists`
      : `/me/playlists`;

    let res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      return data as SpotifyPlaylist;
    }

    // If userId route failed, try /me/playlists fallback
    if (userId) {
      const fallbackRes = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (fallbackRes.status === 200 || fallbackRes.status === 201) {
        const data = await fallbackRes.json();
        return data as SpotifyPlaylist;
      }
    }

    const errText = await res.text();
    console.warn(`[Spotify] Create playlist failed (${res.status}):`, errText);
    return null;
  } catch (err) {
    console.warn('[Spotify] Create playlist exception:', err);
    return null;
  }
}

export interface AddTracksResult {
  snapshot_id?: string;
  success: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Add tracks to a Spotify playlist by URI.
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[]
): Promise<AddTracksResult> {
  if (!uris || uris.length === 0) {
    return { success: false, error: 'No track URIs provided' };
  }
  const formattedUris = uris.map(formatSpotifyTrackUri).filter(Boolean);
  if (formattedUris.length === 0) {
    return { success: false, error: 'Invalid Spotify track URI' };
  }

  const cleanPlaylistId = playlistId.replace('spotify:playlist:', '').replace('spotify_', '').trim();
  const endpoint = `${SPOTIFY_API_BASE}/playlists/${cleanPlaylistId}/items`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: formattedUris,
      }),
    });

    if (response.status === 200 || response.status === 201) {
      const text = await response.text();
      let data: any = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {}
      return { success: true, snapshot_id: data.snapshot_id || 'ok', statusCode: response.status };
    }

    const errText = await response.text();
    let parsedMsg = '';
    try {
      const errObj = JSON.parse(errText);
      parsedMsg = errObj?.error?.message || errObj?.error_description || '';
    } catch {}

    if (response.status === 403) {
      return {
        success: false,
        statusCode: 403,
        error: 'You can only add songs to playlists you own or collaborate on.',
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        statusCode: 401,
        error: 'Spotify session expired. Please tap Reconnect.',
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        statusCode: 404,
        error: 'Playlist not found on Spotify.',
      };
    }

    console.warn(`[Spotify] Add tracks to playlist failed (${response.status}):`, errText);
    return {
      success: false,
      statusCode: response.status,
      error: parsedMsg || `Spotify error (${response.status})`,
    };
  } catch (err: any) {
    console.warn('[Spotify] Add tracks to playlist exception:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Format any track URI or ID into a clean Spotify URI (spotify:track:ID)
 */
export function formatSpotifyTrackUri(uriOrId: string): string {
  if (!uriOrId) return '';
  let clean = uriOrId.trim();

  // If already standard spotify:track:xxx
  if (clean.startsWith('spotify:track:')) {
    const id = clean.replace('spotify:track:', '').split('?')[0].trim();
    return `spotify:track:${id}`;
  }

  if (clean.includes('/track/')) {
    const parts = clean.split('/track/');
    const idPart = (parts[1] || '').split('?')[0].split('/')[0].trim();
    if (idPart) return `spotify:track:${idPart}`;
  }

  // If starts with generic spotify:
  if (clean.startsWith('spotify:')) {
    return clean;
  }

  // Strip internal prefix like spotify_
  if (clean.startsWith('spotify_')) {
    clean = clean.replace('spotify_', '');
  }

  // Strip query params if any
  clean = clean.split('?')[0].trim();

  return `spotify:track:${clean}`;
}

/**
 * Resolves any track (Spotify, Deezer fallback, or local) to a valid Spotify track URI.
 * If already a valid Spotify URI/ID, returns it.
 * If non-Spotify ID (e.g. dz_xxx, local ID), searches Spotify by track title + artist to find the official Spotify URI.
 */
export async function resolveSpotifyTrackUri(
  accessToken: string,
  track: { id?: string; uri?: string; title?: string; artist?: string }
): Promise<string | null> {
  const raw = track.uri || track.id || '';
  const formatted = formatSpotifyTrackUri(raw);

  // Check if it's already a valid Spotify track URI (standard 22-char base62)
  const idPart = formatted.replace('spotify:track:', '');
  const isValidSpotifyId = /^[0-9A-Za-z]{22}$/.test(idPart);

  if (isValidSpotifyId) {
    return formatted;
  }

  // If not a valid 22-char Spotify ID (e.g. dz_xxx, local, or title text), search Spotify
  if (track.title) {
    const cleanArtist = (track.artist || '').split(',')[0].trim();
    const query = `${track.title} ${cleanArtist}`.trim();
    try {
      const searchRes = await searchTracks(accessToken, query, 3);
      if (searchRes && searchRes.length > 0) {
        return searchRes[0].uri || `spotify:track:${searchRes[0].id}`;
      }
    } catch (err) {
      console.warn('[Spotify] Could not resolve Spotify URI via search:', err);
    }
  }

  // Fallback to formatted if search didn't find
  return formatted || null;
}

// Search Endpoint

export interface SpotifySearchResult {
  tracks: { items: SpotifyTrack[] };
}

export async function searchTracks(
  accessToken: string,
  query: string,
  limit: number = 10,
  offset: number = 0,
): Promise<SpotifyTrack[]> {
  // Spotify Search API enforces max limit of 10 for standard developer applications
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  const safeOffset = Math.max(0, Math.min(Math.floor(offset) || 0, 990));

  const data = await spotifyFetch<SpotifySearchResult>(
    accessToken,
    `/search?q=${encodeURIComponent(cleanQ)}&type=track&limit=${safeLimit}&offset=${safeOffset}`
  );
  return data?.tracks?.items ?? [];
}

/**
 * Search Spotify for mood-appropriate tracks using genre/keyword mapping.
 */
export async function searchForMood(
  accessToken: string,
  genres: string[],
  keywords: string[],
  limit: number = 10
): Promise<SpotifyTrack[]> {
  // Build a search query from genres and keywords
  const genreQuery = genres.slice(0, 2).map((g) => g).join(' ');
  const keywordQuery = keywords.slice(0, 2).join(' ');
  const query = `${genreQuery} ${keywordQuery}`.trim();

  if (!query) return [];
  return searchTracks(accessToken, query, limit);
}

/**
 * Search for artists by name.
 * Used in the music preference survey for artist selection.
 */
export async function searchArtists(
  accessToken: string,
  query: string,
  limit: number = 10
): Promise<SpotifyArtist[]> {
  // Spotify Search API enforces max limit of 10 for standard developer applications
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
    accessToken,
    `/search?q=${encodeURIComponent(cleanQ)}&type=artist&limit=${safeLimit}`
  );
  return data?.artists?.items ?? [];
}

/**
 * Get artists related to a given artist.
 * Used in Layer 4 (Artist Discovery) to expand beyond seed artists.
 */
export async function getRelatedArtists(
  accessToken: string,
  artistId: string
): Promise<SpotifyArtist[]> {
  return [];
}

/**
 * Get an artist's top tracks.
 * Used in Layer 4 (Artist Discovery) to get tracks from preferred/related artists.
 */
export async function getArtistTopTracks(
  accessToken: string,
  artistId: string,
  market: string = 'US'
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: SpotifyTrack[] }>(
    accessToken,
    `/artists/${artistId}/top-tracks?market=${market}`
  );
  return data?.tracks ?? [];
}

/**
 * Batch fetch multiple artists by IDs (max 50).
 * Returns full artist objects including genres[].
 * Used to extract genre tags from user's top artists for the survey.
 */
export async function getMultipleArtists(
  accessToken: string,
  ids: string[]
): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  // Spotify limits to 50 IDs per request
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }
  const results: SpotifyArtist[] = [];
  for (const chunk of chunks) {
    const data = await spotifyFetch<{ artists: SpotifyArtist[] }>(
      accessToken,
      `/artists?ids=${chunk.join(',')}`
    );
    if (data?.artists) results.push(...data.artists);
  }
  return results;
}

// Utility

/**
 * Format duration from ms to MM:SS
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get the best image URL from a Spotify images array.
 * Prefers ~300px for thumbnails.
 */
export function getBestImage(
  images: SpotifyImage[],
  targetSize: number = 300
): string | null {
  if (!images?.length) return null;

  // Sort by how close width is to target
  const sorted = [...images].sort((a, b) => {
    const diffA = Math.abs((a.width ?? 640) - targetSize);
    const diffB = Math.abs((b.width ?? 640) - targetSize);
    return diffA - diffB;
  });

  return sorted[0]?.url ?? null;
}

export async function setShuffle(accessToken: string, state: boolean): Promise<void> {
  await spotifyFetch(
    accessToken,
    `/me/player/shuffle?state=${state}`,
    'PUT'
  );
}

export async function setRepeat(accessToken: string, state: 'off' | 'context' | 'track'): Promise<void> {
  await spotifyFetch(
    accessToken,
    `/me/player/repeat?state=${state}`,
    'PUT'
  );
}

export async function getTrack(accessToken: string, trackId: string): Promise<SpotifyTrack | null> {
  return spotifyFetch<SpotifyTrack>(accessToken, `/tracks/${trackId}`);
}

// Ensure WebBrowser completes auth session
WebBrowser.maybeCompleteAuthSession();
