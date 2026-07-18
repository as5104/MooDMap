/**
 * MoodMap — Global Music Provider
 * Persists audio playback state, queue, favorites, and caching state globally across screens.
 */

import { AudioPlayer, AudioStatus, createAudioPlayer, requestNotificationPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { tagTrackToMood } from '../services/recommendationEngine';
import { useAlertStore } from '../stores/alertStore';
import { clearAudioCache, getAudioCacheSize, getCachedAudioUri } from '../utils/audioCache';

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  duration: string;
  durationSec: number;
  category: 'midnight' | 'chill' | 'energy' | 'heartbeat' | 'ambient' | 'local' | 'spotify';
  creationTime?: number;
  modificationTime?: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export type RepeatMode = 'none' | 'one' | 'all';

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  shouldPlay: boolean;
  queue: Track[];
  currentIndex: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  favorites: string[];
  isHeadphonesConnected: boolean;
  cacheSize: number;
  isDownloading: boolean;
  downloadProgress: number;
  localTracks: Track[];
  playlists: Playlist[];
  isQueueRecommended: boolean;

  // Controls
  play: (track: Track, contextUri?: string, offsetUri?: string, isShuffle?: boolean, _isInternalSkip?: boolean) => Promise<void>;
  pause: () => Promise<void> | void;
  resume: () => Promise<void> | void;
  next: () => Promise<void> | void;
  prev: () => Promise<void> | void;
  seekTo: (seconds: number) => void;
  toggleFavorite: (trackId: string) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeatMode: () => void;
  cyclePlaybackMode: () => void;
  scanLocalMusic: () => Promise<'success' | 'permission_denied' | 'not_supported'>;
  clearCache: () => Promise<void>;
  refreshCacheSize: () => Promise<void>;
  setQueue: (tracks: Track[], index?: number) => void;
  addToQueue: (track: Track) => void;
  syncReorderedQueue: () => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  updateSpotifyPlayback: (
    progressSec: number,
    durationSec: number,
    playing: boolean,
    trackInfo?: {
      id: string;
      title: string;
      artist: string;
      url: string;
      cover: string;
      duration: string;
      durationSec: number;
    }
  ) => void;
  playbackRefreshRequest: number;
  triggerPlaybackRefresh: () => void;
}

export interface MusicTimeContextType {
  currentTime: number;
  duration: number;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);
const MusicTimeContext = createContext<MusicTimeContextType | undefined>(undefined);

export const parseSpotifyQueueHelper = (queueData: any): Track[] => {
  if (!queueData) return [];

  const getBestImage = (images: any[], targetSize: number) => {
    if (!images || images.length === 0) return '';
    return images.reduce((p, c) => Math.abs((c.width || 0) - targetSize) < Math.abs((p.width || 0) - targetSize) ? c : p).url || '';
  };

  const formatDur = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const convertSpotifyTrackToTrack = (st: any): Track => {
    if (!st) return {} as Track;
    const t = st.track || st;
    return {
      id: 'spotify_' + t.id,
      title: t.name || 'Unknown Track',
      artist: t.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist',
      url: t.uri || '',
      cover: getBestImage(t.album?.images || [], 300),
      duration: formatDur(t.duration_ms || 0),
      durationSec: Math.floor((t.duration_ms || 0) / 1000),
      category: 'spotify',
    };
  };

  const results: Track[] = [];
  if (queueData.currently_playing) {
    results.push(convertSpotifyTrackToTrack(queueData.currently_playing));
  }
  if (Array.isArray(queueData.queue)) {
    results.push(...queueData.queue.map(convertSpotifyTrackToTrack));
  }
  return results;
};

