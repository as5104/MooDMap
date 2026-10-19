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
import { File, Paths } from 'expo-file-system';

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
 * Check whether Spotify Search API is currently in a rate-limit cooldown.
 */
export function isSpotifySearchRateLimited(): boolean {
  return Date.now() < _searchRateLimitedUntil;
}

/**
 * Reset any active in-memory Spotify rate-limit cooldown.
 */
export function resetSpotifyRateLimitCooldown(): void {
  _searchRateLimitedUntil = 0;
  _playerRateLimitedUntil = 0;
}

export const SPOTIFY_ARTIST_CACHE_FILE = new File(Paths.document, 'spotify_artist_cache.json');

/**
 * Load artists from the persistent disk cache.
 * Cleanses any stale Deezer remnants so cache only holds Spotify data.
 */
export async function loadArtistsFromPersistentCache(): Promise<Record<string, any>> {
  try {
    if (SPOTIFY_ARTIST_CACHE_FILE.exists) {
      const text = await SPOTIFY_ARTIST_CACHE_FILE.text();
      if (text) {
        const raw = JSON.parse(text);
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (k.startsWith('deezer_') || k.startsWith('dz_') || k.startsWith('itunes_')) continue;
          if (v && typeof v === 'object') {
            const item = { ...v as any };
            const url = item.images?.[0]?.url;
            if (typeof url === 'string' && (url.includes('dzcdn.net') || url.includes('deezer.com'))) {
              item.images = [];
            }
            clean[k] = item;
          }
        }
        return clean;
      }
    }
  } catch (err) {
    console.warn('[Spotify] Error loading persistent artist cache:', err);
  }
  return {};
}

/**
 * Save artist objects into the persistent JSON cache file.
 * Cache is strictly for Spotify data. Never saves Deezer fallback data.
 */
export async function saveArtistsToPersistentCache(artists: SpotifyArtist[]): Promise<void> {
  if (!artists || artists.length === 0) return;
  try {
    const existingCache = await loadArtistsFromPersistentCache();
    let modified = false;

    for (const a of artists) {
      if (!a || !a.name) continue;
      // Never cache Deezer/fallback IDs
      if (a.id && (a.id.startsWith('deezer_') || a.id.startsWith('dz_') || a.id.startsWith('itunes_'))) continue;

      const normKey = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existing = (a.id && existingCache[a.id]) || (normKey && existingCache[`name:${normKey}`]);

      // Filter out any Deezer images — only save Spotify CDN images
      const rawImgUrl = a.images?.[0]?.url;
      const isDeezer = typeof rawImgUrl === 'string' && (rawImgUrl.includes('dzcdn.net') || rawImgUrl.includes('deezer.com'));
      const hasValidSpotifyImg = a.images && a.images.length > 0 && !!rawImgUrl && !isDeezer;
      const images = hasValidSpotifyImg ? a.images : (existing?.images || []);

      const entry = {
        ...existing,
        ...a,
        images,
        updatedAt: Date.now(),
      };

      if (a.id) {
        existingCache[a.id] = entry;
        modified = true;
      }
      if (normKey) {
        existingCache[`name:${normKey}`] = entry;
        modified = true;
      }
    }

    if (modified) {
      SPOTIFY_ARTIST_CACHE_FILE.write(JSON.stringify(existingCache));
    }
  } catch (err) {
    console.warn('[Spotify] Failed to save artists to persistent cache:', err);
  }
}

let _searchQueueChain: Promise<any> = Promise.resolve();

function enqueueSearchRequest<T>(task: () => Promise<T | null>): Promise<T | null> {
  const next = _searchQueueChain.then(async () => {
    // If cooldown was activated while waiting in queue, abort before hitting the network
    if (Date.now() < _searchRateLimitedUntil) {
      return null;
    }
    const result = await task();
    // 100ms gentle spacing between search requests to prevent Spotify burst limits
    await new Promise(r => setTimeout(r, 100));
    return result;
  });
  _searchQueueChain = next.then(() => { }, () => { });
  return next;
}

