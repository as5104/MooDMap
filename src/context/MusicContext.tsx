/**
 * MoodMap — Global Music Provider
 * Persists audio playback state, queue, favorites, and caching state globally across screens.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, AudioPlayer, AudioStatus, setAudioModeAsync, requestNotificationPermissionsAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { getCachedAudioUri, getAudioCacheSize, clearAudioCache } from '../utils/audioCache';

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  duration: string;
  durationSec: number;
  category: 'midnight' | 'chill' | 'energy' | 'heartbeat' | 'ambient' | 'local';
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
  
  // Controls
  play: (track: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
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
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
}

export interface MusicTimeContextType {
  currentTime: number;
  duration: number;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);
const MusicTimeContext = createContext<MusicTimeContextType | undefined>(undefined);

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

  // Persistent Player instance
  const playerRef = useRef<AudioPlayer | null>(null);

  // Refs to avoid stale closures in the status listener
  const currentTrackRef = useRef(currentTrack);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const shuffleRef = useRef(shuffle);
  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  const playRef = useRef<((track: Track) => Promise<void>) | null>(null);
  const nextRef = useRef<(() => void) | null>(null);
  const prevRef = useRef<(() => void) | null>(null);
  const addedCountRef = useRef(0);
  const lastInsertIndexRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  // Reset added queue stack count when track changes
  useEffect(() => {
    addedCountRef.current = 0;
    lastInsertIndexRef.current = currentIndexRef.current;
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

  const addToQueue = useCallback((track: Track) => {
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

  // Set up headphone state simulation or basic check
  useEffect(() => {
    // Simulated detection hook: can be toggled by headphone unplug triggers in OS
    // In React Native Expo, the audio session automatically pauses if headphones are disconnected.
    // We add a listener to check if the route changed to notify UI.
  }, []);

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
    setQueueState(tracks);
    setCurrentIndex(index);
  }, []);

  // Play track implementation
  const play = useCallback(async (track: Track) => {
    addedCountRef.current = 0;
    lastInsertIndexRef.current = currentIndexRef.current;
    try {
      if (!playerRef.current) {
        console.log('[MusicContext] Play rejected: Player not ready');
        return;
      }
      setPlaying(false);
      setCurrentTrack(track);
      setShouldPlay(true);
      
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
    } catch (e) {
      console.error('[MusicContext] Playback error:', e);
      setIsDownloading(false);
    }
  }, []);

  // Keep playRef in sync so the status listener can call the latest play()
  useEffect(() => { playRef.current = play; }, [play]);

  const pause = useCallback(() => {
    if (!playerRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playerRef.current.pause();
    setPlaying(false);
    setShouldPlay(false);
  }, []);

  const resume = useCallback(() => {
    if (!playerRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playerRef.current.play();
    setPlaying(true);
    setShouldPlay(true);
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const ci = currentIndexRef.current;
    const sh = shuffleRef.current;
    const rm = repeatModeRef.current;

    if (q.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
    playRef.current?.(q[nextIndex]);
  }, []);

  const prev = useCallback(() => {
    const q = queueRef.current;
    const ci = currentIndexRef.current;
    const sh = shuffleRef.current;
    const rm = repeatModeRef.current;

    if (q.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let prevIndex = ci - 1;
    if (sh) {
      prevIndex = Math.floor(Math.random() * q.length);
    } else if (prevIndex < 0) {
      if (rm === 'all') {
        prevIndex = q.length - 1;
      } else {
        prevIndex = 0; // Clamp
      }
    }
    
    currentIndexRef.current = prevIndex;
    setCurrentIndex(prevIndex);
    playRef.current?.(q[prevIndex]);
  }, []);

  // Keep nextRef and prevRef in sync so the status listener can call the latest controls
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);

  const seekTo = useCallback((seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(seconds);
  }, []);

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
    if (!sh && rm === 'none') {
      // Sequence -> Shuffle
      setShuffle(true);
      setRepeatMode('none');
    } else if (sh) {
      // Shuffle -> Repeat All
      setShuffle(false);
      setRepeatMode('all');
    } else if (rm === 'all') {
      // Repeat All -> Repeat One
      setShuffle(false);
      setRepeatMode('one');
    } else {
      // Repeat One -> Sequence
      setShuffle(false);
      setRepeatMode('none');
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
      
      // Handle custom command from notification controls (lock screen)
      if (status.customCommand) {
        console.log('[MusicContext] Custom command received:', status.customCommand);
        if (status.customCommand === 'expo.modules.audio.action.NEXT') {
          nextRef.current?.();
        } else if (status.customCommand === 'expo.modules.audio.action.PREV') {
          prevRef.current?.();
        }
      }
      
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
            playRef.current(q[nextIdx]);
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
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
  }), [
    currentTrack, isPlaying, shouldPlay, queue, currentIndex,
    shuffle, repeatMode, favorites, isHeadphonesConnected,
    cacheSize, isDownloading, downloadProgress, localTracks, playlists,
    play, pause, resume, next, prev, seekTo, toggleFavorite,
    toggleShuffle, toggleRepeatMode, cyclePlaybackMode,
    scanLocalMusic, clearCache, refreshCacheSize, setQueue, addToQueue,
    createPlaylist, deletePlaylist, addTrackToPlaylist, removeTrackFromPlaylist,
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
