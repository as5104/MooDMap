/**
 * MoodMap - Music Hub
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  TextInput,
  BackHandler,
  FlatList,
  Platform,
  PanResponder,
  Animated as RNAnimated,
  LayoutAnimation,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { useMusic, usePlaybackTime, Track, TRACKS_LIBRARY, Playlist } from '../context/MusicContext';
import { Colors } from '../constants/colors';
import { Fonts, FontSizes } from '../constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '../constants/layout';
import { GradientBackground, GlassCard, AnimatedPressable } from '../components/ui';
import { useBlurTarget } from '../components/ui/GradientBackground';
import { MusicCover } from '../components/music/MusicCover';
import { FloatingMiniPlayer } from '../components/music/FloatingMiniPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



const PlayerBackground = React.memo(() => {
  const blurCtx = useBlurTarget();
  const isAndroid = Platform.OS === 'android';
  const ready = blurCtx?.ready ?? false;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Base vibrant gradient */}
      <LinearGradient
        colors={['#8DE91D', '#0D9488', '#03070E']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Glowing orbs */}
      <View style={StyleSheet.absoluteFill}>
        {/* Top-right vibrant lime green orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'rgba(190, 255, 108, 0.65)',
            top: -60,
            right: -60,
          }
        ]} />
        
        {/* Center-left vibrant mint/emerald orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 400,
            height: 400,
            borderRadius: 200,
            backgroundColor: 'rgba(52, 211, 153, 0.5)',
            top: '15%',
            left: -100,
          }
        ]} />

        {/* Center-right vibrant blue/cyan orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: 'rgba(6, 182, 212, 0.45)',
            top: '40%',
            right: -80,
          }
        ]} />

        {/* Bottom-left vibrant green orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: 'rgba(16, 185, 129, 0.4)',
            bottom: -90,
            left: -30,
          }
        ]} />
      </View>

      {/* Full screen Blur */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={95}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : ready ? (
        <BlurView
          intensity={50}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurReductionFactor={2}
          blurTarget={blurCtx!.ref}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 20, 15, 0.85)' }]} />
      )}

      {/* Semi-transparent overlay to ensure readability and contrast */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3, 7, 14, 0.35)' }]} />
    </View>
  );
});

PlayerBackground.displayName = 'PlayerBackground';


// Formatting seconds to MM:SS
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