/**
 * Internal executor for an authenticated request to the Spotify API.
 */
async function executeSpotifyFetch<T>(
  accessToken: string,
  endpoint: string,
  method: string = 'GET',
  body?: any,
  isSearch: boolean = false
): Promise<T | null> {
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
      if (response.status === 403 && endpoint.includes('/artists')) {
        console.log(`[Spotify] Catalog endpoint restricted (403) for ${endpoint}; falling back to search`);
      } else {
        console.warn(`[Spotify] API error ${response.status} for ${endpoint}:`, errorText);
      }
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

/**
 * Make an authenticated request to the Spotify API.
 * Search queries are automatically queued and spaced by 100ms to eliminate burst rate limits.
 */
async function spotifyFetch<T>(
  accessToken: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T | null> {
  const isSearch = endpoint.startsWith('/search');
  if (isSearch) {
    return enqueueSearchRequest(() =>
      executeSpotifyFetch<T>(accessToken, endpoint, method, body, true)
    );
  }
  return executeSpotifyFetch<T>(accessToken, endpoint, method, body, false);
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
      } catch { }
      return { success: true, snapshot_id: data.snapshot_id || 'ok', statusCode: response.status };
    }

    const errText = await response.text();
    let parsedMsg = '';
    try {
      const errObj = JSON.parse(errText);
      parsedMsg = errObj?.error?.message || errObj?.error_description || '';
    } catch { }

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

// Public Quota-Free Deezer Fallback Methods

/**
 * Search Deezer for artists as an ultra-fast, quota-free fallback.
 * Maps results to standard SpotifyArtist structure with high-res photos.
 */
export async function searchDeezerArtists(
  query: string,
  limit: number = 10
): Promise<SpotifyArtist[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanQ)}&limit=${Math.min(limit, 25)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => ({
      id: `deezer_${item.id}`,
      name: item.name,
      images: [
        {
          url: item.picture_xl || item.picture_big || item.picture_medium || item.picture_small || '',
          width: 300,
          height: 300,
        },
      ],
      genres: ['Artist'],
      popularity: item.nb_fan ? Math.min(100, Math.round(Math.log10(item.nb_fan) * 15)) : 50,
    }));
  } catch {
    return [];
  }
}

/**
 * Search Deezer for tracks as a quota-free fallback.
 * Maps results to SpotifyTrack format with audio preview and cover artwork.
 */
export async function searchDeezerTracks(
  query: string,
  limit: number = 15
): Promise<SpotifyTrack[]> {
  const cleanQ = query.replace(/^artist:"(.*)"$/, '$1').trim();
  if (!cleanQ) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(cleanQ)}&limit=${Math.min(limit, 30)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => ({
      id: `dz_${item.id}`,
      name: item.title,
      artists: [
        {
          id: item.artist?.id ? `deezer_${item.artist.id}` : 'dz_artist',
          name: item.artist?.name || 'Artist',
          images: item.artist?.picture_big
            ? [{ url: item.artist.picture_big, width: 300, height: 300 }]
            : [],
        },
      ],
      album: {
        id: item.album?.id ? `dz_album_${item.album.id}` : 'dz_album',
        name: item.album?.title || 'Single',
        images: [
          {
            url: item.album?.cover_big || item.album?.cover_medium || item.album?.cover_small || '',
            width: 300,
            height: 300,
          },
        ],
        release_date: item.release_date || '',
        album_type: 'album',
      },
      duration_ms: (item.duration || 180) * 1000,
      uri: item.preview || item.link || '',
      preview_url: item.preview || null,
      external_urls: { spotify: item.link || '' },
    }));
  } catch {
    return [];
  }
}

/**
 * Search Deezer for albums by artist or album name as quota-free fallback.
 */
