/**
 * MoodMap — useSpotify Hook
 * React hook that wraps Spotify API interactions with:
 * VIP tier gating, OAuth flow management via expo-auth-session
 */

import type { MoodType } from '@/constants/moods';
import { useMusic } from '@/context/MusicContext';
import { getMusicPreferences } from '@/services/musicPreferenceService';
import {
  generateContinuationBatch,
  getVIPSmartRecommendations,
  recordRecommendationSignal,
  type RecommendationRequestOptions,
  type RecommendedTrack,
} from '@/services/recommendationEngine';
import {
  SPOTIFY_DISCOVERY,
  exchangeCodeForTokens,
  getAuthRequestConfig,
  getCurrentUser,
  getCurrentlyPlaying,
  getRecentlyPlayed,
  getTrack,
  getTopArtists,
  getTopTracks,
  getUserPlaylists,
  createPlaylist as spotifyCreatePlaylist,
  addTracksToPlaylist as spotifyAddTracksToPlaylist,
  searchArtists,
  searchForMood,
  searchTracks,
  formatDuration as spotifyFormatDuration,
  getBestImage as spotifyGetBestImage,
  nextTrack as spotifyNext,
  pause as spotifyPause,
  play as spotifyPlay,
  type SpotifyArtist,
  type SpotifyCurrentTrack,
  type SpotifyPlayHistory,
  type SpotifyPlaylist,
  type SpotifyTrack,
  type SpotifyUser
} from '@/services/spotify';
import {
  getLatestSpotifyUserData,
  refreshSpotifyUserData
} from '@/services/spotifyDataCacheService';
import { useAppStore } from '@/stores/appStore';
import { createSpotifyPoller } from '@/services/spotifyPolling';
import { fetchWithDeadline } from '@/services/spotifyNetwork';
import { normalizePlaybackUris } from '@/services/spotifyPlayback';
import { getSpotifySessionGeneration, useTierStore } from '@/stores/tierStore';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';


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
  addTrackToSpotifyPlaylist: (playlistId: string, trackUri: string) => Promise<boolean>;
  createSpotifyPlaylist: (name: string, description?: string) => Promise<SpotifyPlaylist | null>;
  loadTopTracks: (timeRange?: 'short_term' | 'medium_term' | 'long_term') => Promise<void>;
  loadRecentlyPlayed: () => Promise<void>;
  refreshSession: () => Promise<void>;
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
  getContinuationBatch: (
    mood: MoodType,
    moodScore: number,
    completedTrackIds: string[],
    skippedTrackIds: string[],
    allPreviousTrackIds: string[],
    limit?: number,
    previousArtistNames?: string[],
  ) => Promise<RecommendedTrack[]>;
  reportTrackSkip: (trackId: string, mood: MoodType) => void;
  reportTrackCompletion: (trackId: string, mood: MoodType) => void;
  refreshDailySpotifyData: () => Promise<void>;
}

const playbackPoller = createSpotifyPoller<SpotifyCurrentTrack>(async () => {
  const store = useTierStore.getState();
  if (!store.isVIP || !store.spotifyConnected) return null;
  const token = await store.getValidAccessToken();
  return token ? getCurrentlyPlaying(token, true) : null;
});

// Hook

const _surveyArtistSearchCache = new Map<string, SpotifyArtist[]>();