const VisualizerBar = React.memo(({
  baseHeight,
  isPlaying,
  isActive,
}: {
  baseHeight: number;
  isPlaying: boolean;
  isActive: boolean;
}) => {
  const height = useSharedValue(baseHeight);

  useEffect(() => {
    if (isPlaying) {
      height.value = withRepeat(
        withTiming(baseHeight * (0.3 + Math.random() * 0.9), {
          duration: 350 + Math.random() * 300,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      height.value = withTiming(baseHeight, { duration: 300 });
    }
  }, [isPlaying, baseHeight, height]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: height.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        animatedStyle,
        {
          backgroundColor: isActive ? Colors.text.primary : 'rgba(255, 255, 255, 0.25)',
        },
      ]}
    />
  );
});
VisualizerBar.displayName = 'VisualizerBar';

const TrackItem = React.memo(({
  track,
  isCurrent,
  onPress,
  onMorePress,
}: {
  track: Track;
  isCurrent: boolean;
  onPress: (track: Track) => void;
  onMorePress: (track: Track) => void;
}) => {
  const handlePress = useCallback(() => {
    onPress(track);
  }, [track, onPress]);

  const handleMorePress = useCallback((e: any) => {
    e.stopPropagation();
    onMorePress(track);
  }, [track, onMorePress]);

  return (
    <GlassCard
      onPress={handlePress}
      intensity="subtle"
      padding="none"
      style={[styles.trackItem, isCurrent && styles.activeTrackItem]}
    >
      <View style={styles.trackItemInner}>
        <MusicCover cover={track.cover} style={styles.trackCover} iconSize={14} borderRadius={20} />
        
        <View style={styles.trackDetails}>
          <Text numberOfLines={1} style={[styles.trackName, isCurrent && styles.activeTrackText]}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.trackArtist}>
            {track.artist}
          </Text>
        </View>

        <View style={styles.trackActions}>
          <Text style={styles.trackDuration}>{track.duration}</Text>
          <Pressable
            onPress={handleMorePress}
            hitSlop={12}
            style={styles.trackMoreBtn}
          >
            <Feather name="more-vertical" size={20} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
});
TrackItem.displayName = 'TrackItem';

// Static category data — defined at module level to avoid re-creation on renders
const CATEGORIES_LIST = [
  {
    slug: 'local',
    label: 'My Music',
    subtitle: 'Device Library',
    cover: 'local',
    height: 240,
  },
  {
    slug: 'ambient',
    label: 'Ambient Loops',
    subtitle: '6 loops',
    cover: 'ambient',
    height: 180,
  },
  {
    slug: 'midnight',
    label: 'Midnight Vibes',
    subtitle: '108 songs',
    cover: 'midnight',
    badge: 'Gold Record',
    height: 240,
  },
  {
    slug: 'chill',
    label: 'Chill & Relax',
    subtitle: '91 songs',
    cover: 'chill',
    height: 180,
  },
  {
    slug: 'energy',
    label: 'Energy Boost',
    subtitle: '55 songs',
    cover: 'energy',
    height: 180,
  },
  {
    slug: 'heartbeat',
    label: 'Heartbeat Hits',
    subtitle: '125 songs',
    cover: 'heartbeat',
    badge: 'Gold Record',
    height: 240,
  },
];

const CATEGORIES_LEFT_COL = CATEGORIES_LIST.filter((_, i) => i % 2 === 0);
const CATEGORIES_RIGHT_COL = CATEGORIES_LIST.filter((_, i) => i % 2 === 1);

const getCategoryIcon = (slug: string) => {
  switch (slug) {
    case 'midnight': return 'moon';
    case 'chill': return 'wind';
    case 'energy': return 'zap';
    case 'heartbeat': return 'heart';
    case 'ambient': return 'droplet';
    default: return 'music';
  }
};

const CategoriesView = React.memo(({
  onCategoryPress,
  onSettingsPress,
}: {
  onCategoryPress: (slug: string, label: string) => void;
  onSettingsPress: () => void;
}) => {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {/* Header section with heading "Music" and settings gear button */}
      <View style={styles.categoriesHeader}>
        <Text style={styles.categoriesTitle}>Music</Text>
        <Pressable 
          style={styles.iconBtn} 
          onPress={onSettingsPress}
        >
          <Feather name="settings" size={20} color={Colors.text.primary} />
        </Pressable>
      </View>

      {/* Filter Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: Spacing.sm }}>
        {['All', 'Trending', 'New Artist', 'New Release'].map((filter, i) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, i === 0 && styles.activeFilterChip]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Text style={[styles.filterChipText, i === 0 && styles.activeFilterChipText]}>
              {filter}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Bento Grid */}
      <View style={styles.bentoGridRow}>
        <View style={styles.bentoColumn}>
          {CATEGORIES_LEFT_COL.map((cat) => (
            <AnimatedPressable
              key={cat.slug}
              style={[styles.bentoCard, { height: cat.height }]}
              onPress={() => onCategoryPress(cat.slug, cat.label)}
            >
              <MusicCover cover={cat.slug} style={StyleSheet.absoluteFill} showIcon={false} borderRadius={Radius.lg} />
              <View style={styles.bentoBgIcon}>
                <Feather name={getCategoryIcon(cat.slug)} size={80} color="rgba(255, 255, 255, 0.05)" />
              </View>
              <View style={styles.bentoGradient}>
                {cat.badge && (
                  <View style={styles.bentoBadge}>
                    <Text style={styles.bentoBadgeText}>{cat.badge}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <View style={styles.bentoFooter}>
                  <Text numberOfLines={1} style={styles.bentoTitle}>{cat.label}</Text>
                  <Text style={styles.bentoSubtitle}>{cat.subtitle}</Text>
                </View>
              </View>
            </AnimatedPressable>
          ))}
        </View>
        <View style={styles.bentoColumn}>
          {CATEGORIES_RIGHT_COL.map((cat) => (
            <AnimatedPressable
              key={cat.slug}
              style={[styles.bentoCard, { height: cat.height }]}
              onPress={() => onCategoryPress(cat.slug, cat.label)}
            >
              <MusicCover cover={cat.slug} style={StyleSheet.absoluteFill} showIcon={false} borderRadius={Radius.lg} />
              <View style={styles.bentoBgIcon}>
                <Feather name={getCategoryIcon(cat.slug)} size={80} color="rgba(255, 255, 255, 0.05)" />
              </View>
              <View style={styles.bentoGradient}>
                {cat.badge && (
                  <View style={styles.bentoBadge}>
                    <Text style={styles.bentoBadgeText}>{cat.badge}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <View style={styles.bentoFooter}>
                  <Text numberOfLines={1} style={styles.bentoTitle}>{cat.label}</Text>
                  <Text style={styles.bentoSubtitle}>{cat.subtitle}</Text>
                </View>
              </View>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
});
CategoriesView.displayName = 'CategoriesView';

// Extracted search bar component — isolates keystroke re-renders from the track list
const ListViewSearchBar = React.memo(({ onSearchChange }: { onSearchChange: (q: string) => void }) => {
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput, onSearchChange]);

  return (
    <View style={styles.searchBar}>
      <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search songs or artists..."
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchInput.length > 0 && (
        <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
          <Feather name="x" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
        </Pressable>
      )}
    </View>
  );
});
ListViewSearchBar.displayName = 'ListViewSearchBar';

const PlayingSongIndicator = React.memo(({
  scrollY,
  currentPlayingIndex,
  isScrolling,
  listHeight,
}: {
  scrollY: SharedValue<number>;
  currentPlayingIndex: number;
  isScrolling: SharedValue<boolean>;
  listHeight: number;
}) => {
  const insets = useSafeAreaInsets();
  const { currentTrack } = useMusic();

  const itemY = currentPlayingIndex * 76;
  const itemHeight = 68;
  const itemBottomY = itemY + itemHeight;

  const animatedStyle = useAnimatedStyle(() => {
    // If invalid index or layout, hide completely
    if (currentPlayingIndex === -1 || listHeight <= 0) {
      return {
        opacity: 0,
        transform: [{ scale: 0 }]
      };
    }

    const currentScrollY = scrollY.value;
    const isScrollActive = isScrolling.value;
    
    const hasMiniPlayer = !!currentTrack;
    // Calculate the actual visible viewport height, taking the mini player into account
    // miniPlayer is at bottom: Math.max(insets.bottom, 16), has height ~60, plus 16px safe buffer
    const miniPlayerHeight = hasMiniPlayer 
      ? Math.max(insets.bottom, 16) + 60 + 16
      : 0;
    const visibleViewportHeight = listHeight - miniPlayerHeight;
    
    // Check if the playing track is above or below the visible viewport
    const isAbove = itemBottomY < currentScrollY;
    const isBelow = itemY > currentScrollY + visibleViewportHeight;
    const isOutOfView = isAbove || isBelow;
    
    // Determine target opacity: show only when scrolling and track is out of view
    const targetOpacity = (isScrollActive && isOutOfView) ? 1 : 0;
    
    // Position the arrow: top of list if track is above, bottom of list if track is below
    const targetTranslateY = isAbove 
      ? 12 
      : (isBelow ? visibleViewportHeight - 76 : listHeight / 2);
      
    // Rotation: 0 deg (pointing UP) if above, 180 deg (pointing DOWN) if below
    const targetRotation = isAbove ? '0deg' : '180deg';
    
    return {
      opacity: withTiming(targetOpacity, { duration: 150 }),
      transform: [
        { translateY: withSpring(targetTranslateY, { damping: 18, stiffness: 150 }) },
        { scale: withSpring(targetOpacity, { damping: 15, stiffness: 180 }) },
        { rotate: withTiming(targetRotation, { duration: 200 }) }
      ]
    };
  }, [currentPlayingIndex, listHeight, currentTrack, insets.bottom]);

  if (currentPlayingIndex === -1 || listHeight <= 0) return null;

  return (
    <Animated.View style={[styles.songPointerWrapper, animatedStyle]} pointerEvents="none">
      <BlurView intensity={35} tint="dark" style={styles.songPointerBlur}>
        <Feather name="chevron-up" size={20} color={Colors.accent.primary} />
      </BlurView>
    </Animated.View>
  );
});
PlayingSongIndicator.displayName = 'PlayingSongIndicator';

const ListView = React.memo(({
  category,
  categoryLabel,
  onGoBack,
  onTrackPress,
  onMorePress,
  sortBy,
  setShowSortMenu,
}: {
  category: string;
  categoryLabel: string;
  onGoBack: () => void;
  onTrackPress: (track: Track, tracks: Track[]) => void;
  onMorePress: (track: Track, fromPlaylistId?: string) => void;
  sortBy: 'default' | 'titleAsc' | 'titleDesc' | 'dateNewest' | 'dateOldest';
  setShowSortMenu: (show: boolean) => void;
}) => {
  const {
    currentTrack,
    favorites,
    localTracks,
    scanLocalMusic,
    playlists,
    createPlaylist,
    deletePlaylist,
  } = useMusic();

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlist' | 'downloads' | 'liked'>('all');
  const [localScanning, setLocalScanning] = useState(category === 'local' && localTracks.length === 0);
  const [localPermissionDenied, setLocalPermissionDenied] = useState(false);
  const [localUnsupported, setLocalUnsupported] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  // Playlist views state
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [createPlaylistText, setCreatePlaylistText] = useState('');
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);

  // Indicator helper states & refs
  const scrollYShared = useSharedValue(0);
  const isScrollingShared = useSharedValue(false);
  const [listHeight, setListHeight] = useState(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollYShared.value = y;
    
    isScrollingShared.value = true;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingShared.value = false;
    }, 400);
  }, [scrollYShared, isScrollingShared]);

  const handleLayout = useCallback((event: any) => {
    setListHeight(event.nativeEvent.layout.height);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);



  // Local music auto-scan when selected (skipped if already scanned)
  useEffect(() => {
    if (category === 'local') {
      if (localTracks.length > 0) {
        setLocalScanning(false);
        return;
      }
      scanLocalMusic().then((result) => {
        setLocalScanning(false);
        if (result === 'not_supported') {
          setLocalUnsupported(true);
          setLocalPermissionDenied(false);
        } else if (result === 'permission_denied') {
          setLocalPermissionDenied(true);
          setLocalUnsupported(false);
        } else {
          setLocalPermissionDenied(false);
          setLocalUnsupported(false);
        }
      }).catch(() => {
        setLocalScanning(false);
      });
    }
  }, [category, scanLocalMusic, localTracks.length]);

  const handleManualRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocalScanning(true);
    scanLocalMusic().then((result) => {
      setLocalScanning(false);
      if (result === 'not_supported') {
        setLocalUnsupported(true);
        setLocalPermissionDenied(false);
      } else if (result === 'permission_denied') {
        setLocalPermissionDenied(true);
        setLocalUnsupported(false);
      } else {
        setLocalPermissionDenied(false);
        setLocalUnsupported(false);
      }
    }).catch(() => {
      setLocalScanning(false);
    });
  }, [scanLocalMusic]);

  // Resolve tracks for selected category
  const getCategoryTracks = useCallback((cat: string): Track[] => {
    if (cat === 'local') return localTracks;
    return TRACKS_LIBRARY.filter(t => t.category === cat);
  }, [localTracks]);

  // Optimize favorites lookups
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  // Filtered tracks memo
  const tracksListToRender = useMemo(() => {
    if (activeFilter === 'playlist') {
      if (selectedPlaylist) {
        const currentPl = playlists.find(p => p.id === selectedPlaylist.id);
        return currentPl ? currentPl.tracks : [];
      }
      return [];
    }

    let tracks = [...getCategoryTracks(category)];
    
    if (activeFilter === 'liked') {
      tracks = tracks.filter(t => favoritesSet.has(t.id));
    }

    if (debouncedSearchQuery.trim() !== '') {
      const q = debouncedSearchQuery.toLowerCase();
      tracks = tracks.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q)
      );
    }

    // Apply metadata-based sorting
    if (sortBy === 'titleAsc') {
      tracks.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'titleDesc') {
      tracks.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'dateNewest') {
      tracks.sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0));
    } else if (sortBy === 'dateOldest') {
      tracks.sort((a, b) => (a.creationTime ?? 0) - (b.creationTime ?? 0));
    }
    
    return tracks;
  }, [category, activeFilter, selectedPlaylist, playlists, favoritesSet, debouncedSearchQuery, getCategoryTracks, sortBy]);

  const currentPlayingIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return tracksListToRender.findIndex(t => t.id === currentTrack.id);
  }, [currentTrack, tracksListToRender]);

  const handleTrackItemPress = useCallback((track: Track) => {
    onTrackPress(track, tracksListRef.current);
  }, [onTrackPress]);

  // Keep ref in sync with latest filtered tracks list to avoid callback re-creation
  const tracksListRef = useRef(tracksListToRender);
  tracksListRef.current = tracksListToRender;

  const handleTrackMorePress = useCallback((track: Track) => {
    onMorePress(track, activeFilter === 'playlist' && selectedPlaylist ? selectedPlaylist.id : undefined);
  }, [onMorePress, activeFilter, selectedPlaylist]);

  const renderTrackItem = useCallback(({ item: track }: { item: Track }) => {
    const isCurrent = currentTrack?.id === track.id;
    return (
      <TrackItem
        track={track}
        isCurrent={isCurrent}
        onPress={handleTrackItemPress}
        onMorePress={handleTrackMorePress}
      />
    );
  }, [currentTrack?.id, handleTrackItemPress, handleTrackMorePress]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 68 + 8, // item height (68) + gap (8)
    offset: (68 + 8) * index,
    index,
  }), []);

  return (
    <View style={{ flex: 1 }}>
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        {/* Absolute Centered Title */}
        <View style={styles.absoluteTitleContainer} pointerEvents="none">
          <Text style={styles.navigationTitleText} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>

        <View style={{ width: 96, alignItems: 'flex-start' }}>
          <Pressable style={styles.closeBtn} onPress={onGoBack}>
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>
        </View>
        
        <View style={{ width: 96, alignItems: 'flex-end' }}>
          {category === 'local' ? (
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable
                style={styles.closeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSortMenu(true);
                }}
              >
                <Feather name="sliders" size={18} color={sortBy !== 'default' ? Colors.accent.primary : Colors.text.primary} />
              </Pressable>
              <Pressable
                style={styles.closeBtn}
                onPress={handleManualRefresh}
                disabled={localScanning}
              >
                {localScanning ? (
                  <ActivityIndicator size="small" color={Colors.accent.primary} />
                ) : (
                  <Feather name="refresh-cw" size={18} color={Colors.text.primary} />
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.closeBtn}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Feather name="heart" size={20} color={Colors.text.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter scroll */}
      <View style={styles.listFilterRow}>
        {(['all', 'playlist', 'downloads', 'liked'] as const).map(f => (
          <Pressable
            key={f}
            style={[styles.listFilterChip, activeFilter === f && styles.activeListFilterChip]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveFilter(f);
              setSelectedPlaylist(null);
            }}
          >
            <Text style={[styles.listFilterText, activeFilter === f && styles.activeListFilterText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search Input Bar (hidden in playlist list view) — extracted for render isolation */}
      {!(activeFilter === 'playlist' && !selectedPlaylist) && (
        <ListViewSearchBar onSearchChange={setDebouncedSearchQuery} />
      )}

      {activeFilter === 'playlist' && !selectedPlaylist ? (
        /* Playlists list view */
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          <Pressable 
            style={styles.createPlaylistRowBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreatePrompt(true);
            }}
          >
            <View style={styles.createPlaylistInner}>
              <Feather name="plus-circle" size={18} color={Colors.accent.primary} />
              <Text style={styles.createPlaylistRowText}>Create New Playlist</Text>
            </View>
          </Pressable>

          {showCreatePrompt && (
            <GlassCard intensity="strong" padding="md" style={styles.inlineCreateCard}>
              <Text style={styles.createPlaylistTitle}>New Playlist</Text>
              <TextInput
                style={styles.createPlaylistInput}
                placeholder="Name your playlist..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={createPlaylistText}
                onChangeText={setCreatePlaylistText}
                maxLength={30}
                autoFocus
              />
              <View style={styles.createPlaylistButtons}>
                <Pressable 
                  style={styles.createBtnCancel} 
                  onPress={() => {
                    setShowCreatePrompt(false);
                    setCreatePlaylistText('');
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.bodySemiBold }}>Cancel</Text>
                </Pressable>
                <Pressable 
                  style={styles.createBtnConfirm}
                  onPress={async () => {
                    if (createPlaylistText.trim()) {
                      await createPlaylist(createPlaylistText.trim());
                      setShowCreatePrompt(false);
                      setCreatePlaylistText('');
                    }
                  }}
                >
                  <Text style={{ color: '#0A0A0C', fontFamily: Fonts.bodyBold }}>Create</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {playlists.length === 0 ? (
            <View style={styles.centerContainer}>
              <Feather name="folder" size={48} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>No Playlists</Text>
              <Text style={styles.emptyTracksDesc}>Create a playlist and add tracks from the three-dots menu.</Text>
            </View>
          ) : (
            playlists.map(pl => (
              <GlassCard 
                key={pl.id} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPlaylist(pl);
                }} 
                intensity="subtle" 
                padding="none" 
                style={styles.playlistItemCard}
              >
                <View style={styles.playlistItemInner}>
                  <View style={styles.playlistIconContainer}>
                    <Feather name="folder" size={20} color={Colors.accent.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playlistItemName}>{pl.name}</Text>
                    <Text style={styles.playlistItemCount}>{pl.tracks.length} tracks</Text>
                  </View>
                  <Pressable 
                    onPress={(e) => {
                      e.stopPropagation();
                      deletePlaylist(pl.id);
                    }} 
                    hitSlop={12} 
                    style={styles.playlistDeleteBtn}
                  >
                    <Feather name="trash-2" size={16} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </View>
              </GlassCard>
            ))
          )}
        </ScrollView>
      ) : (
        /* Standard Track list view or Playlist details view */
        <View style={{ flex: 1 }}>
          {activeFilter === 'playlist' && selectedPlaylist && (
            <View style={styles.playlistHeaderRow}>
              <Pressable style={styles.playlistBackBtn} onPress={() => setSelectedPlaylist(null)}>
                <Feather name="arrow-left" size={16} color={Colors.text.primary} />
                <Text style={styles.playlistBackText}>Playlists</Text>
              </Pressable>
              
              <Text style={styles.playlistTitleLabel} numberOfLines={1}>{selectedPlaylist.name}</Text>
              
              {tracksListToRender.length > 0 && (
                <Pressable 
                  style={styles.playlistPlayAllBtn} 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onTrackPress(tracksListToRender[0], tracksListToRender);
                  }}
                >
                  <Feather name="play" size={12} color="#0A0A0C" />
                  <Text style={styles.playlistPlayAllText}>Play All</Text>
                </Pressable>
              )}
            </View>
          )}

          {localScanning ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.accent.primary} />
              <Text style={styles.scanningText}>Scanning Local Library...</Text>
            </View>
          ) : category === 'local' && localUnsupported && activeFilter !== 'playlist' ? (
            <View style={styles.centerContainer}>
              <Feather name="alert-triangle" size={48} color={Colors.text.secondary} />
              <Text style={styles.permissionTitle}>Local Music Unsupported</Text>
              <Text style={styles.permissionDesc}>
                Scanning local audio files is not supported in Expo Go. Please compile a custom development build to access local files.
              </Text>
            </View>
          ) : category === 'local' && localPermissionDenied && activeFilter !== 'playlist' ? (
            <View style={styles.centerContainer}>
              <Feather name="lock" size={48} color={Colors.text.secondary} />
              <Text style={styles.permissionTitle}>Permission Required</Text>
              <Text style={styles.permissionDesc}>
                {"Please grant storage access to scan and play your device's audio files."}
              </Text>
              <Pressable
                style={styles.permissionBtn}
                onPress={async () => {
                  const result = await scanLocalMusic();
                  if (result === 'success') {
                    setLocalPermissionDenied(false);
                    setLocalUnsupported(false);
                  } else if (result === 'not_supported') {
                    setLocalUnsupported(true);
                    setLocalPermissionDenied(false);
                  }
                }}
              >
                <Text style={styles.permissionBtnText}>Scan Music</Text>
              </Pressable>
            </View>
          ) : tracksListToRender.length === 0 ? (
            <View style={styles.centerContainer}>
              <Feather name="music" size={48} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>No Songs Found</Text>
              <Text style={styles.emptyTracksDesc}>
                {debouncedSearchQuery.trim() !== '' ? 'No songs match your search query.' : (activeFilter === 'liked' ? 'No favourited tracks in this category yet.' : (activeFilter === 'playlist' ? 'This playlist is empty. Add songs from the three-dots menu.' : 'There are no songs in this category.'))}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, position: 'relative' }} onLayout={handleLayout}>
              <FlatList
                data={tracksListToRender}
                keyExtractor={(item) => item.id}
                renderItem={renderTrackItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listScroll}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={10}
                getItemLayout={getItemLayout}
                removeClippedSubviews={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
              <PlayingSongIndicator
                scrollY={scrollYShared}
                currentPlayingIndex={currentPlayingIndex}
                isScrolling={isScrollingShared}
                listHeight={listHeight}
              />
            </View>
          )}
        </View>
      )}


    </View>
  );
});
ListView.displayName = 'ListView';