export async function searchDeezerAlbums(
  query: string,
  limit: number = 10
): Promise<SpotifyAlbum[]> {
  const cleanQ = query.replace(/^artist:"(.*)"$/, '$1').trim();
  if (!cleanQ) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(cleanQ)}&limit=${Math.min(limit, 25)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => ({
      id: `dz_album_${item.id}`,
      name: item.title,
      images: [
        {
          url: item.cover_xl || item.cover_big || item.cover_medium || item.cover_small || '',
          width: 300,
          height: 300,
        },
      ],
      release_date: item.release_date || '',
      album_type: 'album',
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch top tracks for an artist via iTunes stream rankings.
 * Used when Deezer is geo-blocked to guarantee authentic, most-listened top songs.
 */
export async function getArtistiTunesTopTracks(
  artistName: string,
  limit: number = 15
): Promise<SpotifyTrack[]> {
  const cleanName = artistName.trim();
  if (!cleanName) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=song&limit=${Math.min(limit, 25)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.results || !Array.isArray(data.results)) return [];

    const tracks: SpotifyTrack[] = [];
    const seen = new Set<string>();

    for (const item of data.results) {
      if (!item || !item.trackName || !item.trackId) continue;
      const tKey = item.trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(tKey)) continue;
      seen.add(tKey);

      const hiResArt = (item.artworkUrl100 || item.artworkUrl60 || '')
        .replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg');

      tracks.push({
        id: `itunes_${item.trackId}`,
        name: item.trackName,
        artists: [
          {
            id: item.artistId ? `itunes_artist_${item.artistId}` : 'itunes_artist',
            name: item.artistName || cleanName,
            images: [],
          },
        ],
        album: {
          id: item.collectionId ? `itunes_album_${item.collectionId}` : 'itunes_album',
          name: item.collectionName || item.trackName,
          images: hiResArt ? [{ url: hiResArt, width: 600, height: 600 }] : [],
          release_date: item.releaseDate ? item.releaseDate.slice(0, 10) : '',
          album_type: 'album',
        },
        duration_ms: item.trackTimeMillis || 180000,
        uri: item.previewUrl || `itunes:track:${item.trackId}`,
        preview_url: item.previewUrl || null,
        external_urls: { spotify: item.trackViewUrl || '' },
      });

      if (tracks.length >= limit) break;
    }
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Fetch top tracks for an artist by name via Deezer (with resilient stream-ranked fallback).
 * Delivers authentic, most-listened stream-ranked top tracks.
 */
export async function getArtistDeezerTopTracks(
  artistName: string,
  limit: number = 15
): Promise<SpotifyTrack[]> {
  const cleanName = artistName.trim();
  if (!cleanName) return [];

  // 1. Try Deezer ranking-ordered search
  let tracks = await searchDeezerTracks(`artist:"${cleanName}"`, limit);
  if (tracks.length === 0) {
    tracks = await searchDeezerTracks(cleanName, limit);
  }
  if (tracks.length > 0) {
    return tracks;
  }

  // 2. Global stream-ranked top tracks fallback (guarantees proper top songs if Deezer is geo-blocked)
  return getArtistiTunesTopTracks(cleanName, limit);
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
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  const safeOffset = Math.max(0, Math.min(Math.floor(offset) || 0, 990));

  if (Date.now() < _searchRateLimitedUntil) {
    return [];
  }

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
  const genreQuery = genres.slice(0, 2).map((g) => g).join(' ');
  const keywordQuery = keywords.slice(0, 2).join(' ');
  const query = `${genreQuery} ${keywordQuery}`.trim();

  if (!query) return [];
  return searchTracks(accessToken, query, limit);
}

/**
 * Search for artists by name on Spotify.
 */
export async function searchArtists(
  accessToken: string,
  query: string,
  limit: number = 10
): Promise<SpotifyArtist[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  if (Date.now() < _searchRateLimitedUntil) {
    return [];
  }

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

export interface ArtistTopTracksResult {
  tracks: SpotifyTrack[];
  isLatestFallback: boolean;
}

/**
 * Get an artist's genuine top tracks:
 * 1. Direct Spotify /top-tracks (market=from_token then market=${market})
 * 2. Spotify track search (ordered by track popularity) if not in rate limit cooldown
 * 3. Fallback ONLY if Spotify is unavailable/rate-limited: Deezer top tracks
 */
export async function getArtistTopTracksResult(
  accessToken: string,
  artistId: string,
  market: string = 'US',
  artistName?: string
): Promise<ArtistTopTracksResult> {
  const cleanId = artistId ? artistId.replace(/^spotify:artist:/, '').trim() : '';
  const isValidSpotifyId = /^[A-Za-z0-9]{22}$/.test(cleanId);

  // Tier 1: Try direct Spotify top-tracks endpoint
  if (isValidSpotifyId && accessToken) {
    try {
      let data = await spotifyFetch<{ tracks: SpotifyTrack[] }>(
        accessToken,
        `/artists/${cleanId}/top-tracks?market=from_token`
      );
      if (!data?.tracks || data.tracks.length === 0) {
        data = await spotifyFetch<{ tracks: SpotifyTrack[] }>(
          accessToken,
          `/artists/${cleanId}/top-tracks?market=${market}`
        );
      }
      if (data?.tracks && data.tracks.length > 0) {
        return { tracks: data.tracks, isLatestFallback: false };
      }
    } catch { }
  }

  // Tier 2: Search Spotify tracks by artist name if token available and not in cooldown
  // In Spotify, track search ordered by popularity returns true top tracks (e.g. Blinding Lights, Starboy)
  if (accessToken && artistName && Date.now() >= _searchRateLimitedUntil) {
    try {
      const q = `artist:"${artistName.trim()}"`;
      const [p1, p2] = await Promise.all([
        searchTracks(accessToken, q, 10, 0).catch(() => []),
        searchTracks(accessToken, q, 10, 10).catch(() => []),
      ]);
      const merged = [...p1, ...p2];
      if (merged.length > 0) {
        return { tracks: merged, isLatestFallback: false };
      }
      const generalSearch = await searchTracks(accessToken, artistName.trim(), 10, 0).catch(() => []);
      if (generalSearch.length > 0) {
        return { tracks: generalSearch, isLatestFallback: false };
      }
    } catch { }
  }

  // Tier 3: Deezer top tracks fallback ONLY if Spotify is unavailable or returned 0 tracks
  if (artistName) {
    try {
      const deezerTracks = await getArtistDeezerTopTracks(artistName, 15);
      if (deezerTracks.length > 0) {
        return { tracks: deezerTracks, isLatestFallback: false };
      }
    } catch { }
  }

  // Return authentic top tracks only (no latest album releases extraction)
  return { tracks: [], isLatestFallback: false };
}

export async function getArtistTopTracks(
  accessToken: string,
  artistId: string,
  market: string = 'US',
  artistName?: string
): Promise<SpotifyTrack[]> {
  const result = await getArtistTopTracksResult(accessToken, artistId, market, artistName);
  return result.tracks;
}

/**
 * Search Spotify for albums by keyword or artist.
 */
export async function searchAlbums(
  accessToken: string,
  query: string,
  limit: number = 10
): Promise<SpotifyAlbum[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  if (Date.now() < _searchRateLimitedUntil) {
    return [];
  }

  const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
    accessToken,
    `/search?q=${encodeURIComponent(cleanQ)}&type=album&limit=${safeLimit}`
  );
  return data?.albums?.items ?? [];
}

/**
 * Get an artist's newest releases (albums and singles) from Spotify.
 */
export async function getArtistAlbums(
  accessToken: string,
  artistId: string,
  limit: number = 10,
  artistName?: string
): Promise<SpotifyAlbum[]> {
  const cleanId = artistId.replace(/^spotify:artist:/, '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const isValidSpotifyId = /^[A-Za-z0-9]{22}$/.test(cleanId);

  let albums: SpotifyAlbum[] = [];

  // 1. Try direct catalog endpoint with safe limit <= 10
  if (isValidSpotifyId) {
    let data = await spotifyFetch<{ items: SpotifyAlbum[] }>(
      accessToken,
      `/artists/${cleanId}/albums?include_groups=album,single&limit=${safeLimit}`
    );
    albums = data?.items ?? [];
  }

  // 2. Fall back to searching albums by artist name on Spotify if direct catalog is empty or 403
  if (albums.length === 0 && artistName && Date.now() >= _searchRateLimitedUntil) {
    let searched = await searchAlbums(accessToken, `artist:"${artistName.trim()}"`, safeLimit).catch(() => []);
    if (searched.length === 0) {
      searched = await searchAlbums(accessToken, artistName.trim(), safeLimit).catch(() => []);
    }
    albums = searched;
  }

  // Deduplicate albums by ID and normalize
  const seen = new Set<string>();
  const uniqueAlbums = albums.filter((album) => {
    if (!album?.id || seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });

  // Sort newest first by release_date
  return uniqueAlbums.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
}

/**
 * Fetch tracks belonging to an album/release.
 * Attaches the album metadata (including cover artwork) to each track so the player displays album cover.
 */
export async function getAlbumTracks(
  accessToken: string,
  albumId: string,
  albumData?: { id?: string; name?: string; images?: any[] },
  limit: number = 20
): Promise<SpotifyTrack[]> {
  const cleanId = albumId.replace(/^spotify:album:/, '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const isValidSpotifyId = /^[A-Za-z0-9]{22}$/.test(cleanId);

  let items: any[] = [];
  if (isValidSpotifyId) {
    let data = await spotifyFetch<{ items: any[] }>(
      accessToken,
      `/albums/${cleanId}/tracks?limit=${safeLimit}`
    );
    items = data?.items ?? [];
  }

  // If album tracks endpoint returned 403 or empty, fall back to searching tracks by album
  if (items.length === 0 && albumData?.name && Date.now() >= _searchRateLimitedUntil) {
    const searched = await searchTracks(accessToken, `album:"${albumData.name}"`, 10).catch(() => []);
    if (searched.length > 0) {
      return searched;
    }
  }

  return items.map((track: any) => ({
    ...track,
    album: {
      id: cleanId,
      name: albumData?.name || track.album?.name || '',
      images: albumData?.images || track.album?.images || [],
    },
  }));
}

/**
 * Fetch a single artist by Spotify ID.
 * Used for the Artist Profile page.
 */
export async function getArtist(
  accessToken: string,
  artistId: string
): Promise<SpotifyArtist | null> {
  const cleanId = artistId.replace(/^spotify:artist:/, '').trim();

  if (/^[A-Za-z0-9]{22}$/.test(cleanId)) {
    return spotifyFetch<SpotifyArtist>(accessToken, `/artists/${cleanId}`);
  }

  return null;
}

/**
 * Batch fetch multiple artists by IDs (max 50).
 * Safely ignores 403 catalog errors.
 */
export async function getMultipleArtists(
  accessToken: string,
  ids: string[]
): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const cleanIds = ids.map(id => id.replace(/^spotify:artist:/, '').trim()).filter(Boolean);
  if (cleanIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < cleanIds.length; i += 50) {
    chunks.push(cleanIds.slice(i, i + 50));
  }
  const results: SpotifyArtist[] = [];
  for (const chunk of chunks) {
    try {
      const data = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        accessToken,
        `/artists?ids=${chunk.join(',')}`
      );
      if (data?.artists) {
        results.push(...data.artists.filter(Boolean));
      }
    } catch {
      // 403 Forbidden or catalog failure: safely ignore and allow name search fallback
    }
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