// Core tracks library
export const TRACKS_LIBRARY: Track[] = [
  // Category: Midnight Vibes
  {
    id: 'midnight_1',
    title: 'Moonlight Echo',
    artist: 'Astra',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    cover: 'midnight',
    duration: '4:27',
    durationSec: 267,
    category: 'midnight',
  },
  {
    id: 'midnight_2',
    title: 'Lost in Waves',
    artist: 'Velo',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    cover: 'midnight',
    duration: '4:39',
    durationSec: 279,
    category: 'midnight',
  },
  {
    id: 'midnight_3',
    title: 'Silent Dreams',
    artist: 'Novi',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cover: 'midnight',
    duration: '3:21',
    durationSec: 201,
    category: 'midnight',
  },

  // Category: Chill & Relax
  {
    id: 'chill_1',
    title: 'Fire in Motion',
    artist: 'Kairo',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    cover: 'chill',
    duration: '3:58',
    durationSec: 238,
    category: 'chill',
  },
  {
    id: 'chill_2',
    title: 'Neon Pulse',
    artist: 'Zyra',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    cover: 'chill',
    duration: '4:42',
    durationSec: 282,
    category: 'chill',
  },

  // Category: Energy Boost
  {
    id: 'energy_1',
    title: 'Falling Skies',
    artist: 'Maro',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    cover: 'energy',
    duration: '4:12',
    durationSec: 252,
    category: 'energy',
  },
  {
    id: 'energy_2',
    title: 'Golden Hour',
    artist: 'Luxe',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    cover: 'energy',
    duration: '5:57',
    durationSec: 357,
    category: 'energy',
  },

  // Category: Heartbeat Hits
  {
    id: 'heartbeat_1',
    title: 'Broken Stars',
    artist: 'Sora',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    cover: 'heartbeat',
    duration: '3:27',
    durationSec: 207,
    category: 'heartbeat',
  },
  {
    id: 'heartbeat_2',
    title: 'Echoed Heartbeat',
    artist: 'Vian',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    cover: 'heartbeat',
    duration: '4:21',
    durationSec: 261,
    category: 'heartbeat',
  },

  // Category: Ambient Loops (Noctune royalty-free loops)
  {
    id: 'ambient_1',
    title: 'Rain Ambiance',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/rain.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
  {
    id: 'ambient_2',
    title: 'River Stream',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/river.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
  {
    id: 'ambient_3',
    title: 'Forest Birds',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/forest.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
  {
    id: 'ambient_4',
    title: 'Campfire Crackle',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/campfire.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
  {
    id: 'ambient_5',
    title: 'Wind Breeze',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/wind.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
  {
    id: 'ambient_6',
    title: 'Night Ambiance',
    artist: 'Nature Loop',
    url: 'https://raw.githubusercontent.com/karthiknvd/noctune/main/sounds/night.mp3',
    cover: 'ambient',
    duration: 'Loop',
    durationSec: 0,
    category: 'ambient',
  },
];

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueueState] = useState<Track[]>(TRACKS_LIBRARY.filter(t => t.category === 'midnight'));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isHeadphonesConnected] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [playbackRefreshRequest, setPlaybackRefreshRequest] = useState(0);
  const triggerPlaybackRefresh = useCallback(() => {
    setPlaybackRefreshRequest(prev => prev + 1);
  }, []);

  // Persistent Player instance
  const playerRef = useRef<AudioPlayer | null>(null);

  // Refs to avoid stale closures in the status listener
  const currentTrackRef = useRef(currentTrack);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const shuffleRef = useRef(shuffle);
  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  const playRef = useRef<((track: Track, contextUri?: string, offsetUri?: string, isShuffle?: boolean, _isInternalSkip?: boolean) => Promise<void>) | null>(null);
  const nextRef = useRef<(() => void) | null>(null);
  const prevRef = useRef<(() => void) | null>(null);
  const addedCountRef = useRef(0);
  const lastInsertIndexRef = useRef<number | null>(null);
  const isSkippingRef = useRef(false);
  const lastActionTimeRef = useRef<number>(0);

  // Ref to track if the next track has been silently queued on Spotify
  const nextTrackQueuedRef = useRef<string | null>(null);

  // Track if the queue is custom/manually reordered
  const isQueueCustomRef = useRef(false);

  const [isQueueRecommended, setIsQueueRecommended] = useState(false);
  const isQueueRecommendedRef = useRef(false);
  useEffect(() => { isQueueRecommendedRef.current = isQueueRecommended; }, [isQueueRecommended]);

  // Request locks for Spotify queue pagination
  const isFetchingQueueRef = useRef(false);
  const lastFetchedTrackIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Reset added queue stack count and pre-queued ref when track changes
  useEffect(() => {
    addedCountRef.current = 0;
    lastInsertIndexRef.current = currentIndexRef.current;
    nextTrackQueuedRef.current = null;
  }, [currentTrack?.id]);



  const PLAYLISTS_FILE = useRef(new File(Paths.document, 'playlists.json')).current;

  // Instantiate player on mount to prevent native constructor crash at launch
  useEffect(() => {
    playerRef.current = createAudioPlayer(null);
    setPlayerReady(true);
    return () => {
      playerRef.current?.clearLockScreenControls();
      playerRef.current?.release();
      playerRef.current = null;
    };
  }, []);

  // Configure audio mode for background playback & request notification permission
  useEffect(() => {
    const configureAudio = async () => {
      try {
        // Request notification permission (Android 13+ POST_NOTIFICATIONS)
        if (Platform.OS === 'android') {
          await requestNotificationPermissionsAsync();
        }
        // Enable background playback with exclusive audio focus (required for lock screen controls)
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        console.log('[MusicContext] Audio mode configured for background playback');
      } catch (e) {
        console.error('[MusicContext] Failed to configure audio mode:', e);
      }
    };
    configureAudio();
  }, []);

  // Load playlists on mount
  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        if (PLAYLISTS_FILE.exists) {
          const content = await PLAYLISTS_FILE.text();
          setPlaylists(JSON.parse(content));
        }
      } catch (e) {
        console.error('[MusicContext] Failed to load playlists:', e);
      }
    };
    loadPlaylists();
  }, []);

  const savePlaylists = async (updatedLists: Playlist[]) => {
    try {
      PLAYLISTS_FILE.write(JSON.stringify(updatedLists));
    } catch (e) {
      console.error('[MusicContext] Failed to save playlists:', e);
    }
  };

  const createPlaylist = useCallback(async (name: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPlaylist: Playlist = {
      id: 'playlist_' + Date.now(),
      name,
      tracks: []
    };
    setPlaylists(prev => {
      const updated = [...prev, newPlaylist];
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== playlistId);
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, track: Track) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id === playlistId) {
          if (p.tracks.some(t => t.id === track.id)) {
            return p;
          }
          return {
            ...p,
            tracks: [...p.tracks, track]
          };
        }
        return p;
      });
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id === playlistId) {
          return {
            ...p,
            tracks: p.tracks.filter(t => t.id !== trackId)
          };
        }
        return p;
      });
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const updateSpotifyPlayback = useCallback((
    progressSec: number,
    durationSec: number,
    playing: boolean,
    trackInfo?: {
      id: string;
      title: string;
      artist: string;
      url: string;
      cover: string;
      duration: string;
      durationSec: number;
    }
  ) => {
    const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
    const isWithinActionWindow = timeSinceLastAction < 5000; // 5-second action window

    if (trackInfo) {
      const isTrackMatch = currentTrackRef.current?.id === trackInfo.id;

      if (isWithinActionWindow) {
        // We are within the action window (just changed tracks or seeked)
        if (isTrackMatch) {
          // Spotify API has updated to match our expected track. Sync duration.
          setDuration(trackInfo.durationSec || durationSec);
        } else {
          // Mismatch: Spotify is still returning the old track's metadata.
          // Ignore it to prevent the UI from flickering/reverting.
          console.log('[MusicContext] Ignoring stale Spotify track update:', trackInfo.title);
          return;
        }
      } else {
        // Outside the action window, we accept Spotify's state as ground truth.
        // This handles external changes.
        if (!isTrackMatch) {
          const q = queueRef.current;
          const ci = currentIndexRef.current;
          const sh = shuffleRef.current;

          // Check if the track played exists in our queue (by ID first, then fuzzy title+artist)
          let queueIdx = q.findIndex(t => t.id === trackInfo.id);

          // Fuzzy fallback: Spotify may relink tracks to different market IDs
          if (queueIdx === -1) {
            const infoTitle = trackInfo.title.toLowerCase().trim();
            const infoArtist = trackInfo.artist.toLowerCase().split(',')[0].trim();
            queueIdx = q.findIndex(t => {
              const tTitle = t.title.toLowerCase().trim();
              const tArtist = t.artist.toLowerCase().split(',')[0].trim();
              return tTitle === infoTitle && tArtist === infoArtist;
            });
            if (queueIdx !== -1) {
              console.log('[MusicContext] Fuzzy-matched relinked track:', trackInfo.title, 'at index:', queueIdx);
              // Update the stored ID to prevent future mismatches
              q[queueIdx] = { ...q[queueIdx], id: trackInfo.id };
            }
          }

          if (queueIdx !== -1) {
            // The track is in our queue!

            // If the queue is custom/manually reordered, enforce the custom sequence
            if (isQueueCustomRef.current && q.length > 1) {
              let expectedNextIdx = ci + 1;
              if (sh) {
                expectedNextIdx = Math.floor(Math.random() * q.length);
              } else if (expectedNextIdx >= q.length) {
                expectedNextIdx = 0;
              }

              if (queueIdx !== expectedNextIdx) {
                console.log('[MusicContext] Custom queue mismatch intercepted. Forcing correct next track:', q[expectedNextIdx]?.title);
                currentIndexRef.current = expectedNextIdx;
                setCurrentIndex(expectedNextIdx);
                if (playRef.current && q[expectedNextIdx]) {
                  playRef.current(q[expectedNextIdx], undefined, undefined, undefined, true);
                }
                return; // Prevent syncing to the wrong track
              }
            }

            // Otherwise, let Spotify play whatever track in the queue it wants (native shuffle or sequence)
            // and just sync our UI index to match.
            console.log('[MusicContext] Syncing to queue track played by Spotify:', trackInfo.title, 'at index:', queueIdx);
            currentIndexRef.current = queueIdx;
            setCurrentIndex(queueIdx);
            setCurrentTrack(q[queueIdx]);

            // Proactively fetch more tracks if near end — but NOT for recommended queues (they're self-contained)
            if (!isQueueRecommendedRef.current && queueIdx >= q.length - 3 && lastFetchedTrackIdRef.current !== trackInfo.id) {
              lastFetchedTrackIdRef.current = trackInfo.id;
              proactivelyFetchSpotifyQueue();
            }
          } else {
            // The track is NOT in our queue (external song played, or Spotify auto-play)

            // If the queue is a Spotify recommended queue, append the new track and keep playing
            if (isQueueRecommendedRef.current) {
              console.log('[MusicContext] Recommended queue: appending auto-advanced track:', trackInfo.title);

              const recommendedTrack: Track = {
                id: trackInfo.id,
                title: trackInfo.title,
                artist: trackInfo.artist,
                url: trackInfo.url,
                cover: trackInfo.cover,
                duration: trackInfo.duration,
                durationSec: trackInfo.durationSec,
                category: 'spotify',
              };

              const newQueue = [...q, recommendedTrack];
              queueRef.current = newQueue;
              setQueueState(newQueue);

              const nextIdx = q.length;
              currentIndexRef.current = nextIdx;
              setCurrentIndex(nextIdx);
              setCurrentTrack(recommendedTrack);
              // Do NOT call proactivelyFetchSpotifyQueue — keep our curated queue stable
              return;
            }

            // Check if it was an auto-play takeover by Spotify near end of our queue
            const wasNearEnd = currentTrackRef.current !== null && currentTimeRef.current >= (currentTrackRef.current?.durationSec || 0) - 5;
            const isAtQueueEnd = ci >= q.length - 1;

            if (wasNearEnd && isAtQueueEnd) {
              if (repeatModeRef.current === 'all') {
                console.log('[MusicContext] Queue finished. Wrap around repeat enabled. Forcing first track.');
                currentIndexRef.current = 0;
                setCurrentIndex(0);
                if (playRef.current && q[0]) {
                  playRef.current(q[0], undefined, undefined, undefined, true);
                }
                return;
              } else {
                console.log('[MusicContext] Queue finished. Stopping auto-play recommendations.');
                setPlaying(false);
                if (playerRef.current) {
                  try { playerRef.current.pause(); } catch (e) { }
                }
                const { useTierStore } = require('../stores/tierStore');
                useTierStore.getState().getValidAccessToken().then((token: string | null) => {
                  if (token) {
                    const { pause: spotifyPauseAPI } = require('../services/spotify');
                    spotifyPauseAPI(token).catch((err: any) => console.warn(err));
                  }
                });
                return;
              }
            }

            // Otherwise, it's a manual external track change inside the Spotify app. Sync to it.
            console.log('[MusicContext] Syncing external Spotify track change:', trackInfo.title);
            isQueueCustomRef.current = false;

            const newTrack: Track = {
              id: trackInfo.id,
              title: trackInfo.title,
              artist: trackInfo.artist,
              url: trackInfo.url,
              cover: trackInfo.cover,
              duration: trackInfo.duration,
              durationSec: trackInfo.durationSec,
              category: 'spotify',
            };

            if (q.length > 1 && q.some(t => t.category === 'spotify')) {
              const filteredQ = q.filter(t => t.id !== newTrack.id);
              const newQueue = [newTrack, ...filteredQ];
              queueRef.current = newQueue;
              setQueueState(newQueue);
              currentIndexRef.current = 0;
              setCurrentIndex(0);
            } else {
              queueRef.current = [newTrack];
              setQueueState([newTrack]);
              currentIndexRef.current = 0;
              setCurrentIndex(0);
            }
            setCurrentTrack(newTrack);
          }
        }
        setDuration(trackInfo.durationSec || durationSec);
      }
    }

    // Now, sync playing state and currentTime if appropriate.
    // If we are within the action window, we only sync if the track matches.
    if (!isWithinActionWindow || (trackInfo && currentTrackRef.current?.id === trackInfo.id)) {
      setPlaying(prev => (prev === playing ? prev : playing));
      setCurrentTime(prev => {
        // Only update if there is a significant difference (> 2 seconds) to prevent progress bar jitter
        const diff = Math.abs(prev - progressSec);
        if (diff > 2.0) {
          console.log(`[MusicContext] Syncing currentTime with Spotify: local=${prev}, remote=${progressSec}`);
          return progressSec;
        }
        return prev;
      });
    }
  }, []);

  const addToQueue = useCallback(async (track: Track) => {
    if (currentTrackRef.current && currentTrackRef.current.category !== track.category) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Determine the base index to insert after
    let baseIndex = currentIndexRef.current;
    if (lastInsertIndexRef.current !== null) {
      baseIndex = lastInsertIndexRef.current;
    }

    const insertIndex = Math.max(0, Math.min(queueRef.current.length, baseIndex + 1));

    setQueueState(prev => {
      if (prev.length === 0) {
        return [track];
      }
      const updated = [...prev];
      updated.splice(insertIndex, 0, track);
      return updated;
    });

    lastInsertIndexRef.current = insertIndex;
    addedCountRef.current += 1;

    // Natively queue track on Spotify
    if (track.category === 'spotify') {
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { addToQueue: spotifyAddToQueue } = require('../services/spotify');
          await spotifyAddToQueue(token, track.url);
          console.log('[MusicContext] Natively queued track on Spotify:', track.title);

          // Re-fetch queue to make sure our UI queue is instantly aligned
          setTimeout(async () => {
            try {
              const { getQueue } = require('../services/spotify');
              const queueData = await getQueue(token);
              if (queueData) {
                const combinedQueue = parseSpotifyQueueHelper(queueData);
                queueRef.current = combinedQueue;
                setQueueState(combinedQueue);
              }
            } catch (err) {
              console.warn('[MusicContext] Failed to sync queue after addToQueue:', err);
            }
          }, 1500);
        }
      } catch (err) {
        console.warn('[MusicContext] Failed to queue track natively on Spotify:', err);
      }
    }
  }, []);

  // Compute cache size
  const refreshCacheSize = useCallback(async () => {
    const size = await getAudioCacheSize();
    setCacheSize(size);
  }, []);

  // Load favorites
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await SecureStore.getItemAsync('music_favorites');
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (e) {
        console.error('[MusicContext] Failed to load favorites:', e);
      }
      await refreshCacheSize();
    };
    loadFavorites();
  }, [refreshCacheSize]);





  // Clear cache action
  const clearCache = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearAudioCache();
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Set the playback queue
  const setQueue = useCallback((tracks: Track[], index: number = 0) => {
    addedCountRef.current = 0;
    lastInsertIndexRef.current = index;
    currentIndexRef.current = index;
    queueRef.current = tracks;
    setQueueState(tracks);
    setCurrentIndex(index);
  }, []);

  // Mark reordered queue as custom and turn off shuffle state gaplessly
  const syncReorderedQueue = useCallback(async () => {
    isQueueCustomRef.current = true;
    setIsQueueRecommended(false); // No longer recommended if manually modified
    console.log('[MusicContext] Queue manually adjusted. Disabling native queue overwriting.');

    if (currentTrackRef.current?.category !== 'spotify') return;
    try {
      const { useTierStore } = require('../stores/tierStore');
      const token = await useTierStore.getState().getValidAccessToken();
      if (token) {
        const { setShuffle: spotifySetShuffleAPI } = require('../services/spotify');
        // Disable native Spotify shuffle gaplessly so it respects sequence
        try {
          await spotifySetShuffleAPI(token, false);
        } catch (e) { }
        setShuffle(false);
      }
    } catch (err) {
      console.warn('[MusicContext] Failed to disable native Spotify shuffle gaplessly:', err);
    }
  }, []);

  const proactivelyFetchSpotifyQueue = useCallback(async () => {
    if (currentTrackRef.current?.category !== 'spotify' || isQueueCustomRef.current || isFetchingQueueRef.current) return;

    isFetchingQueueRef.current = true;
    console.log('[MusicContext] Proactively fetching next batch of Spotify queue...');
    try {
      const { useTierStore } = require('../stores/tierStore');
      const token = await useTierStore.getState().getValidAccessToken();
      if (token) {
        const { getQueue } = require('../services/spotify');
        const queueData = await getQueue(token);
        if (queueData && queueData.queue && queueData.queue.length > 0) {
          const combinedQueue = parseSpotifyQueueHelper(queueData);

          // Only update if Spotify's queue contains new tracks or order changed
          if (combinedQueue.length > queueRef.current.length ||
            combinedQueue.some((t, i) => queueRef.current[i] && queueRef.current[i].id !== t.id)) {
            console.log('[MusicContext] Proactively imported new queue batch from Spotify. Tracks count:', combinedQueue.length);
            queueRef.current = combinedQueue;
            setQueueState(combinedQueue);

            // Align current index based on what is currently playing
            if (queueData.currently_playing) {
              const currentId = 'spotify_' + queueData.currently_playing.id;
              const idx = combinedQueue.findIndex(t => t.id === currentId);
              if (idx !== -1) {
                currentIndexRef.current = idx;
                setCurrentIndex(idx);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MusicContext] Proactive queue fetch failed:', e);
    } finally {
      isFetchingQueueRef.current = false;
    }
  }, []);

  const play = useCallback(async (track: Track, contextUri?: string, offsetUri?: string, isShuffle?: boolean, _isInternalSkip?: boolean) => {
    isQueueCustomRef.current = false;

    // Only recalculate the recommended flag on fresh user-initiated plays (not internal skips/syncs).
    // Internal skips (next, prev, polling sync, auto-advance) preserve the existing flag.
    if (!_isInternalSkip) {
      const isRec = track.category === 'spotify' && !contextUri;
      setIsQueueRecommended(isRec);
      isQueueRecommendedRef.current = isRec;
    }

    addedCountRef.current = 0;
    lastInsertIndexRef.current = currentIndexRef.current;
    try {
      if (!playerRef.current) {
        console.log('[MusicContext] Play rejected: Player not ready');
        return;
      }

      const isSameTrack = currentTrackRef.current?.id === track.id;
      setPlaying(false);
      setCurrentTrack(track);
      if (!isSameTrack) {
        setCurrentTime(0);
        setDuration(track.durationSec || 0);
      }
      setShouldPlay(true);
      lastActionTimeRef.current = Date.now();

      // Handle Spotify remote playback
      if (track.category === 'spotify') {
        if (playerRef.current) {
          try {
            // Pause any local track and disable lock screen widget to let Spotify's native widget manage controls
            playerRef.current.pause();
            playerRef.current.setActiveForLockScreen(false);
          } catch (localPlayErr) {
            console.warn('[MusicContext] Failed to pause local player:', localPlayErr);
          }
        }
        setPlaying(true);
        try {
          const { useTierStore } = require('../stores/tierStore');
          const token = await useTierStore.getState().getValidAccessToken();
          if (token) {
            const { play: spotifyPlayAPI, setShuffle: spotifySetShuffleAPI } = require('../services/spotify');

            // Play native Spotify context if contextUri is provided
            if (contextUri) {
              if (isShuffle) {
                // To avoid Spotify's bug where starting context playback with shuffle=true ignores the offset track:
                // 1. Turn shuffle OFF first
                try {
                  await spotifySetShuffleAPI(token, false);
                } catch (shuffleErr) {
                  console.warn('[MusicContext] Failed to turn off native Spotify shuffle initially:', shuffleErr);
                }

                // 2. Play context starting with the first track as offset
                await spotifyPlayAPI(token, undefined, undefined, contextUri, offsetUri ? { uri: offsetUri } : undefined);

                // 3. After 1.5s delay, turn shuffle ON and fetch the shuffled queue
                setTimeout(async () => {
                  try {
                    await spotifySetShuffleAPI(token, true);
                    console.log('[MusicContext] Enabled native shuffle after starting playback');

                    const { getQueue } = require('../services/spotify');
                    const queueData = await getQueue(token);
                    if (queueData) {
                      const combinedQueue = parseSpotifyQueueHelper(queueData);
                      queueRef.current = combinedQueue;
                      setQueueState(combinedQueue);
                      currentIndexRef.current = 0;
                      setCurrentIndex(0);
                    }
                  } catch (err) {
                    console.warn('[MusicContext] Failed to turn shuffle on or fetch queue:', err);
                  }
                }, 1500);
              } else {
                // Sequential playback (isShuffle = false)
                try {
                  await spotifySetShuffleAPI(token, false);
                } catch (shuffleErr) { }

                await spotifyPlayAPI(token, undefined, undefined, contextUri, offsetUri ? { uri: offsetUri } : undefined);

                setTimeout(async () => {
                  try {
                    const { getQueue } = require('../services/spotify');
                    const queueData = await getQueue(token);
                    if (queueData) {
                      const combinedQueue = parseSpotifyQueueHelper(queueData);
                      queueRef.current = combinedQueue;
                      setQueueState(combinedQueue);
                      currentIndexRef.current = 0;
                      setCurrentIndex(0);
                    }
                  } catch (err) { }
                }, 1500);
              }
            } else {
              // Playing from search or single track — build recommended queue first, then play all URIs together
              let finalQueue: Track[] = [track];
              try {
                const { searchTracks: spotifySearchTracks, getTrack: spotifyGetTrack } = require('../services/spotify');
                const primaryArtist = track.artist.split(',')[0].trim();
                const secondaryArtist = track.artist.split(',')[1]?.trim() || '';
                const rawTrackId = track.id.replace('spotify_', '');

                // 1. Fetch Track Metadata for Timeline/Era Detection
                let releaseYear: number | null = null;
                try {
                  const fullTrack = await spotifyGetTrack(token, rawTrackId);
                  if (fullTrack?.album?.release_date) {
                    const yearMatch = fullTrack.album.release_date.match(/^(\d{4})/);
                    if (yearMatch) {
                      releaseYear = parseInt(yearMatch[1], 10);
                    }
                  }
                } catch (trackErr) {
                  console.warn('[MusicContext] Failed to fetch track release date:', trackErr);
                }

                let yearFilter = '';
                if (releaseYear) {
                  // Match timeline of +/- 5 years to keep similar era vibe
                  const startYear = Math.max(1950, releaseYear - 5);
                  const endYear = Math.min(new Date().getFullYear(), releaseYear + 5);
                  yearFilter = ` year:${startYear}-${endYear}`;
                }

                // 2. Language Detection
                const combined = `${track.title} ${track.artist}`;
                let langTag = '';

                // Unicode script detection
                if (/[\u0900-\u097F]/.test(combined)) { langTag = 'hindi'; }
                else if (/[\u0980-\u09FF]/.test(combined)) { langTag = 'bengali'; }
                else if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(combined)) { langTag = 'japanese'; }
                else if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(combined)) { langTag = 'korean'; }
                else if (/[\u0B80-\u0BFF]/.test(combined)) { langTag = 'tamil'; }
                else if (/[\u0C00-\u0C7F]/.test(combined)) { langTag = 'telugu'; }
                else if (/[\u0600-\u06FF]/.test(combined)) { langTag = 'arabic'; }

                // Romanized artist name detection
                if (!langTag) {
                  const lowerArtist = primaryArtist.toLowerCase();
                  const hindiArtists = ['arijit', 'shreya', 'atif', 'neha kakkar', 'badshah', 'honey singh', 'jubin', 'darshan raval', 'kumar sanu', 'udit narayan', 'sonu nigam', 'lata', 'kishore', 'mohit chauhan', 'pritam', 'vishal', 'shankar', 'armaan malik', 'tulsi kumar', 'b praak', 'sachet', 'tanishk', 'guru randhawa', 'diljit', 'ap dhillon', 'harrdy', 'sidhu', 'karan aujla', 'raftaar', 'divine', 'mc stan'];
                  const spanishArtists = ['bad bunny', 'daddy yankee', 'ozuna', 'j balvin', 'maluma', 'shakira', 'rosalia', 'anuel', 'karol g', 'rauw alejandro', 'nicky jam', 'becky g', 'farruko', 'sech', 'pitbull', 'enrique', 'luis fonsi', 'natti natasha', 'aventura', 'romeo santos'];
                  const bengaliArtists = ['anupam roy', 'rupam islam', 'nachiketa', 'iman chakraborty', 'babul supriyo', 'jeet gannguli', 'praktan'];
                  const japaneseArtists = ['yoasobi', 'ado', 'lisa', 'kenshi yonezu', 'aimer', 'radwimps', 'eve', 'yorushika', 'vaundy', 'fujii kaze', 'king gnu', 'mrs. green apple', 'back number'];
                  const koreanArtists = ['bts', 'blackpink', 'stray kids', 'twice', 'iu', 'aespa', 'newjeans', 'seventeen', 'txt', 'le sserafim', 'nct', 'enhypen', 'itzy', 'red velvet', 'exo', 'bigbang', 'g-dragon'];

                  if (hindiArtists.some(a => lowerArtist.includes(a))) { langTag = 'hindi'; }
                  else if (bengaliArtists.some(a => lowerArtist.includes(a))) { langTag = 'bengali'; }
                  else if (spanishArtists.some(a => lowerArtist.includes(a))) { langTag = 'spanish'; }
                  else if (japaneseArtists.some(a => lowerArtist.includes(a))) { langTag = 'japanese'; }
                  else if (koreanArtists.some(a => lowerArtist.includes(a))) { langTag = 'korean'; }
                }

                if (!langTag) { langTag = 'english'; }

                console.log(`[MusicContext] Smart recommendations — language: ${langTag}, artist: ${primaryArtist}, year range: ${yearFilter || 'any'}`);

                // 3. Build targeted, artist-anchored, era-appropriate search queries
                const searchQueries: { q: string; limit: number; tag: string }[] = [
                  { q: `artist:"${primaryArtist}"${yearFilter}`, limit: 5, tag: 'same-artist' },
                  { q: `"${track.title}"`, limit: 4, tag: 'title-match' },
                ];

                const isOldEra = releaseYear && releaseYear < 2015;
                if (langTag === 'hindi') {
                  searchQueries.push(
                    { q: `Bollywood romantic ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Bollywood ${isOldEra ? 'hits' : 'latest hits'}${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `filmi gaane ${isOldEra ? '' : 'new'}${yearFilter}`.trim(), limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'bengali') {
                  searchQueries.push(
                    { q: `Bengali modern songs ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `adhunik bangla gaan${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `Bengali romantic hits${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'spanish') {
                  searchQueries.push(
                    { q: `reggaeton ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Latin pop hits${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `musica latina ${isOldEra ? '' : 'nueva'}${yearFilter}`.trim(), limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'japanese') {
                  searchQueries.push(
                    { q: `J-Pop ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Japanese pop hits${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `anime opening songs${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'korean') {
                  searchQueries.push(
                    { q: `K-Pop ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Korean pop hits${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `K-Pop ${isOldEra ? 'releases' : 'new releases'}${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'tamil') {
                  searchQueries.push(
                    { q: `Tamil movie songs ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Kollywood romantic hits${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `Tamil melody songs${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                } else if (langTag === 'telugu') {
                  searchQueries.push(
                    { q: `Telugu movie songs ${primaryArtist.split(' ')[0]}${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `Tollywood romantic hits${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `Telugu melody songs${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                } else {
                  searchQueries.push(
                    { q: `${primaryArtist} similar artists${yearFilter}`, limit: 5, tag: 'genre-1' },
                    { q: `top hits popular songs${yearFilter}`, limit: 4, tag: 'genre-2' },
                    { q: `trending music ${isOldEra ? 'releases' : 'new releases'}${yearFilter}`, limit: 3, tag: 'genre-3' },
                  );
                }

                searchQueries.push({ q: `${primaryArtist}${yearFilter}`, limit: 4, tag: 'artist-related' });
                if (secondaryArtist) {
                  searchQueries.push({ q: `artist:"${secondaryArtist}"${yearFilter}`, limit: 3, tag: 'feat-artist' });
                }

                // Execute all searches in parallel
                const searchResults = await Promise.all(
                  searchQueries.map(sq =>
                    spotifySearchTracks(token, sq.q, sq.limit)
                      .then((res: any[]) => ({ tag: sq.tag, tracks: res || [] }))
                      .catch(() => ({ tag: sq.tag, tracks: [] as any[] }))
                  )
                );

                // 4. Interleave & Filter Out Podcasts / Regional Misalignments
                const seenIds = new Set<string>([rawTrackId]);
                const buckets: any[][] = searchResults.map(r => r.tracks);
                const interleaved: any[] = [];
                let maxLen = Math.max(...buckets.map(b => b.length));

                for (let i = 0; i < maxLen && interleaved.length < 25; i++) {
                  for (const bucket of buckets) {
                    if (i < bucket.length) {
                      const st = bucket[i];
                      if (st && st.id && !seenIds.has(st.id)) {
                        if (st.type && st.type !== 'track') continue;
                        if (st.uri && (st.uri.includes(':episode:') || st.uri.includes(':show:'))) continue;
                        if (st.duration_ms && st.duration_ms > 900000) continue;
                        seenIds.add(st.id);
                        interleaved.push(st);
                      }
                    }
                  }
                }

                if (interleaved.length > 0) {
                  const convertedRecs: Track[] = interleaved.map((st: any) => {
                    const bestImg = st.album?.images?.reduce((p: any, c: any) =>
                      Math.abs((c.width || 0) - 300) < Math.abs((p.width || 0) - 300) ? c : p,
                      st.album?.images?.[0] || {}
                    );
                    const totalSecs = Math.floor((st.duration_ms || 0) / 1000);
                    const mins = Math.floor(totalSecs / 60);
                    const secs = totalSecs % 60;
                    return {
                      id: 'spotify_' + st.id,
                      title: st.name || 'Unknown Track',
                      artist: st.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist',
                      url: st.uri || '',
                      cover: bestImg?.url || '',
                      duration: `${mins}:${secs.toString().padStart(2, '0')}`,
                      durationSec: totalSecs,
                      category: 'spotify' as const,
                    };
                  });
                  finalQueue = [track, ...convertedRecs];
                }
              } catch (err) {
                console.warn('[MusicContext] Failed to build recommended queue:', err);
              }

              // Update local queue state
              queueRef.current = finalQueue;
              setQueueState(finalQueue);
              currentIndexRef.current = 0;
              setCurrentIndex(0);

              // Play all URIs in the queue together
              try {
                await spotifySetShuffleAPI(token, !!isShuffle);
              } catch (shuffleErr) { }

              const uris = finalQueue.map(t => t.url);
              await spotifyPlayAPI(token, uris);

              console.log('[MusicContext] Playback started with recommended queue of size:', finalQueue.length);
            }

            // Schedule a refresh to sync after the track starts playing
            setTimeout(() => {
              triggerPlaybackRefresh();
            }, 2000);
          }
        } catch (err: any) {
          console.warn('[MusicContext] Spotify playback error:', err.message);
          setPlaying(false);
          if (err.message?.includes('No active device found') || err.message?.includes('Player command failed') || err.message?.includes('No active device')) {
            useAlertStore.getState().showAlert(
              'Spotify Active Device Required',
              'Please open the Spotify app on your device and start playing any song first, then try playing from MooDMap again.',
              [{ text: 'OK', style: 'default' }]
            );
          } else {
            useAlertStore.getState().showAlert(
              'Spotify Playback Error',
              err.message || 'Unable to start playback on Spotify. Please verify your Spotify subscription status.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        }
        return;
      }

      let playUrl = track.url;

      // If it's a remote URL, run it through the cache manager
      if (track.url.startsWith('http')) {
        setIsDownloading(true);
        setDownloadProgress(0);

        playUrl = await getCachedAudioUri(track.id, track.url, (progress) => {
          setDownloadProgress(progress);
        });

        setIsDownloading(false);
      }

      if (!playerRef.current) return;

      // Reset volume to full for local files
      playerRef.current.volume = 1.0;

      // Load URL into global player
      playerRef.current.replace(playUrl);
      playerRef.current.loop = repeatModeRef.current === 'one';
      playerRef.current.play();
      setPlaying(true);

      // Activate lock screen / notification controls with track metadata
      playerRef.current.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist,
        albumTitle: track.category,
      }, {
        showSeekForward: true,
        showSeekBackward: true,
      });

      // Auto-tag track to today's mood for recommendation learning
      try {
        const { useAppStore } = require('../stores/appStore');
        const todayMood = useAppStore.getState().todayMood;
        if (todayMood) {
          const userId = useAppStore.getState().user?.id ?? null;
          tagTrackToMood(todayMood.moodType as any, track, todayMood.id, userId);
        }
      } catch (tagErr) {
        // Silent — tagging is non-critical
      }
    } catch (e) {
      console.warn('[MusicContext] Playback error:', e);
      setIsDownloading(false);
    }
  }, []);

  // Keep playRef in sync so the status listener can call the latest play()
  useEffect(() => { playRef.current = play; }, [play]);

  const pause = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lastActionTimeRef.current = Date.now();
    if (currentTrackRef.current?.category === 'spotify') {
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { pause: spotifyPauseAPI } = require('../services/spotify');
          await spotifyPauseAPI(token);
          // Schedule a refresh to sync after the track is paused
          setTimeout(() => {
            triggerPlaybackRefresh();
          }, 1500);
        }
      } catch (err) {
        console.warn('[MusicContext] Spotify pause error:', err);
      }
      setPlaying(false);
      setShouldPlay(false);
      return;
    }
    if (!playerRef.current) return;
    playerRef.current.pause();
    setPlaying(false);
    setShouldPlay(false);
  }, []);

  const resume = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lastActionTimeRef.current = Date.now();
    if (currentTrackRef.current?.category === 'spotify') {
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { play: spotifyPlayAPI } = require('../services/spotify');
          await spotifyPlayAPI(token);
          // Schedule a refresh to sync after the track is resumed
          setTimeout(() => {
            triggerPlaybackRefresh();
          }, 1500);
        }
      } catch (err) {
        console.warn('[MusicContext] Spotify resume error:', err);
      }
      setPlaying(true);
      setShouldPlay(true);
      return;
    }
    if (!playerRef.current) return;
    playerRef.current.play();
    setPlaying(true);
    setShouldPlay(true);
  }, []);

  const next = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lastActionTimeRef.current = Date.now();

    const q = queueRef.current;
    const ci = currentIndexRef.current;
    const sh = shuffleRef.current;
    const rm = repeatModeRef.current;

    // If we have a local queue with tracks, manage the skip locally!
    // This allows instant UI updates and plays the correct track on Spotify via specific URI.
    if (q.length > 1) {
      let nextIndex = ci + 1;
      if (sh) {
        nextIndex = Math.floor(Math.random() * q.length);
      } else if (nextIndex >= q.length) {
        if (rm === 'all') {
          nextIndex = 0;
        } else {
          return; // End of queue
        }
      }

      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      await playRef.current?.(q[nextIndex], undefined, undefined, undefined, true);
      return;
    }

    // Fallback: If single track in queue, call Spotify's endpoint
    if (currentTrackRef.current?.category === 'spotify') {
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { nextTrack: spotifyNextAPI } = require('../services/spotify');
          await spotifyNextAPI(token);
          // Schedule a refresh after Spotify skips
          setTimeout(() => {
            triggerPlaybackRefresh();
          }, 2000);
        }
      } catch (err) {
        console.warn('[MusicContext] Spotify next fallback error:', err);
      }
    }
  }, []);

  const prev = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lastActionTimeRef.current = Date.now();

    const q = queueRef.current;
    const ci = currentIndexRef.current;
    const sh = shuffleRef.current;
    const rm = repeatModeRef.current;
    const isSpotify = currentTrackRef.current?.category === 'spotify';

    // If we have a local queue with tracks, manage the skip locally!
    if (q.length > 1) {
      let prevIndex = ci - 1;
      if (sh) {
        prevIndex = Math.floor(Math.random() * q.length);
      } else if (prevIndex < 0) {
        if (isSpotify) {
          // local queue only has tracks from the clicked track onwards
          // Fall through to native Spotify prev which has full playlist context.
          prevIndex = -1; // Signal to fall through
        } else if (rm === 'all') {
          prevIndex = q.length - 1;
        } else {
          prevIndex = 0; // Clamp
        }
      }

      if (prevIndex >= 0) {
        currentIndexRef.current = prevIndex;
        setCurrentIndex(prevIndex);
        await playRef.current?.(q[prevIndex], undefined, undefined, undefined, true);
        return;
      }
      // If prevIndex is -1 (Spotify at start), fall through to native prev below
    }

    // Use Spotify's native previousTrack API — it has full playlist context
    if (isSpotify) {
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { previousTrack: spotifyPrevAPI } = require('../services/spotify');
          await spotifyPrevAPI(token);
          // Schedule a refresh to sync the new track state
          setTimeout(() => {
            triggerPlaybackRefresh();
          }, 2000);
        }
      } catch (err) {
        console.warn('[MusicContext] Spotify prev error:', err);
      }
    }
  }, []);

  // Keep nextRef and prevRef in sync so the status listener can call the latest controls
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);

  const seekTo = useCallback(async (seconds: number) => {
    // Spotify seek: call the Spotify API and update UI instantly
    if (currentTrackRef.current?.category === 'spotify') {
      lastActionTimeRef.current = Date.now();
      setCurrentTime(seconds); // Instant UI feedback
      try {
        const { useTierStore } = require('../stores/tierStore');
        const token = await useTierStore.getState().getValidAccessToken();
        if (token) {
          const { seekToPosition } = require('../services/spotify');
          await seekToPosition(token, Math.floor(seconds * 1000));
          // Schedule a refresh to sync position after seek
          setTimeout(() => {
            triggerPlaybackRefresh();
          }, 1500);
        }
      } catch (err) {
        console.warn('[MusicContext] Spotify seek error:', err);
      }
      return;
    }
    if (!playerRef.current) return;
    playerRef.current.seekTo(seconds);
  }, []);

  // Tick Spotify progress locally in the context for smooth progress bar updates
  useEffect(() => {
    if (currentTrack?.category !== 'spotify' || !isPlaying) return;

    const interval = setInterval(() => {
      const curr = currentTimeRef.current;
      const nextTime = curr + 1;



      if (duration > 0 && nextTime >= duration) {
        clearInterval(interval);
        console.log('[MusicContext] Spotify track finished. Auto-advancing...');

        // Auto-advance logic
        const rm = repeatModeRef.current;
        const q = queueRef.current;
        const ci = currentIndexRef.current;
        const sh = shuffleRef.current;

        if (rm === 'one') {
          // Repeat-one: must force replay via API
          seekTo(0);
          if (currentTrackRef.current) {
            playRef.current?.(currentTrackRef.current, undefined, undefined, undefined, true);
          }
        } else if (rm === 'all' || ci < q.length - 1) {
          let nextIdx = ci + 1;
          if (sh) {
            nextIdx = Math.floor(Math.random() * q.length);
          } else if (nextIdx >= q.length) {
            nextIdx = 0;
          }

          // Let Spotify's native player advance and sync state once the poll updates.
          const isSpotify = currentTrackRef.current?.category === 'spotify';
          if (isSpotify && !isQueueCustomRef.current) {
            console.log('[MusicContext] Spotify auto-advancing: waiting for native sync to prevent UI flicker');
            // Trigger an immediate sync request so the poll catches it quickly
            triggerPlaybackRefresh();
            return;
          }

          // Update local state immediately for instant UI feedback (for local audio or custom queues)
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          const nextTrack = q[nextIdx];
          if (nextTrack) {
            setCurrentTrack(nextTrack);
            setCurrentTime(0);
            setDuration(nextTrack.durationSec || 0);

            // Only force play via API if the queue is custom-reordered
            if (isQueueCustomRef.current) {
              console.log('[MusicContext] Custom queue active — forcing correct next track via API');
              playRef.current?.(nextTrack, undefined, undefined, undefined, true);
            }
          }
        } else {
          // End of queue
          const isSpotify = currentTrackRef.current?.category === 'spotify';
          if (isSpotify && !isQueueCustomRef.current) {
            // For Spotify tracks, don't force-pause — let Spotify's native queue auto-advance
            console.log('[MusicContext] Spotify queue end reached: letting native queue continue');
            triggerPlaybackRefresh();
            return;
          }

          // Non-Spotify: stop playback
          console.log('[MusicContext] Queue finished. Stopping playback.');
          setPlaying(false);
          if (playerRef.current) {
            try {
              playerRef.current.pause();
            } catch (e) { }
          }
          const { useTierStore } = require('../stores/tierStore');
          useTierStore.getState().getValidAccessToken().then((token: string | null) => {
            if (token) {
              const { pause: spotifyPauseAPI } = require('../services/spotify');
              spotifyPauseAPI(token).catch((err: any) => console.warn(err));
            }
          });
        }

        // Schedule a refresh to confirm Spotify is in sync
        setTimeout(() => {
          triggerPlaybackRefresh();
        }, 2000);
      } else {
        setCurrentTime(nextTime);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrack?.id, isPlaying, duration, triggerPlaybackRefresh, seekTo]);

  const toggleFavorite = useCallback(async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavorites(prev => {
      const updated = prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId];
      // Persist asynchronously — fire-and-forget inside updater to avoid stale closure
      SecureStore.setItemAsync('music_favorites', JSON.stringify(updated)).catch(e => {
        console.error('[MusicContext] SecureStore save error:', e);
      });
      return updated;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShuffle(prev => !prev);
  }, []);

  const toggleRepeatMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRepeatMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  }, []);

  const cyclePlaybackMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sh = shuffleRef.current;
    const rm = repeatModeRef.current;
    const isSpotify = currentTrackRef.current?.category === 'spotify';

    // Determine next mode in the cycle:
    // Sequence (sh=false, rm=none) -> Shuffle (sh=true, rm=none) ->
    // Repeat All (sh=false, rm=all) -> Repeat One (sh=false, rm=one) -> Sequence
    let nextShuffle = false;
    let nextRepeat: RepeatMode = 'none';

    if (!sh && rm === 'none') {
      // Sequence -> Shuffle
      nextShuffle = true;
      nextRepeat = 'none';
    } else if (sh) {
      // Shuffle -> Repeat All
      nextShuffle = false;
      nextRepeat = 'all';
    } else if (rm === 'all') {
      // Repeat All -> Repeat One
      nextShuffle = false;
      nextRepeat = 'one';
    } else {
      // Repeat One -> Sequence
      nextShuffle = false;
      nextRepeat = 'none';
    }

    // Update local state
    setShuffle(nextShuffle);
    setRepeatMode(nextRepeat);

    // Sync with Spotify API if playing a Spotify track
    if (isSpotify) {
      (async () => {
        try {
          const { useTierStore } = require('../stores/tierStore');
          const token = await useTierStore.getState().getValidAccessToken();
          if (!token) return;

          const { setShuffle: spotifySetShuffle, setRepeat: spotifySetRepeat, getQueue } = require('../services/spotify');

          // Sync shuffle state
          await spotifySetShuffle(token, nextShuffle).catch((e: any) =>
            console.warn('[MusicContext] Spotify setShuffle error:', e)
          );

          // Map our repeat mode to Spotify's repeat state:
          //   'none' -> 'off'       (no repeat)
          //   'all'  -> 'context'   (repeat playlist/album)
          //   'one'  -> 'track'     (repeat single track)
          const spotifyRepeatState = nextRepeat === 'one' ? 'track' : nextRepeat === 'all' ? 'context' : 'off';
          await spotifySetRepeat(token, spotifyRepeatState).catch((e: any) =>
            console.warn('[MusicContext] Spotify setRepeat error:', e)
          );

          // Fetch the updated queue from Spotify to sync our UI queue list
          setTimeout(async () => {
            try {
              const queueData = await getQueue(token);
              if (queueData) {
                const combinedQueue = parseSpotifyQueueHelper(queueData);
                queueRef.current = combinedQueue;
                setQueueState(combinedQueue);

                // Align local indices
                if (queueData.currently_playing) {
                  const currentId = 'spotify_' + queueData.currently_playing.id;
                  const idx = combinedQueue.findIndex(t => t.id === currentId);
                  if (idx !== -1) {
                    currentIndexRef.current = idx;
                    setCurrentIndex(idx);
                    setCurrentTrack(combinedQueue[idx]);
                  }
                }
                console.log('[MusicContext] Shuffled Spotify queue imported and synced successfully.');
              }
            } catch (queueErr) {
              console.warn('[MusicContext] Failed to fetch updated Spotify queue after mode change:', queueErr);
            }
          }, 800); // 800ms delay to let Spotify backend update the queue sequence
        } catch (err) {
          console.warn('[MusicContext] Failed to sync playback mode with Spotify:', err);
        }
      })();
    }
  }, []);

  // Update looping state on the player when repeatMode changes
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.loop = repeatMode === 'one';
    }
  }, [repeatMode]);

  // Scan local device music — paginated to avoid blocking JS thread on large libraries
  const scanLocalMusic = useCallback(async (): Promise<'success' | 'permission_denied' | 'not_supported'> => {
    try {
      const Constants = require('expo-constants').default;
      const appOwnership = Constants.appOwnership;
      const executionEnvironment = Constants.executionEnvironment;
      const isExpoGo = appOwnership === 'expo' || appOwnership === 'guest';

      console.log('[MusicContext] scanLocalMusic diagnostic: appOwnership =', appOwnership, 'executionEnvironment =', executionEnvironment, 'isExpoGo =', isExpoGo);

      if (isExpoGo) {
        console.log('[MusicContext] Local music scanning is not supported in Expo Go.');
        return 'not_supported';
      }

      let MediaLibrary: typeof import('expo-media-library/legacy');
      try {
        console.log('[MusicContext] Attempting to require expo-media-library/legacy');
        MediaLibrary = require('expo-media-library/legacy');
        console.log('[MusicContext] Required expo-media-library/legacy successfully');
      } catch (err: any) {
        console.log('[MusicContext] Failed to require expo-media-library/legacy:', err.message || err);
        return 'not_supported';
      }

      if (!MediaLibrary) {
        console.log('[MusicContext] MediaLibrary required object is null/undefined');
        return 'not_supported';
      }

      console.log('[MusicContext] MediaLibrary methods: requestPermissionsAsync =', typeof MediaLibrary.requestPermissionsAsync, 'getAssetsAsync =', typeof MediaLibrary.getAssetsAsync);

      if (!MediaLibrary.requestPermissionsAsync || !MediaLibrary.getAssetsAsync) {
        console.log('[MusicContext] expo-media-library/legacy API not fully available (missing methods)');
        return 'not_supported';
      }

      console.log('[MusicContext] Requesting media permissions...');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log('[MusicContext] Media permission status:', status);
      if (status !== 'granted') {
        return 'permission_denied';
      }

      // Paginated fetch — loads 200 tracks per page to keep the JS thread responsive
      const PAGE_SIZE = 200;
      let hasMore = true;
      let endCursor: string | undefined;
      let allTracks: Track[] = [];
      let pageNum = 0;

      console.log('[MusicContext] Starting paginated audio asset fetch...');
      while (hasMore) {
        pageNum++;
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: PAGE_SIZE,
          ...(endCursor ? { after: endCursor } : {}),
        });

        const pageAssets = page.assets || [];
        console.log(`[MusicContext] Page ${pageNum}: fetched ${pageAssets.length} assets (total so far: ${allTracks.length + pageAssets.length})`);

        if (pageAssets.length > 0) {
          const formatted: Track[] = pageAssets.map(asset => {
            // Format duration to MM:SS
            const totalSec = Math.floor(asset.duration);
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            const displayDur = `${min}:${sec < 10 ? '0' : ''}${sec}`;

            return {
              id: asset.id,
              title: asset.filename.replace(/\.[^/.]+$/, ""), // Strip extension
              artist: 'Local Track',
              url: asset.uri,
              cover: 'local', // Use gradient fallback — content:// albumart URIs are unreliable
              duration: displayDur,
              durationSec: totalSec,
              category: 'local' as const,
              creationTime: asset.creationTime,
              modificationTime: asset.modificationTime,
            };
          });

          allTracks = [...allTracks, ...formatted];
          // Update state progressively so the UI shows tracks as they load
          setLocalTracks([...allTracks]);
        }

        hasMore = page.hasNextPage;
        endCursor = page.endCursor;
      }

      console.log('[MusicContext] Total audio assets fetched:', allTracks.length);
      return 'success';
    } catch (e: any) {
      console.log('[MusicContext] Outer catch error in scanLocalMusic:', e.message || e);
      const isMissingModule = e?.message?.includes('Cannot find native module') || e?.message?.includes('ExpoMediaLibrary');
      if (isMissingModule) {
        console.log('[MusicContext] Local music scanning is not supported in this environment (missing native module).');
        return 'not_supported';
      }
      console.warn('[MusicContext] Local music scan error:', e);
      return 'permission_denied';
    }
  }, []);

  // Handle track finished and state synchronization
  // Uses refs to avoid stale closures — this effect only subscribes once when the player is ready
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      const isSpotify = currentTrackRef.current?.category === 'spotify';

      // Handle custom command from notification controls (lock screen)
      if (status.customCommand) {
        console.log('[MusicContext] Custom command received:', status.customCommand);
        if (status.customCommand === 'expo.modules.audio.action.NEXT') {
          nextRef.current?.();
        } else if (status.customCommand === 'expo.modules.audio.action.PREV') {
          prevRef.current?.();
        }
      }

      // If playing Spotify, ignore all progress/completion updates from the local silent player!
      if (isSpotify) {
        return;
      }

      // If no track is currently active, ignore silent player progress/completion events
      if (!currentTrackRef.current) {
        return;
      }

      // Guard state updates with value comparison to prevent unnecessary re-renders
      // setPlaying is called ~4x/sec — only update if value actually changed
      setPlaying(prev => prev === status.playing ? prev : status.playing);
      setCurrentTime(prev => {
        const next = status.currentTime || 0;
        // Skip re-render for sub-50ms precision differences
        return Math.abs(prev - next) < 0.05 ? prev : next;
      });
      setDuration(prev => {
        const next = status.duration || 0;
        return prev === next ? prev : next;
      });

      // Auto-advance on track completion
      if (status.didJustFinish) {
        console.log('[MusicContext] Track finished. Auto-advancing...');
        const rm = repeatModeRef.current;
        const q = queueRef.current;
        const ci = currentIndexRef.current;
        const sh = shuffleRef.current;

        if (rm === 'one') {
          player.seekTo(0);
          player.play();
        } else if (rm === 'all' || ci < q.length - 1) {
          // Trigger next
          let nextIdx = ci + 1;
          if (sh) {
            nextIdx = Math.floor(Math.random() * q.length);
          } else if (nextIdx >= q.length) {
            nextIdx = 0;
          }
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          if (playRef.current && q[nextIdx]) {
            playRef.current(q[nextIdx], undefined, undefined, undefined, true);
          }
        } else {
          setPlaying(prev => prev === false ? prev : false);
          player.pause();
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [playerReady]);

  // Memoize context values to prevent unnecessary re-renders in consumer components
  const musicContextValue = useMemo(() => ({
    currentTrack,
    isPlaying,
    shouldPlay,
    queue,
    currentIndex,
    shuffle,
    repeatMode,
    favorites,
    isHeadphonesConnected,
    cacheSize,
    isDownloading,
    downloadProgress,
    localTracks,
    playlists,
    isQueueRecommended,
    play,
    pause,
    resume,
    next,
    prev,
    seekTo,
    toggleFavorite,
    toggleShuffle,
    toggleRepeatMode,
    cyclePlaybackMode,
    scanLocalMusic,
    clearCache,
    refreshCacheSize,
    setQueue,
    addToQueue,
    syncReorderedQueue,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    updateSpotifyPlayback,
    playbackRefreshRequest,
    triggerPlaybackRefresh,
  }), [
    currentTrack, isPlaying, shouldPlay, queue, currentIndex,
    shuffle, repeatMode, favorites, isHeadphonesConnected,
    cacheSize, isDownloading, downloadProgress, localTracks, playlists,
    isQueueRecommended,
    play, pause, resume, next, prev, seekTo, toggleFavorite,
    toggleShuffle, toggleRepeatMode, cyclePlaybackMode,
    scanLocalMusic, clearCache, refreshCacheSize, setQueue, addToQueue, syncReorderedQueue,
    createPlaylist, deletePlaylist, addTrackToPlaylist, removeTrackFromPlaylist,
    updateSpotifyPlayback, playbackRefreshRequest, triggerPlaybackRefresh,
  ]);

  const timeContextValue = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <MusicContext.Provider value={musicContextValue}>
      <MusicTimeContext.Provider value={timeContextValue}>
        {children}
      </MusicTimeContext.Provider>
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

export const usePlaybackTime = () => {
  const context = useContext(MusicTimeContext);
  if (context === undefined) {
    throw new Error('usePlaybackTime must be used within a MusicProvider');
  }
  return context;
};