export function useSpotify(): UseSpotifyReturn {
  const isVIP = useTierStore((s) => s.isVIP);
  const spotifyConnected = useTierStore((s) => s.spotifyConnected);
  const getValidAccessToken = useTierStore((s) => s.getValidAccessToken);
  const setSpotifyTokens = useTierStore((s) => s.setSpotifyTokens);
  const clearSpotifyTokens = useTierStore((s) => s.clearSpotifyTokens);
  const { currentTrack, isPlaying, updateSpotifyPlayback, playbackRefreshRequest, addToQueue: addMusicTrackToQueue } = useMusic();

  const [isConnecting, setIsConnecting] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [nowPlaying, setNowPlaying] = useState<SpotifyCurrentTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyPlayHistory[]>([]);


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

    let cancelled = false;
    const generation = getSpotifySessionGeneration();
    const appUserId = useAppStore.getState().user?.id;
    const isCurrentSession = () => !cancelled
      && generation === getSpotifySessionGeneration()
      && useTierStore.getState().isVIP
      && useAppStore.getState().user?.id === appUserId;

    (async () => {
      setIsConnecting(true);
      try {
        const tokens = await exchangeCodeForTokens(code, verifier);
        if (tokens && isCurrentSession()) {
          await setSpotifyTokens(tokens);
          if (!isCurrentSession()) return;

          // Fetch user profile
          const user = await getCurrentUser(tokens.accessToken);
          if (!isCurrentSession()) return;
          if (user) setSpotifyUser(user);

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        console.warn('[Spotify] OAuth completion error:', e);
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [response, request?.codeVerifier, setSpotifyTokens]);

  // Load User on Connect

  useEffect(() => {
    if (!isVIP || !spotifyConnected) {
      setSpotifyUser(null);
      setPlaylists([]);
      setTopTracks([]);
      setRecentlyPlayed([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getValidAccessToken();
        if (cancelled) return;
        if (token) {
          const user = await getCurrentUser(token);
          if (cancelled) return;
          if (user) setSpotifyUser(user);
          const data = await getUserPlaylists(token);
          if (cancelled) return;
          if (data && data.length > 0) setPlaylists(data);

          // Trigger daily Spotify user data cache refresh
          const appUser = useAppStore.getState().user;
          if (appUser?.id) {
            refreshSpotifyUserData(appUser.id, token).catch(e =>
              console.warn('[useSpotify] Daily data cache refresh failed:', e)
            );
          }
        }
      } catch (err) {
        console.warn('[useSpotify] Failed to load user profile & playlists on connect:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isVIP, spotifyConnected, getValidAccessToken]);

  // Now Playing Polling

  const refreshNowPlaying = useCallback(() => playbackPoller.refresh(), []);

  useEffect(() => {
    if (!isVIP || !spotifyConnected) {
      setNowPlaying(null);
      return;
    }
    playbackPoller.setForeground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const unsubscribe = playbackPoller.subscribe((current, requestedAt) => {
      if (!current) return;
      setNowPlaying(current);
      if (currentTrack?.category !== 'spotify' && (currentTrack?.category || !current.is_playing)) return;
      if (current.item) {
        const item = current.item;
        updateSpotifyPlayback(current.progress_ms / 1000, item.duration_ms / 1000, current.is_playing, {
          id: 'spotify_' + item.id,
          title: item.name,
          artist: item.artists?.map(a => a.name).join(', ') ?? 'Unknown Artist',
          url: item.uri,
          cover: spotifyGetBestImage(item.album?.images || [], 300) ?? '',
          duration: spotifyFormatDuration(item.duration_ms),
          durationSec: Math.floor(item.duration_ms / 1000),
        }, requestedAt);
      } else {
        updateSpotifyPlayback(0, 0, current.is_playing, undefined, requestedAt);
      }
    }, isPlaying ? 5000 : 12000);
    const appState = AppState.addEventListener('change', state => playbackPoller.setForeground(state === 'active'));
    return () => { unsubscribe(); appState.remove(); };
  }, [isVIP, spotifyConnected, currentTrack?.category, isPlaying, updateSpotifyPlayback]);

  useEffect(() => {
    if (playbackRefreshRequest > 0 && spotifyConnected && isVIP) void refreshNowPlaying();
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
      if (token) {
        await spotifyPlay(token, uris, undefined, contextUri, offset);
      }
    } catch (err) {
      console.warn('[useSpotify] Play error:', err);
    }
  }, [getValidAccessToken]);

  const pause = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        await spotifyPause(token);
      }
    } catch (err) {
      console.warn('[useSpotify] Pause error:', err);
    }
  }, [getValidAccessToken]);

  const next = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        await spotifyNext(token);
      }
    } catch (err) {
      console.warn('[useSpotify] Next error:', err);
    }
  }, [getValidAccessToken]);

  const prev = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const { previousTrack } = require('@/services/spotify');
        await previousTrack(token);
      }
    } catch (err) {
      console.warn('[useSpotify] Prev error:', err);
    }
  }, [getValidAccessToken]);

  const addToQueue = useCallback(async (uri: string) => {
    // URI-only callers must use the same queue editor as track menus, never
    // Spotify's separate manual queue (which survives playlist replacements).
    const [normalized] = normalizePlaybackUris(uri);
    const token = await getValidAccessToken();
    if (!token) throw new Error('Spotify session expired. Please reconnect Spotify.');
    const track = await getTrack(token, normalized.split(':')[2]);
    if (!track) throw new Error('Unable to load this Spotify song. Please try again.');
    const added = await addMusicTrackToQueue({
      id: 'spotify_' + track.id,
      title: track.name,
      artist: track.artists?.map(a => a.name).join(', ') ?? 'Unknown Artist',
      url: normalized,
      cover: spotifyGetBestImage(track.album?.images || [], 300) ?? '',
      duration: spotifyFormatDuration(track.duration_ms),
      durationSec: Math.floor(track.duration_ms / 1000),
      category: 'spotify',
    });
    if (!added) throw new Error('Unable to update the Spotify queue.');
  }, [getValidAccessToken, addMusicTrackToQueue]);

  const getQueueList = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const { getQueue } = require('@/services/spotify');
        return await getQueue(token);
      }
      return null;
    } catch (err) {
      console.warn('[useSpotify] Get queue error:', err);
      return null;
    }
  }, [getValidAccessToken]);

  const openInSpotify = useCallback((uri: string) => {
    // Deep link into Spotify app
    Linking.openURL(uri).catch(() => {
      // Fallback to web
      const webUrl = uri
        .replace('spotify:track:', 'https://open.spotify.com/track/')
        .replace('spotify:playlist:', 'https://open.spotify.com/playlist/')
        .replace('spotify:album:', 'https://open.spotify.com/album/');
      Linking.openURL(webUrl).catch(() => { });
    });
  }, []);

  // Data Actions

  const loadPlaylists = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const data = await getUserPlaylists(token);
        if (data && data.length > 0) {
          setPlaylists(data);
        }
      }
    } catch (err) {
      console.warn('[useSpotify] Failed to load playlists:', err);
    }
  }, [getValidAccessToken]);

  const addTrackToSpotifyPlaylist = useCallback(
    async (playlistId: string, trackUri: string): Promise<boolean> => {
      try {
        const token = await getValidAccessToken();
        if (!token) return false;
        const res = await spotifyAddTracksToPlaylist(token, playlistId, [trackUri]);
        if (res.success || res.snapshot_id) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Refresh playlists track counts in background
          loadPlaylists();
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[useSpotify] Failed to add track to playlist:', err);
        return false;
      }
    },
    [getValidAccessToken, loadPlaylists]
  );

  const createSpotifyPlaylist = useCallback(
    async (name: string, description?: string): Promise<SpotifyPlaylist | null> => {
      try {
        const token = await getValidAccessToken();
        if (!token) return null;
        let userId = spotifyUser?.id;
        if (!userId) {
          const user = await getCurrentUser(token);
          userId = user?.id;
        }
        if (!userId) return null;
        const newPl = await spotifyCreatePlaylist(token, userId, name, description);
        if (newPl) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Prepend to playlists state
          setPlaylists((prev) => [newPl, ...prev]);
          return newPl;
        }
        return null;
      } catch (err) {
        console.warn('[useSpotify] Failed to create playlist:', err);
        return null;
      }
    },
    [getValidAccessToken, spotifyUser?.id]
  );

  const loadTopTracks = useCallback(
    async (timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term') => {
      try {
        const token = await getValidAccessToken();
        if (token) {
          const data = await getTopTracks(token, timeRange);
          if (data && data.length > 0) {
            setTopTracks(data);
          }
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
        if (data && data.length > 0) {
          setRecentlyPlayed(data);
        }
      }
    } catch (err) {
      console.warn('[useSpotify] Failed to load recently played:', err);
    }
  }, [getValidAccessToken]);

  const refreshSession = useCallback(async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        await Promise.all([
          refreshNowPlaying(),
          loadPlaylists(),
          loadRecentlyPlayed(),
        ]);
        const user = await getCurrentUser(token);
        if (user) setSpotifyUser(user);
      }
    } catch (err) {
      console.warn('[useSpotify] Manual refreshSession failed:', err);
    }
  }, [getValidAccessToken, refreshNowPlaying, loadPlaylists, loadRecentlyPlayed]);

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

      const cacheKey = q.toLowerCase();
      if (_surveyArtistSearchCache.has(cacheKey)) {
        return _surveyArtistSearchCache.get(cacheKey)!;
      }

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
        const deezerData = await fetchWithDeadline(
          `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=30`, {},
          async response => response.ok ? response.json() : null, 4000,
        );
        if (deezerData) {
          if (deezerData?.data && deezerData.data.length > 0) {
            const deezerArtists: SpotifyArtist[] = deezerData.data.map((item: any) => ({
              id: `deezer_${item.id}`,
              name: item.name,
              images: [
                { url: item.picture_big || item.picture_medium || item.picture_small || '' },
              ],
            }));

            if (spotifyResults.length === 0) {
              _surveyArtistSearchCache.set(cacheKey, deezerArtists);
              return deezerArtists;
            }

            // Enrich Spotify results with Deezer photos if Spotify photo is missing
            const deezerMap = new Map(
              deezerArtists.map((d) => [d.name.toLowerCase().replace(/[^a-z0-9]/g, ''), d])
            );

            const enriched = spotifyResults.map((sArtist) => {
              const hasPhoto = sArtist.images && sArtist.images.length > 0 && !!sArtist.images[0]?.url;
              if (hasPhoto) return sArtist;

              const cleanKey = sArtist.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const dMatch = deezerMap.get(cleanKey);
              if (dMatch && dMatch.images?.length) {
                return { ...sArtist, images: dMatch.images };
              }
              return sArtist;
            });
            _surveyArtistSearchCache.set(cacheKey, enriched);
            return enriched;
          }
        }
      } catch (e) {
        console.warn('[useSpotify] Deezer photo enrichment failed:', e);
      }

      if (spotifyResults.length > 0) {
        _surveyArtistSearchCache.set(cacheKey, spotifyResults);
        return spotifyResults;
      }

      // iTunes 3rd fallback
      try {
        const data = await fetchWithDeadline(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=30`, {},
          async response => response.ok ? response.json() : null, 4000,
        );
        if (data) {
          if (data?.results && data.results.length > 0) {
            const itunesArtists = data.results.map((item: any) => {
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
            _surveyArtistSearchCache.set(cacheKey, itunesArtists);
            return itunesArtists;
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
      limit: number = 20,
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

        // Get cached Spotify user data for smarter recommendations
        let spotifyUserData = userId
          ? getLatestSpotifyUserData(userId)
          : null;
        if (!spotifyUserData && userId && token) {
          spotifyUserData = await refreshSpotifyUserData(userId, token).catch(() => null);
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
          spotifyUserData ?? undefined,
        );
      } catch (err) {
        console.warn('[useSpotify] getVIPRecommendations error:', err);
        return [];
      }
    },
    [getValidAccessToken, playlists]
  );

  const getContinuationBatch = useCallback(
    async (
      mood: MoodType,
      moodScore: number,
      completedTrackIds: string[],
      skippedTrackIds: string[],
      allPreviousTrackIds: string[],
      limit: number = 20,
      previousArtistNames: string[] = [],
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

        let spotifyUserData = userId
          ? getLatestSpotifyUserData(userId)
          : null;
        if (!spotifyUserData && userId && token) {
          spotifyUserData = await refreshSpotifyUserData(userId, token).catch(() => null);
        }

        return await generateContinuationBatch(
          mood,
          moodScore,
          completedTrackIds,
          skippedTrackIds,
          allPreviousTrackIds,
          userId ?? 'guest',
          token,
          playlists || [],
          prefs,
          spotifyUserData ?? undefined,
          limit,
          previousArtistNames,
        );
      } catch (err) {
        console.warn('[useSpotify] getContinuationBatch error:', err);
        return [];
      }
    },
    [getValidAccessToken, playlists]
  );

  const refreshDailySpotifyData = useCallback(async () => {
    try {
      const user = useAppStore.getState().user;
      if (!user?.id) return;
      const token = await getValidAccessToken();
      if (token) {
        await refreshSpotifyUserData(user.id, token);
      }
    } catch (e) {
      console.warn('[useSpotify] refreshDailySpotifyData error:', e);
    }
  }, [getValidAccessToken]);

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
    addTrackToSpotifyPlaylist,
    createSpotifyPlaylist,
    loadTopTracks,
    loadRecentlyPlayed,
    refreshSession,
    search,
    searchByMood,

    searchArtistsForSurvey,
    loadTopArtistsForSurvey,
    getVIPRecommendations,
    getContinuationBatch,
    reportTrackSkip,
    reportTrackCompletion,
    refreshDailySpotifyData,
  };
}