// Waveform heights pattern matching the beautiful UI
const WAVEFORM_PATTERN = [
  6, 8, 12, 16, 20, 14, 10, 12, 18, 24, 30, 26, 18, 14, 18, 24, 32, 40, 44, 38, 28, 20, 14, 18, 26, 36, 46, 52, 44, 32, 22, 16, 12, 16, 22, 28, 34, 28, 20, 14, 10, 8, 12, 16, 10, 6
];

const WaveformTimeline = React.memo(({
  isPlaying,
  isPlayerActive,
  currentTrack,
  seekTo,
}: {
  isPlaying: boolean;
  isPlayerActive: boolean;
  currentTrack: Track;
  seekTo: (seconds: number) => void;
}) => {
  const { currentTime, duration } = usePlaybackTime();
  const [barWidth, setBarWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);

  // We use refs to avoid stale PanResponder closures:
  const seekStateRef = useRef({
    barWidth,
    duration,
    seekTo,
    isScrubbing,
    scrubPercent,
    initialLocationX: 0,
    initialPageX: 0,
  });

  // Maintain current values in the ref
  seekStateRef.current.barWidth = barWidth;
  seekStateRef.current.duration = duration;
  seekStateRef.current.seekTo = seekTo;
  seekStateRef.current.isScrubbing = isScrubbing;
  seekStateRef.current.scrubPercent = scrubPercent;

  const onBarLayout = useCallback((e: any) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const panResponderRef = useRef<any>(null);
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { barWidth: width, duration: dur } = seekStateRef.current;
        if (width <= 0 || dur <= 0) return;
        setIsScrubbing(true);
        const locationX = evt.nativeEvent.locationX;
        const pageX = evt.nativeEvent.pageX;

        seekStateRef.current.initialLocationX = locationX;
        seekStateRef.current.initialPageX = pageX;

        const pct = Math.max(0, Math.min(1, locationX / width));
        setScrubPercent(pct);
        seekStateRef.current.scrubPercent = pct;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { barWidth: width, duration: dur, initialLocationX, initialPageX } = seekStateRef.current;
        if (width <= 0 || dur <= 0) return;

        const deltaX = evt.nativeEvent.pageX - initialPageX;
        const currentX = initialLocationX + deltaX;

        const pct = Math.max(0, Math.min(1, currentX / width));
        setScrubPercent(pct);
        seekStateRef.current.scrubPercent = pct;
      },
      onPanResponderRelease: () => {
        const { duration: dur, seekTo: seek, scrubPercent: pct } = seekStateRef.current;
        setIsScrubbing(false);
        if (pct !== null && dur > 0) {
          seek(pct * dur);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setScrubPercent(null);
        seekStateRef.current.scrubPercent = null;
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        setScrubPercent(null);
        seekStateRef.current.scrubPercent = null;
      },
    });
  }
  const panResponder = panResponderRef.current;

  const progressPercent = duration > 0 ? currentTime / duration : 0;
  const activePercent = isScrubbing && scrubPercent !== null ? scrubPercent : progressPercent;
  const displayTime = isScrubbing && scrubPercent !== null ? scrubPercent * duration : currentTime;

  return (
    <View style={styles.waveformTimelineContainer}>
      {/* Non-interactive Waveform Progress Visualizer */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveformRow}>
          {WAVEFORM_PATTERN.map((baseHeight, i) => {
            const barProgress = i / WAVEFORM_PATTERN.length;
            const trackProgress = duration > 0 ? currentTime / duration : 0;
            const isActiveBar = barProgress <= trackProgress;

            return (
              <VisualizerBar
                key={i}
                baseHeight={baseHeight}
                isPlaying={isPlaying && isPlayerActive}
                isActive={isActiveBar}
              />
            );
          })}
        </View>
      </View>

      {/* Timestamps & Precise Scrubbing Progress Bar Row */}
      <View style={styles.timeLabelRowContainer}>
        <View style={styles.timeLabelRow}>
          <Text style={[styles.timeLabel, { textAlign: 'left' }]}>{formatTime(displayTime)}</Text>
          
          {/* Tappable, Scrubbable Progress Bar */}
          <View 
            style={styles.progressBarWrapper} 
            onLayout={onBarLayout}
            {...panResponder.panHandlers}
          >
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${activePercent * 100}%` }]} />
              {isScrubbing && (
                <View 
                  style={[
                    styles.progressBarThumb, 
                    { 
                      left: `${activePercent * 100}%`,
                      transform: [{ translateX: -6 }]
                    }
                  ]}
                />
              )}
            </View>
          </View>

          <Text style={[styles.timeLabel, { textAlign: 'right' }]}>
            {currentTrack.category === 'ambient' ? 'Loop' : formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
});

WaveformTimeline.displayName = 'WaveformTimeline';

const PlayerView = React.memo(({
  onGoBack,
  onShowQueue,
  isPlayerActive,
}: {
  onGoBack: () => void;
  onShowQueue: () => void;
  isPlayerActive: boolean;
}) => {
  const {
    currentTrack,
    isPlaying,
    favorites,
    shuffle,
    repeatMode,
    isDownloading,
    downloadProgress,
    pause,
    resume,
    next,
    prev,
    seekTo,
    toggleFavorite,
    cyclePlaybackMode,
  } = useMusic();

  const insets = useSafeAreaInsets();


  // Artwork rotation animation
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (isPlaying && isPlayerActive) {
      rotation.value = rotation.value % 360;
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 15000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }
  }, [isPlaying, isPlayerActive, rotation]);

  const rotatedArtworkStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!currentTrack) return null;

  const isCurrentFav = favorites.includes(currentTrack.id);

  return (
    <View style={[styles.playerContainer, { paddingBottom: insets.bottom + 48 }]}>
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        {/* Absolute Centered Title */}
        <View style={styles.absoluteTitleContainer} pointerEvents="none">
          <Text style={styles.navigationTitleText} numberOfLines={1}>
            Now Playing
          </Text>
        </View>

        <Pressable style={styles.closeBtn} onPress={onGoBack}>
          <Feather name="chevron-left" size={24} color={Colors.text.primary} />
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={() => toggleFavorite(currentTrack.id)}>
          <Feather
            name="heart"
            size={20}
            color={isCurrentFav ? Colors.error : Colors.text.primary}
            fill={isCurrentFav ? Colors.error : 'transparent'}
          />
        </Pressable>
      </View>

      {/* Large Centered Rotating Artwork circle */}
      <View style={styles.playerArtworkSection}>
        <View style={styles.playerArtworkWrapper}>
          {/* Smooth SVG rings to prevent Android jagged polygon bug */}
          <Svg width={260} height={260} style={StyleSheet.absoluteFill}>
            {/* Outer ring */}
            <Circle
              cx={130}
              cy={130}
              r={128}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={1}
              fill="rgba(255, 255, 255, 0.03)"
            />
            {/* Inner ring */}
            <Circle
              cx={130}
              cy={130}
              r={118}
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth={1}
              fill="rgba(255, 255, 255, 0.02)"
            />
          </Svg>

          <Animated.View style={[styles.playerArtworkImage, rotatedArtworkStyle, { overflow: 'hidden' }]}>
            <MusicCover
              cover={currentTrack.cover}
              style={styles.playerArtworkImageStyle}
              iconSize={64}
              borderRadius={110}
            />
          </Animated.View>
        </View>
      </View>

      {/* Title, Visualizer, Timeline, and Controls Group */}
      <View style={styles.playerControlsGroup}>
        {/* Track Title and Artist */}
        <View style={styles.playerInfoSection}>
          <Text numberOfLines={1} style={styles.playerTrackTitle}>
            {currentTrack.title}
          </Text>
          <Text numberOfLines={1} style={styles.playerTrackArtist}>
            {currentTrack.artist}
          </Text>
        </View>

        {/* Custom Interactive Waveform Timeline Progress & Timestamps */}
        <WaveformTimeline
          isPlaying={isPlaying}
          isPlayerActive={isPlayerActive}
          currentTrack={currentTrack}
          seekTo={seekTo}
        />


        {/* Caching/Downloading Indicator */}
        {isDownloading && (
          <View style={styles.downloadBarContainer}>
            <ActivityIndicator size="small" color={Colors.accent.primary} />
            <Text style={styles.downloadText}>
              Caching audio... {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        {/* Media Transport Controls */}
        <View style={styles.mediaControlsRow}>
          {/* Playback Mode (Cycles: Sequence -> Shuffle -> Repeat All -> Repeat One) */}
          <Pressable onPress={cyclePlaybackMode} style={styles.playerUtilityBtn} hitSlop={12}>
            <View style={styles.playerUtilityIconWrapper}>

              {shuffle ? (
                <Feather
                  name="shuffle"
                  size={20}
                  color={Colors.accent.primary}
                />
              ) : (
                <Feather
                  name="repeat"
                  size={20}
                  color={repeatMode !== 'none' ? Colors.accent.primary : 'rgba(255, 255, 255, 0.4)'}
                />
              )}
              {(!shuffle && repeatMode === 'one') && (
                <View style={styles.repeatOneBadge}>
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Previous */}
          <Pressable onPress={prev} style={styles.playerSkipBtn} hitSlop={12}>
            <Feather name="skip-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Play/Pause */}
          <Pressable
            onPress={isPlaying ? pause : resume}
            style={styles.playerPlayBtn}
          >
            {/* Smooth SVG circle to prevent Android jagged polygon play button bug */}
            <Svg width={72} height={72} style={StyleSheet.absoluteFill}>
              <Circle
                cx={36}
                cy={36}
                r={35.5}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth={1}
                fill="rgba(255, 255, 255, 0.15)"
              />
            </Svg>
            <Feather
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </Pressable>

          {/* Next */}
          <Pressable onPress={next} style={styles.playerSkipBtn} hitSlop={12}>
            <Feather name="skip-forward" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Queue List (Navigates to Track List) */}
          <Pressable 
            onPress={onShowQueue} 
            style={styles.playerUtilityBtn}
            hitSlop={12}
          >
            <Feather
              name="list"
              size={20}
              color="rgba(255, 255, 255, 0.5)"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
});
interface QueueItemProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isDragging: boolean;
  dragY: any;
  onDragStart: (idx: number) => void;
  onDragMove: (dy: number, moveY: number) => void;
  onDragEnd: () => void;
}

const QueueItem = React.memo(({
  track,
  index,
  isCurrent,
  isDragging,
  dragY,
  onDragStart,
  onDragMove,
  onDragEnd,
}: QueueItemProps) => {
  // Use a ref to capture the latest props and index dynamically to prevent PanResponder stale closure bugs
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, index });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd, index };

  const panResponderRef = useRef<any>(null);
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 3,
      onPanResponderGrant: () => {
        callbacksRef.current.onDragStart(callbacksRef.current.index);
      },
      onPanResponderMove: (_, gestureState) => {
        callbacksRef.current.onDragMove(gestureState.dy, gestureState.moveY);
      },
      onPanResponderRelease: () => {
        callbacksRef.current.onDragEnd();
      },
      onPanResponderTerminate: () => {
        callbacksRef.current.onDragEnd();
      },
    });
  }
  const panResponder = panResponderRef.current;

  return (
    <RNAnimated.View
      style={[
        styles.queueItemRow,
        isCurrent && styles.activeQueueItemRow,
        isDragging && {
          transform: [{ translateY: dragY }],
          zIndex: 999,
          backgroundColor: 'rgba(141, 233, 29, 0.12)',
          borderColor: 'rgba(141, 233, 29, 0.25)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        },
      ]}
    >
      <MusicCover cover={track.cover} style={styles.queueItemCover} iconSize={12} borderRadius={6} />
      
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.queueItemTitle, isCurrent && styles.activeQueueItemText]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.queueItemArtist}>
          {track.artist}
        </Text>
      </View>

      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.queueItemDragHandle}>
        <Feather name="menu" size={18} color={isDragging ? Colors.accent.primary : 'rgba(255, 255, 255, 0.4)'} />
      </View>
    </RNAnimated.View>
  );
});
QueueItem.displayName = 'QueueItem';

const QueuePopup = React.memo(({ onClose }: { onClose: () => void }) => {
  const { queue, currentTrack, currentIndex, setQueue } = useMusic();
  
  const [localQueue, setLocalQueue] = useState<{ track: Track; key: string }[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const listContainerRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const initialScrollOffsetRef = useRef(0);
  const dragParamsRef = useRef({ dy: 0, moveY: 0 });
  const listMeasureRef = useRef({ pageY: 0, height: 400 });
  const autoScrollTimerRef = useRef<any>(null);
  
  const stateRef = useRef({ localQueue, draggedIndex, currentIndex, currentTrack });
  stateRef.current = { localQueue, draggedIndex, currentIndex, currentTrack };

  // Sync queue to local state (only when not dragging)
  useEffect(() => {
    if (draggedIndex === null) {
      setLocalQueue(queue.map((track, idx) => ({
        track,
        key: `${track.id}_${idx}`
      })));
    }
  }, [queue, draggedIndex]);

  const measureList = useCallback(() => {
    listContainerRef.current?.measure((x, y, width, height, pageX, pageY) => {
      if (height && pageY) {
        listMeasureRef.current = { pageY, height };
      }
    });
  }, []);

  // Scroll to current track on open
  useEffect(() => {
    if (currentTrack && localQueue.length > 0) {
      const currentIdx = localQueue.findIndex(item => item.track.id === currentTrack.id);
      if (currentIdx > 2) {
        // Slight delay to let FlatList measure
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: Math.max(0, currentIdx - 1),
            animated: true,
            viewPosition: 0,
          });
        }, 150);
      }
    }
    setTimeout(measureList, 300);
    return () => {
      autoScrollTimerRef.current = null;
    };
  }, [measureList]);

  const dragYVal = useRef(new RNAnimated.Value(0)).current;
  const dragOffsetRef = useRef(0);

  const handleScroll = useCallback((event: any) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const calculateSpeed = useCallback(() => {
    const { moveY } = dragParamsRef.current;
    const { pageY, height } = listMeasureRef.current;
    if (!height || !pageY) return 0;

    const topScrollZone = pageY + 60;
    const bottomScrollZone = pageY + height - 60;

    if (moveY < topScrollZone) {
      return -Math.min(12, Math.max(2, ((topScrollZone - moveY) / 60) * 12));
    } else if (moveY > bottomScrollZone) {
      return Math.min(12, Math.max(2, ((moveY - bottomScrollZone) / 60) * 12));
    }
    return 0;
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
    dragYVal.setValue(0);
    dragOffsetRef.current = 0;
    initialScrollOffsetRef.current = scrollOffsetRef.current;
    measureList();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dragYVal, measureList]);

  const handleDragMove = useCallback((dy: number, moveY: number) => {
    dragParamsRef.current = { dy, moveY };

    const { draggedIndex: activeIdx, localQueue: activeQueue } = stateRef.current;
    if (activeIdx === null) return;
    
    const itemHeight = 64;
    const swapThreshold = itemHeight * 0.55;
    
    const scrollDelta = scrollOffsetRef.current - initialScrollOffsetRef.current;
    const relativeDy = dy + scrollDelta;
    const currentDisplacement = relativeDy - dragOffsetRef.current;
    dragYVal.setValue(currentDisplacement);

    if (currentDisplacement > swapThreshold && activeIdx < activeQueue.length - 1) {
      const nextIdx = activeIdx + 1;
      const updated = [...activeQueue];
      [updated[activeIdx], updated[nextIdx]] = [updated[nextIdx], updated[activeIdx]];

      stateRef.current.localQueue = updated;
      stateRef.current.draggedIndex = nextIdx;

      LayoutAnimation.configureNext({
        duration: 180,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setLocalQueue(updated);
      setDraggedIndex(nextIdx);
      dragOffsetRef.current += itemHeight;
      dragYVal.setValue(currentDisplacement - itemHeight);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (currentDisplacement < -swapThreshold && activeIdx > 0) {
      const prevIdx = activeIdx - 1;
      const updated = [...activeQueue];
      [updated[activeIdx], updated[prevIdx]] = [updated[prevIdx], updated[activeIdx]];

      stateRef.current.localQueue = updated;
      stateRef.current.draggedIndex = prevIdx;

      LayoutAnimation.configureNext({
        duration: 180,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setLocalQueue(updated);
      setDraggedIndex(prevIdx);
      dragOffsetRef.current -= itemHeight;
      dragYVal.setValue(currentDisplacement + itemHeight);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    checkAutoScroll(moveY);
  }, [dragYVal]);

  const checkAutoScroll = useCallback((moveY: number) => {
    const speed = calculateSpeed();
    if (speed !== 0) {
      if (!autoScrollTimerRef.current) {
        autoScrollTimerRef.current = true;
        const runScroll = () => {
          if (!autoScrollTimerRef.current) return;
          
          const currentSpeed = calculateSpeed();
          if (currentSpeed === 0) {
            autoScrollTimerRef.current = null;
            return;
          }

          const newOffset = Math.max(0, scrollOffsetRef.current + currentSpeed);
          flatListRef.current?.scrollToOffset({ offset: newOffset, animated: false });
          
          const { dy, moveY: currentMoveY } = dragParamsRef.current;
          handleDragMove(dy, currentMoveY);

          requestAnimationFrame(runScroll);
        };
        requestAnimationFrame(runScroll);
      }
    } else {
      autoScrollTimerRef.current = null;
    }
  }, [calculateSpeed, handleDragMove]);

  const handleDragEnd = useCallback(() => {
    autoScrollTimerRef.current = null;
    setDraggedIndex(null);
    
    // Smooth spring settle
    RNAnimated.spring(dragYVal, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
    
    dragOffsetRef.current = 0;
    
    const syncedTracks = stateRef.current.localQueue.map(item => item.track);
    let newIndex = 0;
    if (currentTrack) {
      newIndex = syncedTracks.findIndex(t => t.id === currentTrack.id);
    }
    setQueue(syncedTracks, newIndex === -1 ? 0 : newIndex);
  }, [dragYVal, currentTrack, setQueue]);

  const renderItem = useCallback(({ item, index: idx }: { item: { track: Track; key: string }; index: number }) => {
    const isCurrent = currentTrack?.id === item.track.id;
    const isDragging = idx === draggedIndex;
    
    return (
      <QueueItem
        track={item.track}
        index={idx}
        isCurrent={isCurrent}
        isDragging={isDragging}
        dragY={dragYVal}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
    );
  }, [currentTrack?.id, draggedIndex, dragYVal, handleDragStart, handleDragMove, handleDragEnd]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 64,
    offset: 64 * index + 12, // 12 = padding
    index,
  }), []);

  return (
    <View style={styles.queuePopupBackdropOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={styles.queueBackdropBg} />
      </Pressable>

      <View style={styles.queueSheetContainer} pointerEvents="box-none">
        <GlassCard intensity="strong" padding="none" style={styles.queuePopupContent}>
          <View style={styles.menuSelectorHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Feather name="list" size={18} color={Colors.accent.primary} />
              <Text style={styles.menuTitleText}>Play Queue</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: FontSizes.tiny + 1, color: 'rgba(255,255,255,0.4)' }}>
                {localQueue.length} {localQueue.length === 1 ? 'track' : 'tracks'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} style={styles.menuSelectorCloseBtn}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>
          </View>
          
          <View style={styles.menuDivider} />

          {localQueue.length === 0 ? (
            <View style={styles.queueEmptyContainer}>
              <Feather name="music" size={32} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: Spacing.sm }} />
              <Text style={styles.queueEmptyText}>Queue is empty</Text>
              <Text style={[styles.queueEmptyText, { fontSize: FontSizes.tiny, marginTop: 4 }]}>Play a song to build your queue</Text>
            </View>
          ) : (
            <View ref={listContainerRef} style={{ flex: 1 }} collapsable={false}>
              <FlatList
                ref={flatListRef}
                data={localQueue}
                keyExtractor={(item) => item.key}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                style={styles.queueList}
                showsVerticalScrollIndicator={false}
                scrollEnabled={draggedIndex === null}
                contentContainerStyle={styles.queueListContent}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={5}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={() => {}}
              />
            </View>
          )}
        </GlassCard>
      </View>
    </View>
  );
});

QueuePopup.displayName = 'QueuePopup';

const SettingsPopup = React.memo(({
  onClose,
  cacheSize,
  clearCache,
}: {
  onClose: () => void;
  cacheSize: number;
  clearCache: () => void;
}) => {
  const handleClearCache = useCallback(() => {
    clearCache();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearCache]);

  return (
    <View style={styles.queuePopupBackdropOverlay}>
      {/* Sibling Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={styles.queueBackdropBg} />
      </Pressable>

      {/* Sheet Container */}
      <View style={styles.queueSheetContainer} pointerEvents="box-none">
        <GlassCard intensity="strong" padding="none" style={styles.queuePopupContent}>
          <View style={styles.menuSelectorHeader}>
            <Text style={styles.menuTitleText}>Music Settings</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.menuSelectorCloseBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
          
          <View style={styles.menuDivider} />

          <View style={styles.settingsBody}>
            {/* Cache row */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowLeft}>
                <Feather name="database" size={18} color="rgba(255,255,255,0.7)" />
                <View style={styles.settingsLabelWrapper}>
                  <Text style={styles.settingsLabel}>Cache Size</Text>
                  <Text style={styles.settingsDesc}>Stored songs cache size: {cacheSize} MB</Text>
                </View>
              </View>
              {cacheSize > 0 ? (
                <Pressable style={styles.settingsBtn} onPress={handleClearCache}>
                  <Text style={styles.settingsBtnText}>Clear Cache</Text>
                </Pressable>
              ) : (
                <Text style={styles.settingsMutedText}>Clean</Text>
              )}
            </View>
          </View>
        </GlassCard>
      </View>
    </View>
  );
});

SettingsPopup.displayName = 'SettingsPopup';


export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, Spacing.lg);

  const {
    currentTrack,
    play,
    setQueue,
    addToQueue,
    favorites,
    toggleFavorite,
    playlists,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    cacheSize,
    clearCache,
  } = useMusic();
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    // Clear any existing toast timer
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setToastType(type);
    toastOpacity.setValue(0);
    RNAnimated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimeoutRef.current = setTimeout(() => {
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setToastMessage(null);
      });
    }, 2000);
  }, [toastOpacity]);

  // Modal / Options Menu internal states
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined);

  const handleMorePress = useCallback((track: Track, fromPlaylistId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuTrack(track);
    setActivePlaylistId(fromPlaylistId);
    setShowMenu(true);
  }, []);

  // Internal navigation state
  const [view, setView] = useState<'categories' | 'list' | 'player'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string>('midnight');
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string>('Midnight Vibes');

  // New states for popup modals
  const [showQueuePopup, setShowQueuePopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<'default' | 'titleAsc' | 'titleDesc' | 'dateNewest' | 'dateOldest'>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const viewIndex = useSharedValue(0);

  // State representing the active view (only updates after transition completes, or instantly on exit)
  const [activeView, setActiveView] = useState<'categories' | 'list' | 'player'>('categories');

  useEffect(() => {
    let target = 0;
    if (view === 'categories') target = 0;
    else if (view === 'list') target = 1;
    else if (view === 'player') target = 2;

    // Immediately update activeView to non-player if leaving the player to stop animations instantly
    if (view !== 'player') {
      setActiveView(view);
    }

    viewIndex.value = withSpring(target, {
      damping: 20,
      stiffness: 110,
      mass: 0.9,
    }, (finished) => {
      if (finished) {
        runOnJS(setActiveView)(view);
      }
    });
  }, [view]);

  const categoriesStyle = useAnimatedStyle(() => {
    const translateX = -viewIndex.value * SCREEN_WIDTH;
    const opacity = 1 - Math.min(1, Math.max(0, viewIndex.value));
    return {
      transform: [{ translateX }],
      opacity,
      position: 'absolute',
      top: paddingTop,
      left: SCREEN_PADDING,
      right: SCREEN_PADDING,
      bottom: 0,
      display: viewIndex.value >= 1 ? 'none' : 'flex',
    };
  });

  const listStyle = useAnimatedStyle(() => {
    const translateX = (1 - viewIndex.value) * SCREEN_WIDTH;
    const scale = viewIndex.value > 1 ? 1 - (viewIndex.value - 1) * 0.05 : 1;
    const opacity = viewIndex.value <= 1 ? viewIndex.value : 2 - viewIndex.value;
    return {
      transform: [{ translateX }, { scale }],
      opacity,
      position: 'absolute',
      top: paddingTop,
      left: SCREEN_PADDING,
      right: SCREEN_PADDING,
      bottom: 0,
      display: (viewIndex.value <= 0 || viewIndex.value >= 2) ? 'none' : 'flex',
    };
  });

  const playerStyle = useAnimatedStyle(() => {
    const translateY = (2 - viewIndex.value) * SCREEN_HEIGHT;
    return {
      transform: [{ translateY }],
      position: 'absolute',
      top: paddingTop,
      left: SCREEN_PADDING,
      right: SCREEN_PADDING,
      bottom: 0,
      zIndex: 10,
      display: viewIndex.value <= 1 ? 'none' : 'flex',
    };
  });

  const playerBgStyle = useAnimatedStyle(() => {
    const opacity = viewIndex.value >= 1 ? viewIndex.value - 1 : 0;
    return {
      opacity,
      display: opacity === 0 ? 'none' : 'flex',
    };
  });

  const miniPlayerStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, viewIndex.value - 1));
    const opacity = 1 - progress;
    const translateY = progress * 100;
    return {
      opacity,
      transform: [{ translateY }],
      display: opacity === 0 ? 'none' : 'flex',
    };
  });

  // Intercept Android hardware back button and swipe-back gestures
  useEffect(() => {
    const onBackPress = () => {
      if (view === 'player') {
        setView('list');
        return true;
      } else if (view === 'list') {
        setView('categories');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [view]);


  const handleCategoryPress = useCallback((cat: string, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    setActiveCategoryLabel(label);
    setView('list');
  }, []);

  const handleTrackPress = useCallback((track: Track, tracksInCat: Track[]) => {
    const idx = tracksInCat.findIndex(t => t.id === track.id);
    const slicedTracks = idx !== -1 ? tracksInCat.slice(idx) : [track];
    setQueue(slicedTracks, 0);
    play(track);
    setView('player');
  }, [play, setQueue]);

  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (view === 'player') {
      setView('list');
    } else if (view === 'list') {
      setView('categories');
    } else {
      router.back();
    }
  }, [view]);

  const handleShowQueue = useCallback(() => {
    setShowQueuePopup(true);
  }, []);

  const handleShowSettings = useCallback(() => {
    setShowSettingsPopup(true);
  }, []);

  const handleMiniPlayerPress = useCallback(() => {
    setView('player');
  }, []);

  return (
    <GradientBackground variant="glow">
      <Animated.View style={[StyleSheet.absoluteFill, playerBgStyle]} pointerEvents="none">
        <PlayerBackground />
      </Animated.View>
      <View style={[styles.mainContainer, { paddingTop }]}>
        <Animated.View style={categoriesStyle} pointerEvents={view === 'categories' ? 'auto' : 'none'}>
          <CategoriesView
            onCategoryPress={handleCategoryPress}
            onSettingsPress={handleShowSettings}
          />
        </Animated.View>
        <Animated.View style={listStyle} pointerEvents={view === 'list' ? 'auto' : 'none'}>
          <ListView
            category={selectedCategory}
            categoryLabel={activeCategoryLabel}
            onGoBack={handleGoBack}
            onTrackPress={handleTrackPress}
            onMorePress={handleMorePress}
            sortBy={sortBy}
            setShowSortMenu={setShowSortMenu}
          />
        </Animated.View>
        <Animated.View style={playerStyle} pointerEvents={view === 'player' ? 'auto' : 'none'}>
          <PlayerView
            onGoBack={handleGoBack}
            onShowQueue={handleShowQueue}
            isPlayerActive={view === 'player' && activeView === 'player' && !showQueuePopup}
          />
        </Animated.View>
      </View>
      {currentTrack && (
        <Animated.View 
          pointerEvents={view === 'player' ? 'none' : 'auto'}
          style={[
            {
              position: 'absolute',
              bottom: Math.max(insets.bottom, 16),
              left: 14,
              right: 14,
              zIndex: 99,
            },
            miniPlayerStyle
          ]}
        >
          <FloatingMiniPlayer
            onPress={handleMiniPlayerPress}
            style={styles.miniPlayerContainerStyle}
          />
        </Animated.View>
      )}

      {/* 1. Track Action Options Menu Backdrop Overlay */}
      {showMenu && menuTrack && (
        <View style={styles.menuBackdrop}>
          {/* Backdrop touch area */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)} />
          
          {/* Menu content */}
          <View style={styles.menuContainer} pointerEvents="box-none">
            <GlassCard intensity="strong" padding="none" style={styles.menuContent}>
              {/* Header */}
              <View style={styles.menuHeader}>
                <MusicCover cover={menuTrack.cover} style={styles.menuTrackCover} iconSize={12} borderRadius={10} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.menuTrackTitle}>{menuTrack.title}</Text>
                  <Text numberOfLines={1} style={styles.menuTrackArtist}>{menuTrack.artist}</Text>
                </View>
              </View>
              
              <View style={styles.menuDivider} />

              {/* Add to Queue */}
              <Pressable 
                style={styles.menuOption} 
                onPress={() => {
                  if (currentTrack && currentTrack.category !== menuTrack.category) {
                    setShowMenu(false);
                    showToast('Cannot mix categories in queue', 'warning');
                  } else {
                    addToQueue(menuTrack);
                    setShowMenu(false);
                    showToast('Added to Queue');
                  }
                }}
              >
                <Feather name="plus-circle" size={18} color="#FFF" />
                <Text style={styles.menuOptionText}>Add to Queue</Text>
              </Pressable>

              {/* Add/Remove Favorite */}
              <Pressable 
                style={styles.menuOption} 
                onPress={() => {
                  toggleFavorite(menuTrack.id);
                  setShowMenu(false);
                  const wasFav = favorites.includes(menuTrack.id);
                  showToast(wasFav ? 'Removed from Favourites' : 'Added to Favourites');
                }}
              >
                <Feather 
                  name="heart" 
                  size={18} 
                  color={favorites.includes(menuTrack.id) ? Colors.error : "#FFF"} 
                  fill={favorites.includes(menuTrack.id) ? Colors.error : "transparent"}
                />
                <Text style={styles.menuOptionText}>
                  {favorites.includes(menuTrack.id) ? 'Remove from Favourites' : 'Add to Favourites'}
                </Text>
              </Pressable>

              {/* Add to Playlist */}
              <Pressable 
                style={styles.menuOption} 
                onPress={() => {
                  setShowPlaylistSelector(true);
                }}
              >
                <Feather name="folder-plus" size={18} color="#FFF" />
                <Text style={styles.menuOptionText}>Add to Playlist</Text>
              </Pressable>

              {/* Conditional: Remove from Playlist (only if opened from inside a playlist) */}
              {activePlaylistId !== undefined && (
                <Pressable 
                  style={[styles.menuOption, { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' }]} 
                  onPress={async () => {
                    await removeTrackFromPlaylist(activePlaylistId, menuTrack.id);
                    setShowMenu(false);
                    showToast('Removed from Playlist');
                  }}
                >
                  <Feather name="x-circle" size={18} color={Colors.error} />
                  <Text style={[styles.menuOptionText, { color: Colors.error }]}>Remove from Playlist</Text>
                </Pressable>
              )}
            </GlassCard>
          </View>
        </View>
      )}

      {/* 2. Add To Playlist Selector Overlay */}
      {showPlaylistSelector && menuTrack && (
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPlaylistSelector(false)} />
          <View style={styles.menuContainer} pointerEvents="box-none">
            <GlassCard intensity="strong" padding="none" style={styles.menuContent}>
              <View style={styles.menuSelectorHeader}>
                <Text style={styles.menuTitleText}>Add to Playlist</Text>
                <Pressable onPress={() => setShowPlaylistSelector(false)} hitSlop={8} style={styles.menuSelectorCloseBtn}>
                  <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
              
              <View style={styles.menuDivider} />

              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {playlists.length === 0 ? (
                  <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.body }}>No playlists created yet.</Text>
                  </View>
                ) : (
                  playlists.map(pl => (
                    <Pressable
                      key={pl.id}
                      style={styles.playlistSelectorOption}
                      onPress={async () => {
                        await addTrackToPlaylist(pl.id, menuTrack);
                        setShowPlaylistSelector(false);
                        setShowMenu(false);
                        showToast(`Added to "${pl.name}"`);
                      }}
                    >
                      <Feather name="folder" size={16} color={Colors.accent.primary} />
                      <Text numberOfLines={1} style={styles.playlistSelectorText}>{pl.name}</Text>
                      <Text style={styles.playlistSelectorCount}>{pl.tracks.length} songs</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>

              <View style={styles.menuDivider} />

              {/* Create New Playlist option */}
              <Pressable 
                style={styles.menuOption} 
                onPress={() => {
                  setShowCreatePlaylistModal(true);
                }}
              >
                <Feather name="plus" size={18} color={Colors.accent.primary} />
                <Text style={[styles.menuOptionText, { color: Colors.accent.primary }]}>Create New Playlist</Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      )}

      {/* 3. Create Playlist Text Prompt Modal Overlay */}
      {showCreatePlaylistModal && (
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreatePlaylistModal(false)} />
          <View style={styles.menuContainer} pointerEvents="box-none">
            <GlassCard intensity="strong" padding="md" style={styles.playlistCreateContent}>
              <Text style={styles.createPlaylistTitle}>Create Playlist</Text>
              
              <TextInput
                style={styles.createPlaylistInput}
                placeholder="Playlist name..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
                maxLength={30}
              />

              <View style={styles.createPlaylistButtons}>
                <Pressable 
                  style={styles.createBtnCancel} 
                  onPress={() => {
                    setShowCreatePlaylistModal(false);
                    setNewPlaylistName('');
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.bodySemiBold }}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  style={styles.createBtnConfirm} 
                  onPress={async () => {
                    if (newPlaylistName.trim()) {
                      await createPlaylist(newPlaylistName.trim());
                      setShowCreatePlaylistModal(false);
                      setNewPlaylistName('');
                      showToast(`Playlist "${newPlaylistName.trim()}" created`);
                    }
                  }}
                >
                  <Text style={{ color: '#0A0A0C', fontFamily: Fonts.bodyBold }}>Create</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </View>
      )}
      {/* 4. Play Queue Popup Overlay */}
      {showQueuePopup && (
        <QueuePopup onClose={() => setShowQueuePopup(false)} />
      )}
      {/* 5. Music Settings Popup Overlay */}
      {showSettingsPopup && (
        <SettingsPopup
          onClose={() => setShowSettingsPopup(false)}
          cacheSize={cacheSize}
          clearCache={clearCache}
        />
      )}
      {/* 6. Sort Overlay Bottom Sheet */}
      {showSortMenu && (
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSortMenu(false)} />
          <View style={styles.menuContainer} pointerEvents="box-none">
            <GlassCard intensity="strong" padding="none" style={styles.menuContent}>
              <View style={styles.menuSelectorHeader}>
                <Text style={styles.menuTitleText}>Sort Tracks By</Text>
                <Pressable onPress={() => setShowSortMenu(false)} hitSlop={8} style={styles.menuSelectorCloseBtn}>
                  <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
              
              <View style={styles.menuDivider} />

              <Pressable 
                style={[styles.menuOption, sortBy === 'default' && { backgroundColor: 'rgba(141, 233, 29, 0.08)' }]} 
                onPress={() => {
                  setSortBy('default');
                  setShowSortMenu(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="list" size={18} color={sortBy === 'default' ? Colors.accent.primary : "#FFF"} />
                <Text style={[styles.menuOptionText, sortBy === 'default' && { color: Colors.accent.primary }]}>Default Order</Text>
              </Pressable>

              <Pressable 
                style={[styles.menuOption, sortBy === 'titleAsc' && { backgroundColor: 'rgba(141, 233, 29, 0.08)' }]} 
                onPress={() => {
                  setSortBy('titleAsc');
                  setShowSortMenu(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="arrow-up" size={18} color={sortBy === 'titleAsc' ? Colors.accent.primary : "#FFF"} />
                <Text style={[styles.menuOptionText, sortBy === 'titleAsc' && { color: Colors.accent.primary }]}>Alphabetical (A - Z)</Text>
              </Pressable>

              <Pressable 
                style={[styles.menuOption, sortBy === 'titleDesc' && { backgroundColor: 'rgba(141, 233, 29, 0.08)' }]} 
                onPress={() => {
                  setSortBy('titleDesc');
                  setShowSortMenu(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="arrow-down" size={18} color={sortBy === 'titleDesc' ? Colors.accent.primary : "#FFF"} />
                <Text style={[styles.menuOptionText, sortBy === 'titleDesc' && { color: Colors.accent.primary }]}>Alphabetical (Z - A)</Text>
              </Pressable>

              <Pressable 
                style={[styles.menuOption, sortBy === 'dateNewest' && { backgroundColor: 'rgba(141, 233, 29, 0.08)' }]} 
                onPress={() => {
                  setSortBy('dateNewest');
                  setShowSortMenu(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="calendar" size={18} color={sortBy === 'dateNewest' ? Colors.accent.primary : "#FFF"} />
                <Text style={[styles.menuOptionText, sortBy === 'dateNewest' && { color: Colors.accent.primary }]}>Date Added (Newest First)</Text>
              </Pressable>

              <Pressable 
                style={[styles.menuOption, sortBy === 'dateOldest' && { backgroundColor: 'rgba(141, 233, 29, 0.08)' }]} 
                onPress={() => {
                  setSortBy('dateOldest');
                  setShowSortMenu(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="calendar" size={18} color={sortBy === 'dateOldest' ? Colors.accent.primary : "#FFF"} />
                <Text style={[styles.menuOptionText, sortBy === 'dateOldest' && { color: Colors.accent.primary }]}>Date Added (Oldest First)</Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      )}
      {/* Toast Notification Pill */}
      {toastMessage && (
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 120,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 99999,
            opacity: toastOpacity,
          }}
        >
          <View style={{
            backgroundColor: 'rgba(30, 30, 36, 0.95)',
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: toastType === 'error' 
              ? 'rgba(255, 107, 107, 0.25)' 
              : toastType === 'warning' 
              ? 'rgba(255, 190, 106, 0.25)' 
              : 'rgba(141, 233, 29, 0.25)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}>
            <Feather 
              name={toastType === 'success' ? "check-circle" : "alert-circle"} 
              size={14} 
              color={toastType === 'error' 
                ? Colors.error 
                : toastType === 'warning' 
                ? Colors.warning 
                : Colors.accent.primary} 
            />
            <Text style={{ color: '#FFFFFF', fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.caption }}>
              {toastMessage}
            </Text>
          </View>
        </RNAnimated.View>
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  scrollContent: {
    paddingBottom: 160, // Avoid bottom player overlapping
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
  },

  // Categories View Styles (Page 1)
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarOutline: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E24',
  },
  greetingTextContainer: {
    justifyContent: 'center',
  },
  greetLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greetName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3 - 2,
    color: Colors.text.primary,
  },
  headerActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cache Management styling
  cacheCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cacheText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  clearCacheBtn: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clearCacheText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny + 1,
    color: Colors.accent.primary,
  },

  filterScroll: {
    marginVertical: Spacing.md,
    maxHeight: 40,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
  },
  activeFilterChip: {
    backgroundColor: '#8DE91D',
    borderColor: '#8DE91D',
  },
  filterChipText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  activeFilterChipText: {
    fontFamily: Fonts.bodyBold,
    color: '#03070E',
  },

  bentoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  bentoColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: Spacing.md,
  },
  bentoCard: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  bentoImage: {
    width: '100%',
    height: '100%',
  },
  bentoGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(10, 10, 12, 0.4)',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  bentoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bentoBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 1,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  bentoFooter: {
    gap: 2,
  },
  bentoTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  bentoSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: Colors.text.secondary,
  },

  // Category List View Styles (Page 2)
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
    position: 'relative',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3 - 2,
    color: Colors.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  absoluteTitleContainer: {
    position: 'absolute',
    left: 96,
    right: 96,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  navigationTitleText: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3 - 2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  listFilterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  listFilterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  activeListFilterChip: {
    backgroundColor: '#8DE91D',
    borderColor: '#8DE91D',
  },
  listFilterText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  activeListFilterText: {
    fontFamily: Fonts.bodyBold,
    color: '#03070E',
  },
  listScroll: {
    paddingBottom: 180,
    gap: Spacing.sm,
  },
  trackItem: {
    height: 68, // Hardcoded height for FlatList getItemLayout optimization
    borderRadius: Radius.lg,
  },
  trackItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: Spacing.md,
  },
  activeTrackItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.elevated,
    marginRight: Spacing.md,
  },
  trackDetails: {
    flex: 1,
  },
  trackName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  activeTrackText: {
    color: Colors.accent.primary,
  },
  trackArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  trackDuration: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  trackMoreBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    marginTop: Spacing.md,
    fontFamily: Fonts.body,
    color: Colors.text.secondary,
  },

  // Permission layout
  permissionTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  permissionDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.primary,
  },
  permissionBtnText: {
    fontFamily: Fonts.bodySemiBold,
    color: '#0A0A0C',
  },
  emptyTracksTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyTracksDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Player View Styles (Page 3)
  playerArtworkSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  playerArtworkImage: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#1E1E24',
  },
  playerInfoSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  playerTrackTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2 - 2,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  playerTrackArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Waveform Visualizer
  waveformContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },

  // Timeline
  timeLabelRowContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  timeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  timeLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    width: 50,
    flexShrink: 0,
    flexGrow: 0,
  },

  downloadBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  downloadText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },

  // Player transport buttons
  mediaControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  playerPlayBtn: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  playerSkipBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerUtilityBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerOrb: {
    position: 'absolute',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    paddingVertical: 8,
  },
  bentoBgIcon: {
    position: 'absolute',
    right: -10,
    top: -10,
    opacity: 0.7,
  },

  // Modal Backdrops & Overlays
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingBottom: 40,
  },
  menuContent: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuTrackCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1E1E24',
  },
  menuTrackTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  menuTrackArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  menuOptionText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
  },
  menuSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  menuTitleText: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
  },
  menuSelectorCloseBtn: {
    padding: 4,
  },
  playlistSelectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  playlistSelectorText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall + 1,
    color: '#FFFFFF',
    flex: 1,
  },
  playlistSelectorCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  // Create Playlist Modal
  playlistCreateContent: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    width: '100%',
  },
  createPlaylistTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3 - 2,
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  createPlaylistInput: {
    width: '100%',
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall + 1,
    marginBottom: Spacing.lg,
  },
  createPlaylistButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  createBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnConfirm: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Playlist View Rows
  createPlaylistRowBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.md,
  },
  createPlaylistInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  createPlaylistRowText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall + 1,
    color: Colors.accent.primary,
  },
  inlineCreateCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  playlistItemCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.sm,
  },
  playlistItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  playlistIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistItemName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  playlistItemCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  playlistDeleteBtn: {
    padding: 8,
  },
  // Playlist Details Header inside list
  playlistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  playlistBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  playlistBackText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
  },
  playlistTitleLabel: {
    flex: 1,
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  playlistPlayAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  playlistPlayAllText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: '#0A0A0C',
  },
  // Play Queue popup styles
  queuePopupContent: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    width: '100%',
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.md,
    height: 56,
  },
  activeQueueItemRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  queueItemCover: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#1E1E24',
  },
  queueItemTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  activeQueueItemText: {
    color: Colors.accent.primary,
  },
  queueItemArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  queueItemDragHandle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneBadge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    backgroundColor: Colors.accent.primary,
    borderRadius: 5,
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneText: {
    fontSize: 7,
    fontFamily: Fonts.bodyBold,
    color: '#000000',
    lineHeight: 8,
  },
  waveformTimelineContainer: {
    gap: Spacing.md,
  },
  miniPlayerContainerStyle: {
    bottom: 0,
    left: 0,
    right: 0,
    position: 'relative',
  },
  queuePopupBackdropOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  queueBackdropBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  queueSheetContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  queueEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  queueEmptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: Fonts.body,
  },
  queueList: {
    maxHeight: 400,
  },
  queueListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  playerArtworkWrapper: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerArtworkImageStyle: {
    width: '100%',
    height: '100%',
  },
  playerControlsGroup: {
    gap: Spacing.md,
    marginBottom: 16,
  },
  playerUtilityIconWrapper: {
    position: 'relative',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
  },
  settingsBody: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  settingsLabelWrapper: {
    flex: 1,
  },
  settingsLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
  },
  settingsDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  settingsBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.primary,
  },
  settingsMutedText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  progressBarWrapper: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#8DE91D',
  },
  progressBarThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8DE91D',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  songPointerWrapper: {
    position: 'absolute',
    left: '50%',
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  songPointerBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 30, 36, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
    borderRadius: 22,
    overflow: 'hidden',
  },
});
