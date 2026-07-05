/**
 * MoodMap — useSpotify Hook
 * React hook that wraps Spotify API interactions with:
 * VIP tier gating, OAuth flow management via expo-auth-session
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { useTierStore } from '@/stores/tierStore';
import { useMusic } from '@/context/MusicContext';
import {
  SPOTIFY_DISCOVERY,
  getAuthRequestConfig,
  exchangeCodeForTokens,
  getCurrentUser,
  getCurrentlyPlaying,
  getUserPlaylists,
  getTopTracks,
  getRecentlyPlayed,
  searchTracks,
  searchForMood,
  play as spotifyPlay,
  pause as spotifyPause,
  nextTrack as spotifyNext,
  previousTrack as spotifyPrev,
  addToQueue as spotifyAddToQueue,
  formatDuration as spotifyFormatDuration,
  getBestImage as spotifyGetBestImage,
  type SpotifyUser,
  type SpotifyCurrentTrack,
  type SpotifyPlaylist,
  type SpotifyTrack,
  type SpotifyPlayHistory,
} from '@/services/spotify';

// Types

interface UseSpotifyReturn {
  // State
  isVIP: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  spotifyUser: SpotifyUser | null;
  nowPlaying: SpotifyCurrentTrack | null;
  playlists: SpotifyPlaylist[];
  topTracks: SpotifyTrack[];
  recentlyPlayed: SpotifyPlayHistory[];

  // Auth Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Playback Actions
  play: (uris?: string | string[], contextUri?: string, offset?: { uri: string } | { position: number }) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  addToQueue: (uri: string) => Promise<void>;
  getQueueList: () => Promise<{ currently_playing: any; queue: any[] } | null>;
  openInSpotify: (uri: string) => void;

  // Data Actions
  refreshNowPlaying: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  loadTopTracks: (timeRange?: 'short_term' | 'medium_term' | 'long_term') => Promise<void>;
  loadRecentlyPlayed: () => Promise<void>;
  search: (query: string) => Promise<SpotifyTrack[]>;
  searchByMood: (genres: string[], keywords: string[]) => Promise<SpotifyTrack[]>;
}

// Now Playing Poll Interval
const NOW_PLAYING_POLL_MS = 10000; // 10 seconds — avoids Spotify 429 rate limits while staying responsive

// Hook

export function useSpotify(): UseSpotifyReturn {
  const isVIP = useTierStore((s) => s.isVIP);
  const spotifyConnected = useTierStore((s) => s.spotifyConnected);
  const getValidAccessToken = useTierStore((s) => s.getValidAccessToken);
  const setSpotifyTokens = useTierStore((s) => s.setSpotifyTokens);
  const clearSpotifyTokens = useTierStore((s) => s.clearSpotifyTokens);
  const { currentTrack, isPlaying, updateSpotifyPlayback, playbackRefreshRequest } = useMusic();

  const [isConnecting, setIsConnecting] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [nowPlaying, setNowPlaying] = useState<SpotifyCurrentTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyPlayHistory[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeVerifierRef = useRef<string | null>(null);

  // Auth request setup
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    getAuthRequestConfig(),
    SPOTIFY_DISCOVERY
  );

  // Handle OAuth Response

  useEffect(() => {
    if (!response || response.type !== 'success' || !response.params.code) return;

    const code = response.params.code;
    const verifier = request?.codeVerifier;

    if (!verifier) {
      console.warn('[Spotify] No code verifier available');
      return;
    }

    (async () => {
      setIsConnecting(true);
      try {
        const tokens = await exchangeCodeForTokens(code, verifier);
        if (tokens) {
          await setSpotifyTokens(tokens);

          // Fetch user profile
          const user = await getCurrentUser(tokens.accessToken);
          if (user) setSpotifyUser(user);

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        console.warn('[Spotify] OAuth completion error:', e);
      } finally {
        setIsConnecting(false);
      }
    })();
  }, [response]);

  // Load User on Connect

  useEffect(() => {
    if (!isVIP || !spotifyConnected) {
      setSpotifyUser(null);
      return;
    }

    (async () => {
      try {
        const token = await getValidAccessToken();
        if (token) {
          const user = await getCurrentUser(token);
          if (user) setSpotifyUser(user);
        }
      } catch (err) {
        console.warn('[useSpotify] Failed to load user profile on connect:', err);
      }
    })();
  }, [isVIP, spotifyConnected]);

  // Now Playing Polling

  const refreshNowPlaying = useCallback(async () => {
    if (!isVIP || !spotifyConnected) return;

    try {
      const token = await getValidAccessToken();
      if (!token) return;

      const current = await getCurrentlyPlaying(token);
      setNowPlaying(current);

      // Sync playback state back to MusicContext if playing Spotify
      if (currentTrack?.category === 'spotify' || (!currentTrack && current?.is_playing)) {
        if (current && current.item) {
          const progressSec = current.progress_ms / 1000;
          const durationSec = current.item.duration_ms / 1000;
          
          const trackInfo = {
            id: 'spotify_' + current.item.id,
            title: current.item.name,
            artist: current.item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist',
            url: current.item.uri,
            cover: spotifyGetBestImage(current.item.album?.images || [], 300) ?? '',
            duration: spotifyFormatDuration(current.item.duration_ms),
            durationSec: Math.floor(current.item.duration_ms / 1000),
          };

          updateSpotifyPlayback(progressSec, durationSec, current.is_playing, trackInfo);
        } else {
          updateSpotifyPlayback(0, 0, false);
        }
      }
    } catch (err) {
      console.warn('[useSpotify] Error refreshing now playing state:', err);
    }
  }, [isVIP, spotifyConnected, getValidAccessToken, currentTrack, updateSpotifyPlayback]);

  useEffect(() => {
    if (!isVIP || !spotifyConnected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setNowPlaying(null);
      return;
    }

    const isSpotifyActive = currentTrack?.category === 'spotify';

    // Fetch once on mount/foreground transition to get initial state
    refreshNowPlaying().catch(err => {
      console.warn('[useSpotify] Initial now playing refresh failed:', err);
    });

    // Determine the poll interval based on playing state
    // 5 seconds when playing for fast seek/skip sync; 15 seconds when paused to detect external resumes safely.
    const pollInterval = isPlaying ? 5000 : 15000;

    // If Spotify is active, poll while the app is in the foreground
    if (isSpotifyActive) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = setInterval(() => {
        refreshNowPlaying().catch(err => {
          console.warn('[useSpotify] Polled now playing refresh failed:', err);
        });
      }, pollInterval);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    // Pause/resume polling based on app state (only poll if playing Spotify and app is active)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshNowPlaying().catch(err => {
          console.warn('[useSpotify] App active now playing refresh failed:', err);
        });
        if (isSpotifyActive) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
          pollRef.current = setInterval(() => {
            refreshNowPlaying().catch(err => {
              console.warn('[useSpotify] App active polled now playing refresh failed:', err);
            });
          }, pollInterval);
        }
      } else {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      sub.remove();
    };
  }, [isVIP, spotifyConnected, refreshNowPlaying, currentTrack?.id, isPlaying]);

  // Trigger immediate refresh when the playback timer reaches the end of the song
  useEffect(() => {
    if (playbackRefreshRequest > 0 && spotifyConnected && isVIP) {
      refreshNowPlaying().catch(err => {
        console.warn('[useSpotify] Immediate end-of-track refresh failed:', err);
      });
    }
  }, [playbackRefreshRequest, spotifyConnected, isVIP, refreshNowPlaying]);

  // Auth Actions

  const connect = useCallback(async () => {
    if (!isVIP || !request) return;

    setIsConnecting(true);
    try {
      await promptAsync();
    } catch (e) {
      console.warn('[Spotify] Auth prompt error:', e);
      setIsConnecting(false);
    }
  }, [isVIP, request, promptAsync]);

  const disconnect = useCallback(async () => {
    try {
      await clearSpotifyTokens();
      setSpotifyUser(null);
      setNowPlaying(null);
      setPlaylists([]);
      setTopTracks([]);
      setRecentlyPlayed([]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn('[useSpotify] Disconnect error:', err);
    }
  }, [clearSpotifyTokens]);

  // Playback Actions

  const play = useCallback(async (uris?: string | string[], contextUri?: string, offset?: { uri: string } | { position: number }) => {
    try {
      const token = await getValidAccessToken();
      if (token) await spotifyPlay(token, uris, undefined, contextUri, offset);
    } catch (err) {
      console.warn('[useSpotify] play action error:', err);
      throw err;
    }
  }, [getValidAccessToken]);

  const pause = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) await spotifyPause(token);
    } catch (err) {
      console.warn('[useSpotify] pause action error:', err);
    }
  }, [getValidAccessToken]);

  const next = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) await spotifyNext(token);
    } catch (err) {
      console.warn('[useSpotify] next action error:', err);
    }
  }, [getValidAccessToken]);

  const prev = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) await spotifyPrev(token);
    } catch (err) {
      console.warn('[useSpotify] prev action error:', err);
    }
  }, [getValidAccessToken]);

  const addToQueue = useCallback(async (uri: string) => {
    try {
      const token = await getValidAccessToken();
      if (token) await spotifyAddToQueue(token, uri);
    } catch (err) {
      console.warn('[useSpotify] addToQueue action error:', err);
    }
  }, [getValidAccessToken]);

  const getQueueList = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const { getQueue } = require('../services/spotify');
        return await getQueue(token);
      }
    } catch (err) {
      console.warn('[useSpotify] getQueueList error:', err);
    }
    return null;
  }, [getValidAccessToken]);

  const openInSpotify = useCallback((uri: string) => {
    // Deep link into Spotify app
    Linking.openURL(uri).catch(() => {
      // Fallback to web
      const webUrl = uri
        .replace('spotify:track:', 'https://open.spotify.com/track/')
        .replace('spotify:playlist:', 'https://open.spotify.com/playlist/')
        .replace('spotify:album:', 'https://open.spotify.com/album/');
      Linking.openURL(webUrl).catch(() => {});
    });
  }, []);

  // Data Actions

  const loadPlaylists = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const data = await getUserPlaylists(token);
        setPlaylists(data);
      }
    } catch (err) {
      console.warn('[useSpotify] Failed to load playlists:', err);
    }
  }, [getValidAccessToken]);

  const loadTopTracks = useCallback(
    async (timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term') => {
      try {
        const token = await getValidAccessToken();
        if (token) {
          const data = await getTopTracks(token, timeRange);
          setTopTracks(data);
        }
      } catch (err) {
        console.warn('[useSpotify] Failed to load top tracks:', err);
      }
    },
    [getValidAccessToken]
  );

  const loadRecentlyPlayed = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const data = await getRecentlyPlayed(token);
        setRecentlyPlayed(data);
      }
    } catch (err) {
      console.warn('[useSpotify] Failed to load recently played:', err);
    }
  }, [getValidAccessToken]);

  const search = useCallback(
    async (query: string): Promise<SpotifyTrack[]> => {
      try {
        const token = await getValidAccessToken();
        if (!token) return [];
        return await searchTracks(token, query);
      } catch (err) {
        console.warn('[useSpotify] search error:', err);
        return [];
      }
    },
    [getValidAccessToken]
  );

  const searchByMood = useCallback(
    async (genres: string[], keywords: string[]): Promise<SpotifyTrack[]> => {
      try {
        const token = await getValidAccessToken();
        if (!token) return [];
        return await searchForMood(token, genres, keywords);
      } catch (err) {
        console.warn('[useSpotify] searchByMood error:', err);
        return [];
      }
    },
    [getValidAccessToken]
  );

  // Return

  return {
    isVIP,
    isConnected: spotifyConnected,
    isConnecting,
    spotifyUser,
    nowPlaying,
    playlists,
    topTracks,
    recentlyPlayed,

    connect,
    disconnect,

    play,
    pause,
    next,
    prev,
    addToQueue,
    getQueueList,
    openInSpotify,

    refreshNowPlaying,
    loadPlaylists,
    loadTopTracks,
    loadRecentlyPlayed,
    search,
    searchByMood,
  };
}
