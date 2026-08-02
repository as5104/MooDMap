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
  getTopArtists,
  getRecentlyPlayed,
  searchTracks,
  searchArtists,
  getMultipleArtists,
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
  type SpotifyArtist,
  type SpotifyPlayHistory,
} from '@/services/spotify';
import {
  getVIPSmartRecommendations,
  recordRecommendationSignal,
  type RecommendationRequestOptions,
  type RecommendedTrack,
} from '@/services/recommendationEngine';
import { getMusicPreferences } from '@/services/musicPreferenceService';
import type { MoodType } from '@/constants/moods';
import { useAppStore } from '@/stores/appStore';


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

  // VIP Recommendation & Survey Actions
  searchArtistsForSurvey: (query: string) => Promise<SpotifyArtist[]>;
  loadTopArtistsForSurvey: () => Promise<SpotifyArtist[]>;
  getVIPRecommendations: (
    mood: MoodType,
    moodScore?: number,
    limit?: number,
    options?: RecommendationRequestOptions,
  ) => Promise<RecommendedTrack[]>;
  reportTrackSkip: (trackId: string, mood: MoodType) => void;
  reportTrackCompletion: (trackId: string, mood: MoodType) => void;
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
      setPlaylists([]);
      return;
    }

    (async () => {
      try {
        const token = await getValidAccessToken();
        if (token) {
          const user = await getCurrentUser(token);
          if (user) setSpotifyUser(user);
          const data = await getUserPlaylists(token);
          if (data) setPlaylists(data);
        }
      } catch (err) {
        console.warn('[useSpotify] Failed to load user profile & playlists on connect:', err);
      }
    })();
  }, [isVIP, spotifyConnected, getValidAccessToken]);

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

    // Always attempt initial fetch and load playlists on mount/connect
    refreshNowPlaying().catch(err => {
      console.warn('[useSpotify] Initial now playing refresh failed:', err);
    });

    const isSpotifyActive = currentTrack?.category === 'spotify' || !!nowPlaying?.is_playing;
    const pollInterval = isPlaying ? 5000 : 12000;

    // Start polling while Spotify is connected and active
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = setInterval(() => {
      refreshNowPlaying().catch(err => {
        console.warn('[useSpotify] Polled now playing refresh failed:', err);
      });
    }, pollInterval);

    // Sync state and resume polling automatically on app foregrounding (coming from RAM)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshNowPlaying().catch(err => {
          console.warn('[useSpotify] App active now playing refresh failed:', err);
        });

        // Ensure user playlists are loaded if state was empty
        if (playlists.length === 0) {
          getValidAccessToken().then(token => {
            if (token) {
              getUserPlaylists(token).then(data => {
                if (data && data.length > 0) setPlaylists(data);
              }).catch(() => {});
            }
          }).catch(() => {});
        }

        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
        pollRef.current = setInterval(() => {
          refreshNowPlaying().catch(err => {
            console.warn('[useSpotify] App active polled now playing refresh failed:', err);
          });
        }, pollInterval);
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
  }, [isVIP, spotifyConnected, refreshNowPlaying, currentTrack?.id, isPlaying, nowPlaying?.is_playing]);

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

  const searchArtistsForSurvey = useCallback(
    async (query: string): Promise<SpotifyArtist[]> => {
      const q = query.trim();
      if (!q) return [];

      let spotifyResults: SpotifyArtist[] = [];
      try {
        const token = await getValidAccessToken();
        if (token) {
          spotifyResults = await searchArtists(token, q, 30);
        }
      } catch (err) {
        console.warn('[useSpotify] Spotify search failed, using fallback:', err);
      }

      // Fetch Deezer HD artist photos as universal photo enrichment & fallback
      try {
        const deezerRes = await fetch(
          `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=30`
        );
        if (deezerRes.ok) {
          const deezerData = await deezerRes.json();
          if (deezerData?.data && deezerData.data.length > 0) {
            const deezerArtists: SpotifyArtist[] = deezerData.data.map((item: any) => ({
              id: `deezer_${item.id}`,
              name: item.name,
              images: [
                { url: item.picture_big || item.picture_medium || item.picture_small || '' },
              ],
            }));

            if (spotifyResults.length === 0) {
              return deezerArtists;
            }

            // Enrich Spotify results with Deezer photos if Spotify photo is missing
            const deezerMap = new Map(
              deezerArtists.map((d) => [d.name.toLowerCase().replace(/[^a-z0-9]/g, ''), d])
            );

            return spotifyResults.map((sArtist) => {
              const hasPhoto = sArtist.images && sArtist.images.length > 0 && !!sArtist.images[0]?.url;
              if (hasPhoto) return sArtist;

              const cleanKey = sArtist.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const dMatch = deezerMap.get(cleanKey);
              if (dMatch && dMatch.images?.length) {
                return { ...sArtist, images: dMatch.images };
              }
              return sArtist;
            });
          }
        }
      } catch (e) {
        console.warn('[useSpotify] Deezer photo enrichment failed:', e);
      }

      if (spotifyResults.length > 0) return spotifyResults;

      // iTunes 3rd fallback
      try {
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=30`
        );
        if (itunesRes.ok) {
          const data = await itunesRes.json();
          if (data?.results && data.results.length > 0) {
            return data.results.map((item: any) => {
              // iTunes returns artworkUrl100 — upscale to 600x600 for HD
              const itunesImg = item.artworkUrl100
                ? item.artworkUrl100.replace('100x100', '600x600')
                : '';
              return {
                id: `artist_${item.artistId}`,
                name: item.artistName,
                genres: item.primaryGenreName ? [item.primaryGenreName] : [],
                images: itunesImg ? [{ url: itunesImg, width: 600, height: 600 }] : [],
              };
            });
          }
        }
      } catch (e) {
        console.warn('[useSpotify] iTunes artist search failed:', e);
      }

      return [];
    },
    [getValidAccessToken]
  );

  const loadTopArtistsForSurvey = useCallback(async (): Promise<SpotifyArtist[]> => {
    try {
      const token = await getValidAccessToken();
      if (!token) return [];
      const [shortTerm, mediumTerm, longTerm] = await Promise.all([
        getTopArtists(token, 'short_term', 20).catch(() => []),
        getTopArtists(token, 'medium_term', 20).catch(() => []),
        getTopArtists(token, 'long_term', 20).catch(() => []),
      ]);

      const seen = new Set<string>();
      const combined: SpotifyArtist[] = [];
      for (const artist of [...shortTerm, ...mediumTerm, ...longTerm]) {
        if (artist && artist.id && !seen.has(artist.id)) {
          seen.add(artist.id);
          combined.push(artist);
        }
      }
      return combined;
    } catch (err) {
      console.warn('[useSpotify] loadTopArtistsForSurvey error:', err);
      return [];
    }
  }, [getValidAccessToken]);

  const getVIPRecommendations = useCallback(
    async (
      mood: MoodType,
      moodScore: number = 7,
      limit: number = 12,
      options: RecommendationRequestOptions = {},
    ): Promise<RecommendedTrack[]> => {
      try {
        const user = useAppStore.getState().user;
        const userId = user?.id ?? null;
        const prefs = userId ? getMusicPreferences(userId) : null;

        let token = '';
        try {
          token = (await getValidAccessToken()) || '';
        } catch {
          token = '';
        }

        const TRACKS_LIBRARY = require('@/context/MusicContext').TRACKS_LIBRARY ?? [];

        return await getVIPSmartRecommendations(
          mood,
          moodScore,
          TRACKS_LIBRARY,
          userId ?? 'guest',
          token,
          playlists || [],
          prefs,
          limit,
          options,
        );
      } catch (err) {
        console.warn('[useSpotify] getVIPRecommendations error:', err);
        return [];
      }
    },
    [getValidAccessToken, playlists]
  );

  const reportTrackSkip = useCallback(
    (trackId: string, mood: MoodType) => {
      const user = useAppStore.getState().user;
      recordRecommendationSignal(user?.id ?? null, trackId, mood, 'skip');
    },
    []
  );

  const reportTrackCompletion = useCallback(
    (trackId: string, mood: MoodType) => {
      const user = useAppStore.getState().user;
      recordRecommendationSignal(user?.id ?? null, trackId, mood, 'complete');
    },
    []
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

    searchArtistsForSurvey,
    loadTopArtistsForSurvey,
    getVIPRecommendations,
    reportTrackSkip,
    reportTrackCompletion,
  };
}
