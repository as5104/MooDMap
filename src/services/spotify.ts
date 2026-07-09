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
  owner: { display_name: string };
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
): Promise<SpotifyTokens | null> {
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

    if (!response.ok) {
      console.warn('[Spotify] Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Spotify may or may not return a new one
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch (e) {
    console.warn('[Spotify] Token refresh error:', e);
    return null;
  }
}

// API Helpers

/**
 * Make an authenticated request to the Spotify API.
 */
async function spotifyFetch<T>(
  accessToken: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T | null> {
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

    if (response.status === 204) return null; // No content (successful play/pause)

    // Handle rate limiting — wait and retry once
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      console.warn(`[Spotify] Rate limited (429) for ${endpoint}. Retrying after ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      
      const retryResponse = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      
      if (retryResponse.status === 204) return null;
      if (!retryResponse.ok) {
        console.warn(`[Spotify] Retry also failed (${retryResponse.status}) for ${endpoint}`);
        return null; // Silently fail after retry — don't crash the app
      }
      
      const retryText = await retryResponse.text();
      if (!retryText || retryText.trim() === '') return null;
      try { return JSON.parse(retryText) as T; } catch (e) { return null; }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Spotify] API error ${response.status} for ${endpoint}:`, errorText);
      let message = `Spotify API error ${response.status}`;
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.error?.message) {
          message = errObj.error.message;
        }
      } catch (e) {}
      throw new Error(message);
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.log(`[Spotify] Non-JSON success response for ${endpoint}`);
      return null;
    }
  } catch (e) {
    console.warn(`[Spotify] Fetch error for ${endpoint}:`, e);
    throw e;
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
  return spotifyFetch<SpotifyPlaylist>(
    accessToken,
    `/users/${userId}/playlists`,
    'POST',
    {
      name,
      description: description ?? '',
      public: false,
    }
  );
}

// Search Endpoint

export interface SpotifySearchResult {
  tracks: { items: SpotifyTrack[] };
}

export async function searchTracks(
  accessToken: string,
  query: string,
  limit: number = 10
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<SpotifySearchResult>(
    accessToken,
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
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
  const genreQuery = genres.slice(0, 2).map((g) => `genre:"${g}"`).join(' ');
  const keywordQuery = keywords.slice(0, 2).join(' ');
  const query = `${genreQuery} ${keywordQuery}`.trim();

  if (!query) return [];
  return searchTracks(accessToken, query, limit);
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
