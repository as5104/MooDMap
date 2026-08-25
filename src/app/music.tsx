/**
 * MoodMap - Music Hub
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  Animated as RNAnimated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { FloatingMiniPlayer } from '../components/music/FloatingMiniPlayer';
import { MusicCover } from '../components/music/MusicCover';
import { AnimatedPressable, GlassCard, GradientBackground } from '../components/ui';
import { useBlurTarget } from '../components/ui/GradientBackground';
import { Colors } from '../constants/colors';
import { Radius, SCREEN_PADDING, Spacing } from '../constants/layout';
import { Fonts, FontSizes } from '../constants/typography';
import { Playlist, Track, TRACKS_LIBRARY, useMusic, usePlaybackTime } from '../context/MusicContext';
import { useSpotify } from '../hooks/useSpotify';
import { getSmartRecommendations, MOOD_GENRE_MAP } from '../services/recommendationEngine';
import { formatDuration as spotifyFormatDur, getBestImage as spotifyGetBestImage } from '../services/spotify';
import { useAppStore } from '../stores/appStore';
import { useTierStore } from '../stores/tierStore';
import { isTrackComfort } from '../services/comfortBoxService';
import { AddToSpotifyPlaylistModal, type SpotifyTrackTarget } from '../components/music/AddToSpotifyPlaylistModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



// dynamic color mappings for each mood category
const CATEGORY_COLORS: Record<string, { primary: string, secondary: string, glow: string, backgroundGradColors: [string, string, string] }> = {
  midnight: {
    primary: '#A855F7', // Vibrant Purple
    secondary: '#2E1065',
    glow: 'rgba(168, 85, 247, 0.7)',
    backgroundGradColors: ['#3B0764', '#1E1B4B', '#03070E'],
  },
  chill: {
    primary: '#06B6D4', // Vibrant Cyan/Teal
    secondary: '#083344',
    glow: 'rgba(6, 182, 212, 0.7)',
    backgroundGradColors: ['#0A424F', '#0F2A38', '#03070E'],
  },
  energy: {
    primary: '#F97316', // Vibrant Orange/Rose
    secondary: '#7C2D12',
    glow: 'rgba(249, 115, 22, 0.7)',
    backgroundGradColors: ['#4C1D95', '#6B1B62', '#03070E'],
  },
  heartbeat: {
    primary: '#EF4444', // Vibrant Coral Red
    secondary: '#7F1D1D',
    glow: 'rgba(239, 68, 68, 0.7)',
    backgroundGradColors: ['#5C0A0A', '#1E1B4B', '#03070E'],
  },
  ambient: {
    primary: '#10B981', // Lush Emerald Green
    secondary: '#064E3B',
    glow: 'rgba(10, 185, 129, 0.7)',
    backgroundGradColors: ['#023629', '#0F213A', '#03070E'],
  },
};

// Generate unique premium music color schemes dynamically from track ID
const getTrackColorPalette = (track?: Track | null) => {
  if (!track) {
    return {
      primary: '#1DB954',
      secondary: '#121212',
      glow: 'rgba(29, 185, 84, 0.5)',
      backgroundGradColors: ['#0D9488', '#0F5A47', '#03070E'] as [string, string, string],
    };
  }

  // If it's a local category track with a known color mapping
  const category = track.category;
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }

  // Otherwise, hash the track ID to generate a vibrant color palette
  const seedString = track.id || track.title || 'default';
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;

  // HSL values very vibrant and bright so they pop through the dark blur
  const primaryColor = `hsl(${hue}, 85%, 50%)`;
  const secondaryColor = `hsl(${(hue + 180) % 360}, 60%, 20%)`;
  const primaryGlow = `hsla(${hue}, 90%, 55%, 0.65)`;
  const backgroundGradColors = [
    `hsl(${hue}, 75%, 20%)`, // Vibrant base primary
    `hsl(${(hue + 45) % 360}, 70%, 14%)`, // Adjacent blend
    '#03070E' // Solid dark base
  ] as [string, string, string];

  return {
    primary: primaryColor,
    secondary: secondaryColor,
    glow: primaryGlow,
    backgroundGradColors,
  };
};

const PlayerBackground = React.memo(({ currentTrack }: { currentTrack: Track | null }) => {
  const blurCtx = useBlurTarget();
  const isAndroid = Platform.OS === 'android';
  const ready = blurCtx?.ready ?? false;

  const palette = useMemo(() => getTrackColorPalette(currentTrack), [currentTrack]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dynamic ambient mesh gradient matching the current song */}
      <LinearGradient
        colors={palette.backgroundGradColors}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Dynamic glowing orbs in matching colors */}
      <View style={StyleSheet.absoluteFill}>
        {/* Top-right vibrant matching orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 380,
            height: 380,
            borderRadius: 190,
            backgroundColor: palette.glow,
            top: -60,
            right: -60,
          }
        ]} />

        {/* Bottom-left vibrant matching orb */}
        <View style={[
          styles.playerOrb,
          {
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: `hsla(${(parseFloat(palette.glow.match(/\d+/)?.[0] ?? '0') + 120) % 360}, 75%, 50%, 0.35)`,
            bottom: -90,
            left: -30,
          }
        ]} />
      </View>

      {/* Full screen Blur — slightly lower intensity so colors are extremely visible */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={85}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : ready ? (
        <BlurView
          intensity={45}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurReductionFactor={2}
          blurTarget={blurCtx!.ref}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 20, 15, 0.85)' }]} />
      )}

      {/* Semi-transparent overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3, 7, 14, 0.18)' }]} />
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
    let active = true;

    const animate = () => {
      if (!isPlaying || !active) return;
      // Actual music visualizer bounce target (30% to 120% of base height)
      const targetHeight = baseHeight * (0.3 + Math.random() * 0.9);
      // Slower bounce duration (400ms to 700ms) to eliminate high-frequency noise
      const duration = 400 + Math.random() * 300;

      height.value = withTiming(
        targetHeight,
        {
          duration,
          easing: Easing.inOut(Easing.quad),
        },
        (finished) => {
          if (finished && active && isPlaying) {
            runOnJS(animate)();
          }
        }
      );
    };

    if (isPlaying) {
      animate();
    } else {
      height.value = withTiming(baseHeight, { duration: 300 });
    }

    return () => {
      active = false;
    };
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
      disablePressAnimation
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
  onTrackPress,
  onOpenRecommended,
}: {
  onCategoryPress: (slug: string, label: string) => void;
  onSettingsPress: () => void;
  onTrackPress: (track: Track, tracks: Track[]) => void;
  onOpenRecommended: () => void;
}) => {
  const isVIP = useTierStore((s) => s.isVIP);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'local' | 'spotify' | 'curated'>('all');
  const { isConnected: spotifyConnected, getVIPRecommendations, connect: connectSpotify, isConnecting: isSpotifyConnecting } = useSpotify();
  const todayMood = useAppStore((s) => s.todayMood);
  const user = useAppStore((s) => s.user);
  const moodRecommendationSession = useAppStore((s) => s.moodRecommendationSession);
  const setMoodRecommendationSession = useAppStore((s) => s.setMoodRecommendationSession);

  const [moodRecs, setMoodRecs] = useState<any[]>([]);
  const [isRefreshingMoodRecs, setIsRefreshingMoodRecs] = useState(false);
  const [moodRefreshCycle, setMoodRefreshCycle] = useState(0);

  useEffect(() => {
    if (!todayMood) {
      setMoodRecs([]);
      return;
    }

    const moodKey = `${user?.id ?? 'guest'}:${todayMood.id}`;
    const forceFresh = moodRefreshCycle > 0;
    if (!forceFresh && moodRecommendationSession?.key === moodKey && moodRecommendationSession.tracks.length > 0) {
      setMoodRecs(moodRecommendationSession.tracks);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const options = forceFresh ? {
          excludeTrackIds: moodRecommendationSession?.key === moodKey
            ? moodRecommendationSession.seenTrackIds
            : [],
          refreshSeed: Date.now(),
          previousArtistNames: moodRecommendationSession?.sampledArtistNames || [],
        } : {
          previousArtistNames: moodRecommendationSession?.sampledArtistNames || [],
        };
        const vipRecs = await getVIPRecommendations(
          todayMood.moodType as any,
          todayMood.moodScore ?? 7,
          20,
          options,
        );
        if (isMounted && vipRecs && vipRecs.length > 0) {
          const artistsFromRecs = Array.from(new Set(vipRecs.map(r => r.track.artist.split(',')[0].trim()))).filter(Boolean);
          const sampledArtistNames = Array.from(new Set([
            ...(moodRecommendationSession?.key === moodKey ? (moodRecommendationSession.sampledArtistNames || []) : []),
            ...artistsFromRecs,
          ])).slice(-30);

          setMoodRecs(vipRecs);
          setMoodRecommendationSession({
            key: moodKey,
            tracks: vipRecs,
            seenTrackIds: Array.from(new Set([
              ...(moodRecommendationSession?.key === moodKey ? moodRecommendationSession.seenTrackIds : []),
              ...vipRecs.map(rec => rec.track.id),
            ])),
            sampledArtistNames,
          });
          return;
        }

        const recs = getSmartRecommendations(
          todayMood.moodType as any,
          TRACKS_LIBRARY,
          user?.id ?? null,
          20,
          options,
        );
        if (isMounted) {
          setMoodRecs(recs);
          setMoodRecommendationSession({
            key: moodKey,
            tracks: recs,
            seenTrackIds: Array.from(new Set([
              ...(moodRecommendationSession?.key === moodKey ? moodRecommendationSession.seenTrackIds : []),
              ...recs.map(rec => rec.track.id),
            ])),
          });
        }
      } catch {
        if (isMounted) setMoodRecs([]);
      } finally {
        if (isMounted) setIsRefreshingMoodRecs(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [todayMood, user?.id, isVIP, spotifyConnected, getVIPRecommendations, moodRefreshCycle, moodRecommendationSession, setMoodRecommendationSession]);

  const categories = useMemo(() => {
    let list: any[] = [];
    if (selectedFilter === 'all') {
      list = [...CATEGORIES_LIST];
      if (isVIP && spotifyConnected) {
        list.splice(1, 0, {
          slug: 'spotify',
          label: 'Spotify Library',
          subtitle: 'Connected',
          cover: 'spotify',
          height: 180,
        });
      }
    } else if (selectedFilter === 'local') {
      list = CATEGORIES_LIST.filter(c => c.slug === 'local');
    } else if (selectedFilter === 'spotify') {
      if (isVIP && spotifyConnected) {
        list = [
          {
            slug: 'spotify',
            label: 'Spotify Library',
            subtitle: 'Connected',
            cover: 'spotify',
            height: 220,
          },
        ];
      } else {
        list = [];
      }
    } else if (selectedFilter === 'curated') {
      list = CATEGORIES_LIST.filter(c => c.slug !== 'local');
    }
    return list;
  }, [selectedFilter, isVIP, spotifyConnected]);

  const leftCol = useMemo(() => categories.filter((_, i) => i % 2 === 0), [categories]);
  const rightCol = useMemo(() => categories.filter((_, i) => i % 2 === 1), [categories]);

  const filterChips = useMemo(() => [
    { key: 'all', label: 'All' },
    { key: 'local', label: 'Local' },
    { key: 'spotify', label: 'Spotify' },
    { key: 'curated', label: 'Curated' },
  ] as const, []);

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
        {filterChips.map((chip) => {
          const isActive = selectedFilter === chip.key;
          return (
            <Pressable
              key={chip.key}
              style={[styles.filterChip, isActive && styles.activeFilterChip]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedFilter(chip.key as any);
              }}
            >
              <Text style={[styles.filterChipText, isActive && styles.activeFilterChipText]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FOR YOUR MOOD SECTION (Shown on All or Spotify tab if connected) */}
      {todayMood && moodRecs.length > 0 && (selectedFilter === 'all' || (selectedFilter === 'spotify' && isVIP && spotifyConnected)) && (
        <View style={styles.musicRecsSection}>
          <View style={styles.musicRecsHeader}>
            <Pressable
              style={styles.musicRecsHeaderLeft}
              onPress={onOpenRecommended}
            >
              <Feather
                name={(MOOD_GENRE_MAP[todayMood.moodType as keyof typeof MOOD_GENRE_MAP]?.icon ?? 'music') as any}
                size={16}
                color={Colors.mood[todayMood.moodType] ?? Colors.accent.primary}
              />
              <Text style={styles.musicRecsTitle} numberOfLines={1}>
                {MOOD_GENRE_MAP[todayMood.moodType as keyof typeof MOOD_GENRE_MAP]?.label ?? 'For Your Mood'}
              </Text>
              <View style={[
                styles.musicRecsMoodBadge,
                {
                  backgroundColor: (Colors.mood[todayMood.moodType] ?? Colors.accent.primary) + '18',
                  borderColor: (Colors.mood[todayMood.moodType] ?? Colors.accent.primary) + '35',
                }
              ]}>
                <Text style={[styles.musicRecsMoodText, { color: Colors.mood[todayMood.moodType] ?? Colors.accent.primary }]}>
                  {todayMood.moodType.toUpperCase()}
                </Text>
              </View>
            </Pressable>

            <View style={styles.musicRecsActions}>
              <Pressable
                style={styles.musicRecsRefreshButton}
                disabled={isRefreshingMoodRecs}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsRefreshingMoodRecs(true);
                  setMoodRefreshCycle(cycle => cycle + 1);
                }}
                hitSlop={8}
              >
                {isRefreshingMoodRecs ? (
                  <ActivityIndicator size="small" color={Colors.accent.primary} />
                ) : (
                  <Feather name="refresh-cw" size={13} color={Colors.text.secondary} />
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
            {moodRecs.slice(0, 10).map((rec) => (
              <Pressable
                key={rec.track.id}
                style={styles.musicRecCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onTrackPress(rec.track, moodRecs.map(r => r.track));
                }}
              >
                <View style={[
                  styles.musicRecCoverWrap,
                  { borderColor: (Colors.mood[todayMood.moodType] ?? Colors.accent.primary) + '30' }
                ]}>
                  <MusicCover
                    cover={rec.track.cover}
                    style={styles.musicRecCoverImg}
                    iconSize={16}
                    borderRadius={10}
                  />
                </View>
                <Text style={styles.musicRecTrackTitle} numberOfLines={1}>
                  {rec.track.title}
                </Text>
                <Text style={styles.musicRecTrackArtist} numberOfLines={1}>
                  {rec.track.artist}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Full-width pill See All button at bottom */}
          <Pressable
            style={styles.musicRecsBottomSeeAllButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpenRecommended();
            }}
          >
            <Text style={styles.musicRecsBottomSeeAllText}>See All Recommended Songs</Text>
            <Feather name="arrow-right" size={14} color="#03070E" />
          </Pressable>
        </View>
      )}

      {/* SPOTIFY TAB: VIP NOT UNLOCKED PROMPT */}
      {selectedFilter === 'spotify' && !isVIP && (
        <GlassCard intensity="strong" padding="lg" style={styles.spotifyGateCard}>
          <View style={styles.spotifyGateIconWrapper}>
            <Feather name="award" size={32} color="#FFD166" />
          </View>
          <Text style={styles.spotifyGateTitle}>VIP Access Required</Text>
          <Text style={styles.spotifyGateSubtitle}>
            Spotify integration and smart mood-based recommendations are exclusive VIP features. Apply for VIP access in your profile to unlock Spotify.
          </Text>
          <Pressable
            style={styles.spotifyGateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/profile');
            }}
          >
            <Feather name="star" size={16} color="#03070E" />
            <Text style={styles.spotifyGateButtonText}>Apply for VIP Access</Text>
          </Pressable>
        </GlassCard>
      )}

      {/* SPOTIFY TAB: VIP GRANTED BUT SPOTIFY NOT CONNECTED PROMPT */}
      {selectedFilter === 'spotify' && isVIP && !spotifyConnected && (
        <GlassCard intensity="strong" padding="lg" style={styles.spotifyGateCard}>
          <View style={[styles.spotifyGateIconWrapper, { backgroundColor: 'rgba(29, 185, 84, 0.15)', borderColor: 'rgba(29, 185, 84, 0.3)' }]}>
            <Feather name="music" size={32} color="#1DB954" />
          </View>
          <Text style={styles.spotifyGateTitle}>Connect to Spotify</Text>
          <Text style={styles.spotifyGateSubtitle}>
            Link your Spotify account to listen to your personal playlists, saved library, and personalized mood recommendations.
          </Text>
          <Pressable
            style={[styles.spotifyGateButton, { backgroundColor: '#1DB954' }]}
            disabled={isSpotifyConnecting}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              try {
                await connectSpotify();
              } catch (err) {
                console.warn('[CategoriesView] Failed to connect Spotify:', err);
              }
            }}
          >
            {isSpotifyConnecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="link" size={16} color="#FFFFFF" />
                <Text style={[styles.spotifyGateButtonText, { color: '#FFFFFF' }]}>Connect Spotify Account</Text>
              </>
            )}
          </Pressable>
        </GlassCard>
      )}

      {/* Categories Grid or Single Featured Card */}
      {categories.length === 1 ? (
        <View style={{ width: '100%' }}>
          <AnimatedPressable
            key={categories[0].slug}
            style={[
              styles.bentoCard,
              { height: 220, width: '100%' },
              categories[0].slug === 'spotify' && styles.spotifyPremiumCard
            ]}
            onPress={() => onCategoryPress(categories[0].slug, categories[0].label)}
          >
            <MusicCover cover={categories[0].slug} style={StyleSheet.absoluteFill} showIcon={false} borderRadius={Radius.lg} />
            <View style={styles.bentoBgIcon}>
              <Feather name={getCategoryIcon(categories[0].slug)} size={110} color="rgba(255, 255, 255, 0.05)" />
            </View>
            <View style={styles.bentoGradient}>
              {categories[0].slug === 'spotify' ? (
                <View style={styles.spotifyPremiumBadge}>
                  <Feather name="award" size={10} color="#FFD166" />
                  <Text style={styles.spotifyPremiumBadgeText}>VIP Premium</Text>
                </View>
              ) : categories[0].badge ? (
                <View style={styles.bentoBadge}>
                  <Text style={styles.bentoBadgeText}>{categories[0].badge}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <View style={styles.bentoFooter}>
                <Text numberOfLines={1} style={styles.bentoTitle}>{categories[0].label}</Text>
                <Text style={[styles.bentoSubtitle, categories[0].slug === 'spotify' && { color: '#FFD166' }]}>
                  {categories[0].subtitle}
                </Text>
              </View>
            </View>
          </AnimatedPressable>
        </View>
      ) : categories.length > 1 ? (
        <View style={styles.bentoGridRow}>
          <View style={styles.bentoColumn}>
            {leftCol.map((cat) => (
              <AnimatedPressable
                key={cat.slug}
                style={[
                  styles.bentoCard,
                  { height: cat.height },
                  cat.slug === 'spotify' && styles.spotifyPremiumCard
                ]}
                onPress={() => onCategoryPress(cat.slug, cat.label)}
              >
                <MusicCover cover={cat.slug} style={StyleSheet.absoluteFill} showIcon={false} borderRadius={Radius.lg} />
                <View style={styles.bentoBgIcon}>
                  <Feather name={getCategoryIcon(cat.slug)} size={80} color="rgba(255, 255, 255, 0.05)" />
                </View>
                <View style={styles.bentoGradient}>
                  {cat.slug === 'spotify' ? (
                    <View style={styles.spotifyPremiumBadge}>
                      <Feather name="award" size={10} color="#FFD166" />
                      <Text style={styles.spotifyPremiumBadgeText}>VIP Premium</Text>
                    </View>
                  ) : cat.badge ? (
                    <View style={styles.bentoBadge}>
                      <Text style={styles.bentoBadgeText}>{cat.badge}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <View style={styles.bentoFooter}>
                    <Text numberOfLines={1} style={styles.bentoTitle}>{cat.label}</Text>
                    <Text style={[styles.bentoSubtitle, cat.slug === 'spotify' && { color: '#FFD166' }]}>{cat.subtitle}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            ))}
          </View>
          <View style={styles.bentoColumn}>
            {rightCol.map((cat) => (
              <AnimatedPressable
                key={cat.slug}
                style={[
                  styles.bentoCard,
                  { height: cat.height },
                  cat.slug === 'spotify' && styles.spotifyPremiumCard
                ]}
                onPress={() => onCategoryPress(cat.slug, cat.label)}
              >
                <MusicCover cover={cat.slug} style={StyleSheet.absoluteFill} showIcon={false} borderRadius={Radius.lg} />
                <View style={styles.bentoBgIcon}>
                  <Feather name={getCategoryIcon(cat.slug)} size={80} color="rgba(255, 255, 255, 0.05)" />
                </View>
                <View style={styles.bentoGradient}>
                  {cat.slug === 'spotify' ? (
                    <View style={styles.spotifyPremiumBadge}>
                      <Feather name="award" size={10} color="#FFD166" />
                      <Text style={styles.spotifyPremiumBadgeText}>VIP Premium</Text>
                    </View>
                  ) : cat.badge ? (
                    <View style={styles.bentoBadge}>
                      <Text style={styles.bentoBadgeText}>{cat.badge}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <View style={styles.bentoFooter}>
                    <Text numberOfLines={1} style={styles.bentoTitle}>{cat.label}</Text>
                    <Text style={[styles.bentoSubtitle, cat.slug === 'spotify' && { color: '#FFD166' }]}>{cat.subtitle}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      ) : null}
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

const SPOTIFY_CACHE_FILE = new File(Paths.document, 'spotify_playlist_cache.json');
let spotifyPlaylistCache: Record<string, any[]> = {};

const SpotifyListView = React.memo(({
  onGoBack,
  onTrackPress,
  onSettingsPress,
  onShowQueue,
  onAddToPlaylist,
}: {
  onGoBack: () => void;
  onTrackPress: (track: Track, tracks: Track[], isShuffle?: boolean, contextUri?: string, offsetUri?: string, _isFromSearch?: boolean) => void;
  onSettingsPress: () => void;
  onShowQueue: () => void;
  onAddToPlaylist?: (track: SpotifyTrackTarget) => void;
}) => {
  const {
    playlists: spotifyPlaylists,
    loadPlaylists: loadSpotifyPlaylists,
    search: searchSpotify,
    isConnected,
    addToQueue: spotifyAddToQueueHook,
  } = useSpotify();
  const { currentTrack, isPlaying, favorites: spotifyFavorites, toggleFavorite: spotifyToggleFavorite, setQueue: setMusicQueue } = useMusic();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const insets = useSafeAreaInsets();

  // — Spotify Track 3-dot menu state & animations —
  const [spotifyMenuTrack, setSpotifyMenuTrack] = useState<any | null>(null);
  const [showSpotifyMenu, setShowSpotifyMenu] = useState(false);
  const menuSlideAnim = useRef(new RNAnimated.Value(220)).current;
  const menuOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  const prevShowSpotifyMenuRef = useRef(false);
  const isSpotifyMenuClosingRef = useRef(false);
  const lastSpotifyMenuCloseTimeRef = useRef(0);

  const isSpotifyMenuComfort = useMemo(() => {
    if (!spotifyMenuTrack) return false;
    const id1 = 'spotify_' + spotifyMenuTrack.id;
    const id2 = spotifyMenuTrack.id;
    return spotifyFavorites.includes(id1) || spotifyFavorites.includes(id2) || isTrackComfort(id1) || isTrackComfort(id2);
  }, [spotifyMenuTrack, spotifyFavorites, dataVersion]);

  useEffect(() => {
    if (showSpotifyMenu && !prevShowSpotifyMenuRef.current) {
      menuSlideAnim.setValue(220);
      menuOpacityAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(menuOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.spring(menuSlideAnim, {
          toValue: 0,
          tension: 75,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevShowSpotifyMenuRef.current = showSpotifyMenu;
  }, [showSpotifyMenu, menuSlideAnim, menuOpacityAnim]);

  const handleSpotifyMorePress = useCallback((item: any) => {
    if (Date.now() - lastSpotifyMenuCloseTimeRef.current < 450) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isSpotifyMenuClosingRef.current = false;
    setSpotifyMenuTrack(item);
    setShowSpotifyMenu(true);
  }, []);

  const handleCloseSpotifyMenu = useCallback((onComplete?: () => void) => {
    if (isSpotifyMenuClosingRef.current) return;
    isSpotifyMenuClosingRef.current = true;
    lastSpotifyMenuCloseTimeRef.current = Date.now();

    RNAnimated.parallel([
      RNAnimated.timing(menuOpacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      RNAnimated.timing(menuSlideAnim, {
        toValue: 220,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSpotifyMenu(false);
      setSpotifyMenuTrack(null);
      isSpotifyMenuClosingRef.current = false;
      if (onComplete) onComplete();
    });
  }, [menuOpacityAnim, menuSlideAnim]);

  // Local toast for Spotify section
  const [spToastMsg, setSpToastMsg] = useState<string | null>(null);
  const [spToastType, setSpToastType] = useState<'success' | 'warning' | 'error'>('success');
  const spToastOpacity = useRef(new RNAnimated.Value(0)).current;
  const spToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSpotifyToast = useCallback((message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    if (spToastTimerRef.current) clearTimeout(spToastTimerRef.current);
    setSpToastMsg(message);
    setSpToastType(type);
    spToastOpacity.setValue(0);
    RNAnimated.timing(spToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    spToastTimerRef.current = setTimeout(() => {
      RNAnimated.timing(spToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setSpToastMsg(null);
      });
    }, 2000);
  }, [spToastOpacity]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);

  // Local playlist search filter
  const filteredPlaylistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    if (!searchQuery.trim()) return playlistTracks;

    const query = searchQuery.toLowerCase().trim();
    return playlistTracks.filter(item => {
      const title = (item.name || '').toLowerCase();
      const artist = (item.artists?.map((a: any) => a.name).join(', ') ?? '').toLowerCase();
      return title.includes(query) || artist.includes(query);
    });
  }, [playlistTracks, selectedPlaylist, searchQuery]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [recentPlaylists, setRecentPlaylists] = useState<Record<string, number>>({});
  const [refreshingPlaylists, setRefreshingPlaylists] = useState(false);

  const sortedPlaylists = useMemo(() => {
    return [...spotifyPlaylists].sort((a, b) => {
      const timeA = recentPlaylists[a.id] || 0;
      const timeB = recentPlaylists[b.id] || 0;
      return timeB - timeA;
    });
  }, [spotifyPlaylists, recentPlaylists]);

  const isPlaylistActive = useCallback((playlistId: string) => {
    if (!currentTrack || !currentTrack.id.startsWith('spotify_')) {
      return false;
    }
    const cachedTracks = spotifyPlaylistCache[playlistId];
    if (!cachedTracks) return false;

    const rawCurrentTrackId = currentTrack.id.replace('spotify_', '');
    return cachedTracks.some((t: any) => t.id === rawCurrentTrackId);
  }, [currentTrack]);

  // Load cache on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        if (SPOTIFY_CACHE_FILE.exists) {
          const content = await SPOTIFY_CACHE_FILE.text();
          if (content) {
            spotifyPlaylistCache = JSON.parse(content);
          }
        }
      } catch (err) {
        console.warn('[SpotifyListView] Failed to load Spotify playlist cache:', err);
      }
    };
    const loadRecents = async () => {
      try {
        const SecureStore = require('expo-secure-store');
        const saved = await SecureStore.getItemAsync('moodmap_recent_playlists');
        if (saved) {
          setRecentPlaylists(JSON.parse(saved));
        }
      } catch (e) {
        console.warn('[SpotifyListView] Failed to load recent playlists:', e);
      }
    };
    loadCache();
    loadRecents();
  }, []);

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

  const currentPlayingIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return playlistTracks.findIndex(t => 'spotify_' + t.id === currentTrack.id);
  }, [currentTrack, playlistTracks]);

  const flatListRef = useRef<FlatList>(null);

  const scrollToPlaying = useCallback(() => {
    if (currentPlayingIndex >= 0 && flatListRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        flatListRef.current.scrollToIndex({
          index: currentPlayingIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, currentPlayingIndex * 76),
          animated: true,
        });
      }
    }
  }, [currentPlayingIndex]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, info.index * 76),
      animated: true,
    });
  }, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 68 + 8, // item height (68) + gap (8)
    offset: (68 + 8) * index,
    index,
  }), []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleRefreshPlaylists = useCallback(async () => {
    setRefreshingPlaylists(true);
    try {
      await loadSpotifyPlaylists();
    } catch (e) {
      console.warn('[SpotifyListView] Refresh playlists failed:', e);
    } finally {
      setRefreshingPlaylists(false);
    }
  }, [loadSpotifyPlaylists]);

  useEffect(() => {
    if (isConnected) {
      loadSpotifyPlaylists();
    }
  }, [isConnected, loadSpotifyPlaylists]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 450);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedPlaylist) {
      // Search is local to the playlist when open; skip global API querying
      return;
    }
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    searchSpotify(debouncedQuery)
      .then((res) => {
        setSearchResults(res || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debouncedQuery, searchSpotify, selectedPlaylist]);

  const handlePlaylistSelect = useCallback(async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setSearchQuery(''); // Reset search input on playlist enter

    // Check in-memory cache
    const cachedTracks = spotifyPlaylistCache[playlist.id];
    if (cachedTracks && cachedTracks.length > 0) {
      setPlaylistTracks(cachedTracks);
      setLoadingPlaylist(false);
      return;
    }

    setLoadingPlaylist(true);
    try {
      const { useTierStore } = require('../stores/tierStore');
      const token = await useTierStore.getState().getValidAccessToken();
      if (token) {
        const { getPlaylistTracks } = require('../services/spotify');
        const tracks = await getPlaylistTracks(token, playlist.id);
        const tracksList = tracks || [];

        // Cache the results permanently
        spotifyPlaylistCache[playlist.id] = tracksList;
        try {
          await SPOTIFY_CACHE_FILE.write(JSON.stringify(spotifyPlaylistCache));
        } catch (saveErr) {
          console.warn('[SpotifyListView] Failed to write Spotify cache file:', saveErr);
        }

        setPlaylistTracks(tracksList);
      }
    } catch (e) {
      console.warn('[SpotifyListView] Failed to load playlist tracks:', e);
    } finally {
      setLoadingPlaylist(false);
    }
  }, []);

  const handleRefreshPlaylist = useCallback(async (playlist: any) => {
    if (!playlist) return;
    setLoadingPlaylist(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { useTierStore } = require('../stores/tierStore');
      const token = await useTierStore.getState().getValidAccessToken();
      if (token) {
        const { getPlaylistTracks } = require('../services/spotify');
        // Fetch fresh tracks (limit defaults to 500 now in getPlaylistTracks)
        const tracks = await getPlaylistTracks(token, playlist.id);
        const tracksList = tracks || [];

        // Overwrite local cache with the new, fully paginated list
        spotifyPlaylistCache[playlist.id] = tracksList;
        try {
          await SPOTIFY_CACHE_FILE.write(JSON.stringify(spotifyPlaylistCache));
        } catch (saveErr) {
          console.warn('[SpotifyListView] Failed to write Spotify cache file:', saveErr);
        }

        setPlaylistTracks(tracksList);
      }
    } catch (e) {
      console.warn('[SpotifyListView] Failed to refresh playlist tracks:', e);
    } finally {
      setLoadingPlaylist(false);
    }
  }, []);

  const convertSpotifyTrackToTrack = useCallback((st: any): Track => {
    return {
      id: 'spotify_' + st.id,
      title: st.name,
      artist: st.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist',
      url: st.uri,
      cover: spotifyGetBestImage(st.album?.images || [], 300) ?? '',
      duration: spotifyFormatDur(st.duration_ms),
      durationSec: Math.floor(st.duration_ms / 1000),
      category: 'spotify',
    };
  }, []);

  const handleTrackPressItem = useCallback((track: any, list: any[], isShuffle?: boolean, contextUri?: string, offsetUri?: string, _isFromSearch?: boolean) => {
    const convertedTrack = convertSpotifyTrackToTrack(track);
    const convertedList = list.map(convertSpotifyTrackToTrack);
    onTrackPress(convertedTrack, convertedList, isShuffle, contextUri, offsetUri, _isFromSearch);

    // Save to recents map only when a track is actually played from a playlist
    if (selectedPlaylist) {
      try {
        const now = Date.now();
        setRecentPlaylists((prev) => {
          const updated = { ...prev, [selectedPlaylist.id]: now };
          const SecureStore = require('expo-secure-store');
          SecureStore.setItemAsync('moodmap_recent_playlists', JSON.stringify(updated)).catch((err: any) => {
            console.warn('[SpotifyListView] Failed to save recent playlist interaction:', err);
          });
          return updated;
        });
      } catch (e) {
        console.warn('[SpotifyListView] Failed to save recent playlist interaction:', e);
      }
    }
  }, [convertSpotifyTrackToTrack, onTrackPress, selectedPlaylist]);

  const handleShufflePlay = useCallback(() => {
    if (playlistTracks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Create a copy and shuffle using Fisher-Yates algorithm
    const shuffled = [...playlistTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Play native Spotify playlist context with shuffle enabled, starting with the first track as offset
    const contextUri = selectedPlaylist ? `spotify:playlist:${selectedPlaylist.id}` : undefined;
    handleTrackPressItem(shuffled[0], shuffled, true, contextUri, shuffled[0].uri);
  }, [playlistTracks, handleTrackPressItem, selectedPlaylist]);

  const renderSpotifyTrackItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isCurrent = currentTrack?.id === 'spotify_' + item.id;
    return (
      <GlassCard
        intensity="subtle"
        padding="none"
        style={[styles.trackItem, isCurrent && styles.activeTrackItem]}
        onPress={() => {
          const contextUri = selectedPlaylist ? `spotify:playlist:${selectedPlaylist.id}` : undefined;
          handleTrackPressItem(item, filteredPlaylistTracks, false, contextUri, item.uri);
        }}
      >
        <View style={styles.trackItemInner}>
          <Image
            source={item.album?.images?.[0]?.url ? { uri: item.album.images[0].url } : undefined}
            style={[styles.trackCover, { borderRadius: 20 }]}
          />
          <View style={styles.trackDetails}>
            <Text numberOfLines={1} style={[styles.trackName, isCurrent && styles.activeTrackText]}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={styles.trackArtist}>
              {item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist'}
            </Text>
          </View>
          <View style={styles.trackActions}>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); handleSpotifyMorePress(item); }}
              hitSlop={12}
              style={styles.trackMoreBtn}
            >
              <Feather name="more-vertical" size={20} color="rgba(255, 255, 255, 0.6)" />
            </Pressable>
          </View>
        </View>
      </GlassCard>
    );
  }, [currentTrack?.id, filteredPlaylistTracks, handleTrackPressItem, selectedPlaylist, handleSpotifyMorePress]);

  return (
    <View style={{ flex: 1 }}>
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        <View style={styles.absoluteTitleContainer} pointerEvents="none">
          <Text style={styles.navigationTitleText} numberOfLines={1}>
            {selectedPlaylist ? selectedPlaylist.name : "Spotify Library"}
          </Text>
        </View>

        <View style={{ width: 96, alignItems: 'flex-start' }}>
          <Pressable
            style={styles.closeBtn}
            onPress={selectedPlaylist ? () => setSelectedPlaylist(null) : onGoBack}
          >
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>
        </View>

        <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.sm }}>
          {selectedPlaylist && (
            <Pressable
              style={styles.closeBtn}
              onPress={() => handleRefreshPlaylist(selectedPlaylist)}
              disabled={loadingPlaylist}
            >
              {loadingPlaylist ? (
                <ActivityIndicator size="small" color="#1DB954" />
              ) : (
                <Feather name="refresh-cw" size={18} color="#1DB954" />
              )}
            </Pressable>
          )}
          <Pressable style={styles.closeBtn} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#1DB954" />
          </Pressable>
        </View>
      </View>

      {/* Spotify Custom Search Bar */}
      <View style={[styles.searchBar, { borderColor: 'rgba(30, 215, 96, 0.2)', borderWidth: 1 }]}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={selectedPlaylist ? `Search inside ${selectedPlaylist.name}...` : "Search Spotify tracks..."}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
          </Pressable>
        )}
      </View>

      {selectedPlaylist ? (
        /* Playlist detail list view */
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: 8, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md }}>
            {/* Playlists Back Button */}
            <View style={{ flex: 1 }}>
              <Pressable
                style={{
                  width: '100%',
                  height: 38,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: Radius.md,
                  gap: 6,
                }}
                onPress={() => {
                  setSelectedPlaylist(null);
                  setSearchQuery('');
                }}
              >
                <Feather name="arrow-left" size={14} color="#000000" />
                <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                  Playlists
                </Text>
              </Pressable>
            </View>

            {/* Current Queue List Button */}
            <View style={{ flex: 1 }}>
              <Pressable
                style={{
                  width: '100%',
                  height: 38,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#A3E635',
                  borderRadius: Radius.md,
                  gap: 6,
                }}
                onPress={onShowQueue}
              >
                <Feather name="list" size={14} color="#000000" />
                <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                  Queue
                </Text>
              </Pressable>
            </View>

            {/* Shuffle Play Button */}
            <View style={{ flex: 1 }}>
              <Pressable
                style={{
                  width: '100%',
                  height: 38,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1DB954',
                  borderRadius: Radius.md,
                  gap: 6,
                  opacity: playlistTracks.length > 0 ? 1 : 0.5,
                }}
                onPress={handleShufflePlay}
                disabled={playlistTracks.length === 0}
              >
                <Feather name="shuffle" size={14} color="#000000" />
                <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                  Shuffle
                </Text>
              </Pressable>
            </View>
          </View>

          {loadingPlaylist ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#1DB954" />
            </View>
          ) : playlistTracks.length === 0 ? (
            <View style={styles.centerContainer}>
              <Feather name="music" size={48} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>Empty Playlist</Text>
              <Text style={styles.emptyTracksDesc}>No songs found in this Spotify playlist.</Text>
            </View>
          ) : filteredPlaylistTracks.length === 0 ? (
            <View style={styles.centerContainer}>
              <Feather name="search" size={48} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>No Matches Found</Text>
              <Text style={styles.emptyTracksDesc}>No tracks match "{searchQuery}" inside this playlist.</Text>
            </View>
          ) : (
            <View style={{ flex: 1, position: 'relative' }} onLayout={handleLayout}>
              <FlatList
                ref={flatListRef}
                data={filteredPlaylistTracks}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={renderSpotifyTrackItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listScroll}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={10}
                getItemLayout={getItemLayout}
                onScrollToIndexFailed={handleScrollToIndexFailed}
                removeClippedSubviews={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
              <PlayingSongIndicator
                scrollY={scrollYShared}
                currentPlayingIndex={currentPlayingIndex}
                isScrolling={isScrollingShared}
                listHeight={listHeight}
                itemHeight={68}
                itemGap={8}
                onPress={scrollToPlaying}
              />
            </View>
          )}
        </View>
      ) : searchQuery.trim() ? (
        /* Spotify Search Results list view */
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#1DB954" />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.centerContainer}>
              <Feather name="search" size={48} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>No tracks found</Text>
              <Text style={styles.emptyTracksDesc}>Try searching for another song name.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
              {searchResults.map((item, idx) => {
                const isCurrent = currentTrack?.id === 'spotify_' + item.id;
                return (
                  <GlassCard
                    key={`${item.id}-${idx}`}
                    intensity="subtle"
                    padding="none"
                    style={[styles.trackItem, isCurrent && styles.activeTrackItem]}
                    onPress={() => handleTrackPressItem(item, [item], false, undefined, item.uri, true)}
                    disablePressAnimation
                  >
                    <View style={styles.trackItemInner}>
                      <Image
                        source={item.album?.images?.[0]?.url ? { uri: item.album.images[0].url } : undefined}
                        style={[styles.trackCover, { borderRadius: 20 }]}
                      />
                      <View style={styles.trackDetails}>
                        <Text numberOfLines={1} style={[styles.trackName, isCurrent && styles.activeTrackText]}>
                          {item.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.trackArtist}>
                          {item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.trackActions}>
                        <Pressable
                          onPress={(e) => { e.stopPropagation?.(); handleSpotifyMorePress(item); }}
                          hitSlop={12}
                          style={styles.trackMoreBtn}
                        >
                          <Feather name="more-vertical" size={20} color="rgba(255, 255, 255, 0.6)" />
                        </Pressable>
                      </View>
                    </View>
                  </GlassCard>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : (
        /* Playlists Grid View */
        <ScrollView
          contentContainerStyle={styles.listScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingPlaylists}
              onRefresh={handleRefreshPlaylists}
              tintColor="#1DB954"
              colors={['#1DB954']}
            />
          }
        >
          <Text style={[styles.cardTitleSm, { marginBottom: Spacing.md, marginLeft: Spacing.xs }]}>
            Your Playlists
          </Text>
          {sortedPlaylists.length === 0 ? (
            <View style={[styles.centerContainer, { paddingVertical: Spacing.section }]}>
              <Feather name="folder" size={40} color={Colors.text.secondary} />
              <Text style={styles.emptyTracksTitle}>No Playlists Found</Text>
              <Text style={styles.emptyTracksDesc}>Check back after creating playlists on Spotify.</Text>
            </View>
          ) : (
            sortedPlaylists.map(pl => {
              const isActive = isPlaylistActive(pl.id);
              const hasImage = pl.images?.[0]?.url;
              return (
                <GlassCard
                  key={pl.id}
                  onPress={() => handlePlaylistSelect(pl)}
                  intensity={isActive ? "strong" : "subtle"}
                  padding="none"
                  style={[
                    styles.playlistItemCard,
                    isActive && styles.activePlaylistItemCard
                  ]}
                >
                  <View style={styles.playlistItemInner}>
                    {hasImage ? (
                      <Image
                        source={{ uri: hasImage }}
                        style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="music" size={20} color="rgba(255,255,255,0.3)" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.playlistItemName, isActive && styles.activePlaylistItemName]}>{pl.name}</Text>
                      <Text style={[styles.playlistItemCount, isActive && styles.activePlaylistItemCount]}>
                        {isActive ? (isPlaying ? 'Playing • ' : 'Paused • ') : ''}
                        {(pl.tracks?.total ?? pl.items?.total ?? 0)} tracks
                      </Text>
                    </View>
                    {isActive ? (
                      <Feather
                        name={isPlaying ? "volume-2" : "pause"}
                        size={16}
                        color="#1DB954"
                      />
                    ) : (
                      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
                    )}
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Spotify Track 3-dot Options Sheet */}
      <Modal
        visible={showSpotifyMenu && !!spotifyMenuTrack}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => handleCloseSpotifyMenu()}
      >
        <RNAnimated.View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end', opacity: menuOpacityAnim }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCloseSpotifyMenu()} />
          <RNAnimated.View
            style={{
              width: '100%',
              paddingHorizontal: 14,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: menuSlideAnim }],
            }}
            pointerEvents="box-none"
          >
            <GlassCard intensity="strong" padding="none" style={[styles.menuContent, { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden' }]}>
              {/* Track header */}
              <View style={styles.menuHeader}>
                <Image
                  source={spotifyMenuTrack?.album?.images?.[0]?.url ? { uri: spotifyMenuTrack.album.images[0].url } : undefined}
                  style={[styles.menuTrackCover, { borderRadius: 12 }]}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.menuTrackTitle}>{spotifyMenuTrack?.name}</Text>
                  <Text numberOfLines={1} style={styles.menuTrackArtist}>
                    {spotifyMenuTrack?.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist'}
                  </Text>
                </View>
              </View>

              <View style={styles.menuDivider} />

              {/* Add to Queue */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!spotifyMenuTrack) return;
                  const targetTrack = spotifyMenuTrack;
                  handleCloseSpotifyMenu(async () => {
                    try {
                      await spotifyAddToQueueHook(targetTrack.uri);
                      showSpotifyToast('Added to Queue');

                      // Timed re-fetch of Spotify's live queue so our in-app queue list updates
                      setTimeout(async () => {
                        try {
                          const { useTierStore } = require('../stores/tierStore');
                          const token = await useTierStore.getState().getValidAccessToken();
                          if (token) {
                            const { getQueue } = require('../services/spotify');
                            const { parseSpotifyQueueHelper } = require('../context/MusicContext');
                            const queueData = await getQueue(token);
                            if (queueData) {
                              const combinedQueue = parseSpotifyQueueHelper(queueData);
                              setMusicQueue(combinedQueue);
                            }
                          }
                        } catch (syncErr) {
                          console.warn('[SpotifyListView] Failed to sync updated Spotify queue:', syncErr);
                        }
                      }, 1200);
                    } catch {
                      showSpotifyToast('Could not add to queue — open Spotify and play something first', 'error');
                    }
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="plus-circle" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuOptionText}>Add to Queue</Text>
              </Pressable>

              {/* Add / Remove Comfort Box */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!spotifyMenuTrack || isSpotifyMenuClosingRef.current) return;
                  const targetTrack = spotifyMenuTrack;
                  const trackObj = convertSpotifyTrackToTrack(targetTrack);
                  const wasFav = isSpotifyMenuComfort;
                  handleCloseSpotifyMenu(() => {
                    spotifyToggleFavorite(trackObj);
                    showSpotifyToast(wasFav ? 'Removed from Comfort Box' : 'Added to Comfort Box');
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather
                    name="heart"
                    size={18}
                    color={isSpotifyMenuComfort ? '#F472B6' : '#FFF'}
                    fill={isSpotifyMenuComfort ? '#F472B6' : 'transparent'}
                  />
                </View>
                <Text style={[styles.menuOptionText, isSpotifyMenuComfort && { color: '#F472B6' }]}>
                  {isSpotifyMenuComfort ? 'Remove from Comfort Box' : 'Add to Comfort Box'}
                </Text>
              </Pressable>

              {/* Add to Spotify Playlist */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!spotifyMenuTrack) return;
                  const targetTrack = spotifyMenuTrack;
                  handleCloseSpotifyMenu(() => {
                    onAddToPlaylist?.({
                      id: targetTrack.id,
                      title: targetTrack.name,
                      artist: targetTrack.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown Artist',
                      cover: targetTrack.album?.images?.[0]?.url,
                      uri: targetTrack.uri || `spotify:track:${targetTrack.id}`,
                    });
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="folder-plus" size={18} color="#1DB954" />
                </View>
                <Text style={[styles.menuOptionText, { color: '#1DB954' }]}>Add to Spotify Playlist</Text>
              </Pressable>
            </GlassCard>
          </RNAnimated.View>
        </RNAnimated.View>
      </Modal>

      {/* Spotify section local toast */}
      {spToastMsg && (
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            // Sit above the mini player (~80px) with some breathing room
            bottom: 130,
            left: -SCREEN_PADDING,
            right: -SCREEN_PADDING,
            alignItems: 'center',
            zIndex: 999999,
            opacity: spToastOpacity,
          }}
        >
          <View style={{
            backgroundColor: 'rgba(30, 30, 36, 0.95)',
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: spToastType === 'error'
              ? 'rgba(255, 107, 107, 0.25)'
              : spToastType === 'warning'
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
            maxWidth: '85%',
          }}>
            <Feather
              name={spToastType === 'success' ? 'check-circle' : 'alert-circle'}
              size={14}
              color={spToastType === 'error'
                ? Colors.error
                : spToastType === 'warning'
                  ? Colors.warning
                  : Colors.accent.primary}
            />
            <Text style={{ color: '#FFFFFF', fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.caption, flexShrink: 1 }}>
              {spToastMsg}
            </Text>
          </View>
        </RNAnimated.View>
      )}
    </View>
  );
});
SpotifyListView.displayName = 'SpotifyListView';

const PlayingSongIndicator = React.memo(({
  scrollY,
  currentPlayingIndex,
  isScrolling,
  listHeight,
  itemHeight = 68,
  itemGap = 8,
  onPress,
}: {
  scrollY: SharedValue<number>;
  currentPlayingIndex: number;
  isScrolling: SharedValue<boolean>;
  listHeight: number;
  itemHeight?: number;
  itemGap?: number;
  onPress?: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const { currentTrack } = useMusic();

  const itemStride = itemHeight + itemGap;
  const itemTopY = currentPlayingIndex * itemStride;
  const itemBottomY = itemTopY + itemHeight;

  const opacityShared = useSharedValue(0);
  const scaleShared = useSharedValue(0);
  const pressScaleShared = useSharedValue(1);
  const translateYShared = useSharedValue(14);
  const rotationShared = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (currentPlayingIndex < 0 || listHeight <= 0) {
        return { visible: false, isAbove: true, translateY: 14, rot: 0 };
      }

      const currentScrollY = scrollY.value;
      const isScrollActive = isScrolling.value;

      const hasMiniPlayer = !!currentTrack;
      const miniPlayerHeight = hasMiniPlayer
        ? Math.max(insets.bottom, 16) + 60 + 20
        : Math.max(insets.bottom, 12);
      const visibleViewportHeight = listHeight - miniPlayerHeight;

      const isAbove = itemBottomY < currentScrollY + 6;
      const isBelow = itemTopY > currentScrollY + visibleViewportHeight - 6;
      const isOutOfView = isAbove || isBelow;
      const bottomPos = Math.max(14, visibleViewportHeight - 60);

      return {
        visible: isScrollActive && isOutOfView,
        isAbove,
        translateY: isAbove ? 14 : bottomPos,
        rot: isAbove ? 0 : 180,
      };
    },
    (res, prev) => {
      const isJustAppearing = (!prev || !prev.visible) && res.visible;

      if (!prev || res.visible !== prev.visible) {
        if (res.visible) {
          // Noticeable, tactile spring pop entrance
          opacityShared.value = withTiming(1, { duration: 120 });
          scaleShared.value = withSpring(1, {
            damping: 9,
            stiffness: 280,
            mass: 0.55,
          });
        } else {
          // Crisp exit animation
          opacityShared.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
          scaleShared.value = withTiming(0.3, { duration: 150, easing: Easing.in(Easing.quad) });
        }
      }

      if (isJustAppearing) {
        // Start slightly outside bounds and spring-slide into view with a bounce
        translateYShared.value = res.isAbove ? -10 : res.translateY + 20;
        translateYShared.value = withSpring(res.translateY, {
          damping: 10,
          stiffness: 240,
          mass: 0.6,
        });
      } else if (!prev || res.translateY !== prev.translateY) {
        translateYShared.value = withSpring(res.translateY, {
          damping: 14,
          stiffness: 220,
          mass: 0.7,
        });
      }

      if (!prev || res.rot !== prev.rot) {
        rotationShared.value = withTiming(res.rot, {
          duration: 240,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [currentPlayingIndex, listHeight, currentTrack, insets.bottom, itemStride, itemHeight, itemTopY, itemBottomY]
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacityShared.value,
      transform: [
        { translateY: translateYShared.value },
        { scale: scaleShared.value * pressScaleShared.value },
        { rotate: `${rotationShared.value}deg` }
      ]
    };
  });

  if (currentPlayingIndex < 0 || listHeight <= 0) return null;

  return (
    <Animated.View style={[styles.songPointerWrapper, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScaleShared.value = withSpring(0.9, { damping: 12, stiffness: 400 });
        }}
        onPressOut={() => {
          pressScaleShared.value = withSpring(1, { damping: 10, stiffness: 300 });
        }}
        hitSlop={12}
        style={{ width: '100%', height: '100%' }}
      >
        <BlurView intensity={45} tint="dark" style={styles.songPointerBlur}>
          <Feather name="chevron-up" size={20} color={Colors.accent.primary} />
        </BlurView>
      </Pressable>
    </Animated.View>
  );
});
PlayingSongIndicator.displayName = 'PlayingSongIndicator';

const RecommendedListView = React.memo(({
  onGoBack,
  onTrackPress,
  onSettingsPress,
  onShowQueue,
  onAddToPlaylist,
}: {
  onGoBack: () => void;
  onTrackPress: (track: Track, tracks: Track[], isShuffle?: boolean, contextUri?: string, offsetUri?: string, _isFromSearch?: boolean) => void;
  onSettingsPress: () => void;
  onShowQueue: () => void;
  onAddToPlaylist?: (track: SpotifyTrackTarget) => void;
}) => {
  const isVIP = useTierStore((s) => s.isVIP);
  const spotifyConnected = useTierStore((s) => s.spotifyConnected);
  const {
    getVIPRecommendations,
    getContinuationBatch,
    reportTrackSkip,
    reportTrackCompletion,
    addToQueue: spotifyAddToQueueHook,
  } = useSpotify();

  const {
    currentTrack,
    isPlaying,
    favorites,
    toggleFavorite,
    addToQueue: localAddToQueue,
    setQueue: setMusicQueue,
  } = useMusic();
  const playbackTime = usePlaybackTime();

  const todayMood = useAppStore((s) => s.todayMood);
  const user = useAppStore((s) => s.user);
  const moodRecommendationSession = useAppStore((s) => s.moodRecommendationSession);
  const setMoodRecommendationSession = useAppStore((s) => s.setMoodRecommendationSession);
  const insets = useSafeAreaInsets();

  const [recommendedRecs, setRecommendedRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 3-dot menu states & animations
  const [menuTrack, setMenuTrack] = useState<any | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuSlideAnim = useRef(new RNAnimated.Value(220)).current;
  const menuOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  const prevShowMenuRef = useRef(false);
  const isMenuClosingRef = useRef(false);
  const lastMenuCloseTimeRef = useRef(0);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const isRecMenuComfort = useMemo(() => {
    if (!menuTrack?.track) return false;
    const id1 = menuTrack.track.id;
    const id2 = id1.startsWith('spotify_') ? id1.replace('spotify_', '') : `spotify_${id1}`;
    return favorites.includes(id1) || favorites.includes(id2) || isTrackComfort(id1) || isTrackComfort(id2);
  }, [menuTrack, favorites, dataVersion]);

  useEffect(() => {
    if (showMenu && !prevShowMenuRef.current) {
      menuSlideAnim.setValue(220);
      menuOpacityAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(menuOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        RNAnimated.spring(menuSlideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
      ]).start();
    }
    prevShowMenuRef.current = showMenu;
  }, [showMenu, menuSlideAnim, menuOpacityAnim]);

  // Signal tracking sets
  const completedTrackIdsRef = useRef<Set<string>>(new Set(moodRecommendationSession?.completedTrackIds ?? []));
  const skippedTrackIdsRef = useRef<Set<string>>(new Set(moodRecommendationSession?.skippedTrackIds ?? []));
  const allSeenTrackIdsRef = useRef<Set<string>>(new Set(moodRecommendationSession?.seenTrackIds ?? []));
  const lastTrackRef = useRef<{ id: string; startTime: number; lastTime: number; duration: number } | null>(null);

  // Toast states
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(message);
    setToastType(type);
    toastOpacity.setValue(0);
    RNAnimated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimerRef.current = setTimeout(() => {
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setToastMsg(null);
      });
    }, 2000);
  }, [toastOpacity]);

  const handleOpenMenu = useCallback((track: any) => {
    if (Date.now() - lastMenuCloseTimeRef.current < 450) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isMenuClosingRef.current = false;
    setMenuTrack(track);
    setShowMenu(true);
  }, []);

  const handleCloseMenu = useCallback((onComplete?: () => void) => {
    if (isMenuClosingRef.current) return;
    isMenuClosingRef.current = true;
    lastMenuCloseTimeRef.current = Date.now();

    RNAnimated.parallel([
      RNAnimated.timing(menuOpacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      RNAnimated.timing(menuSlideAnim, { toValue: 220, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setShowMenu(false);
      setMenuTrack(null);
      isMenuClosingRef.current = false;
      if (onComplete) onComplete();
    });
  }, [menuOpacityAnim, menuSlideAnim]);

  // Load initial recommendation batch (20 songs)
  const loadRecommendations = useCallback(async (forceFresh: boolean = false) => {
    if (!todayMood) return;
    const moodKey = `${user?.id ?? 'guest'}:${todayMood.id}`;
    const cached = useAppStore.getState().moodRecommendationSession;

    if (!forceFresh && cached?.key === moodKey && cached.tracks.length > 0) {
      setRecommendedRecs(cached.tracks);
      allSeenTrackIdsRef.current = new Set(cached.seenTrackIds);
      completedTrackIdsRef.current = new Set(cached.completedTrackIds ?? []);
      skippedTrackIdsRef.current = new Set(cached.skippedTrackIds ?? []);
      return;
    }

    if (forceFresh) setRefreshing(true);
    else setLoading(true);

    try {
      const options = forceFresh ? {
        excludeTrackIds: Array.from(allSeenTrackIdsRef.current),
        refreshSeed: Date.now(),
        previousArtistNames: cached?.sampledArtistNames || [],
      } : {
        previousArtistNames: cached?.sampledArtistNames || [],
      };

      const vipRecs = await getVIPRecommendations(
        todayMood.moodType as any,
        todayMood.moodScore ?? 7,
        20,
        options
      );

      const recs = vipRecs.length > 0
        ? vipRecs
        : getSmartRecommendations(
            todayMood.moodType as any,
            TRACKS_LIBRARY,
            user?.id ?? null,
            20,
            options
          );

      if (recs && recs.length > 0) {
        const seen = Array.from(new Set([
          ...(cached?.key === moodKey ? cached.seenTrackIds : []),
          ...recs.map(r => r.track.id),
        ]));
        const artistsFromRecs = Array.from(new Set(recs.map(r => r.track.artist.split(',')[0].trim()))).filter(Boolean);
        const sampledArtistNames = Array.from(new Set([
          ...(cached?.key === moodKey ? (cached.sampledArtistNames || []) : []),
          ...artistsFromRecs,
        ])).slice(-30);

        setRecommendedRecs(recs);
        allSeenTrackIdsRef.current = new Set(seen);
        setMoodRecommendationSession({
          key: moodKey,
          tracks: recs,
          seenTrackIds: seen,
          sampledArtistNames,
          completedTrackIds: Array.from(completedTrackIdsRef.current),
          skippedTrackIds: Array.from(skippedTrackIdsRef.current),
        });
      }
    } catch (e) {
      console.warn('[RecommendedListView] Failed to load recommendations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayMood, user?.id, getVIPRecommendations, setMoodRecommendationSession]);

  useEffect(() => {
    loadRecommendations(false);
  }, [loadRecommendations]);

  // Real-time track skip / completion tracking
  useEffect(() => {
    if (!currentTrack) return;
    const prev = lastTrackRef.current;
    const now = Date.now();

    if (prev && prev.id !== currentTrack.id && todayMood) {
      // Previous track finished or was switched
      const durationSec = prev.duration > 0 ? prev.duration : 180;
      const playedRatio = prev.lastTime / durationSec;
      const rawId = prev.id.replace('spotify_', '');

      if (playedRatio >= 0.85) {
        completedTrackIdsRef.current.add(rawId);
        reportTrackCompletion(rawId, todayMood.moodType as any);
      } else if (playedRatio < 0.15 || (now - prev.startTime < 30000 && playedRatio < 0.3)) {
        skippedTrackIdsRef.current.add(rawId);
        reportTrackSkip(rawId, todayMood.moodType as any);
      }

      // Sync session signals
      const moodKey = `${user?.id ?? 'guest'}:${todayMood.id}`;
      const cached = useAppStore.getState().moodRecommendationSession;
      if (cached?.key === moodKey) {
        setMoodRecommendationSession({
          ...cached,
          completedTrackIds: Array.from(completedTrackIdsRef.current),
          skippedTrackIds: Array.from(skippedTrackIdsRef.current),
        });
      }
    }

    lastTrackRef.current = {
      id: currentTrack.id,
      startTime: now,
      lastTime: playbackTime.currentTime || 0,
      duration: playbackTime.duration || currentTrack.durationSec || 180,
    };
  }, [currentTrack?.id, playbackTime.currentTime, playbackTime.duration, todayMood, user?.id, reportTrackCompletion, reportTrackSkip, setMoodRecommendationSession]);

  // Infinite continuation batch loader
  const loadMoreRecommendations = useCallback(async () => {
    if (loadingMore || loading || !todayMood || recommendedRecs.length === 0) return;
    setLoadingMore(true);

    try {
      const moodKey = `${user?.id ?? 'guest'}:${todayMood.id}`;
      const cached = useAppStore.getState().moodRecommendationSession;

      const moreRecs = await getContinuationBatch(
        todayMood.moodType as any,
        todayMood.moodScore ?? 7,
        Array.from(completedTrackIdsRef.current),
        Array.from(skippedTrackIdsRef.current),
        Array.from(allSeenTrackIdsRef.current),
        20,
        cached?.sampledArtistNames || [],
      );

      if (moreRecs && moreRecs.length > 0) {
        // Filter out any duplicates already present
        const currentIds = new Set(recommendedRecs.map(r => r.track.id));
        const filteredNew = moreRecs.filter(r => !currentIds.has(r.track.id));

        if (filteredNew.length > 0) {
          const updatedRecs = [...recommendedRecs, ...filteredNew];
          const newSeen = Array.from(new Set([
            ...Array.from(allSeenTrackIdsRef.current),
            ...filteredNew.map(r => r.track.id),
          ]));
          const artistsFromNew = Array.from(new Set(filteredNew.map(r => r.track.artist.split(',')[0].trim()))).filter(Boolean);
          const updatedSampledArtists = Array.from(new Set([
            ...(cached?.sampledArtistNames || []),
            ...artistsFromNew,
          ])).slice(-30);

          setRecommendedRecs(updatedRecs);
          allSeenTrackIdsRef.current = new Set(newSeen);

          setMoodRecommendationSession({
            key: moodKey,
            tracks: updatedRecs,
            seenTrackIds: newSeen,
            sampledArtistNames: updatedSampledArtists,
            completedTrackIds: Array.from(completedTrackIdsRef.current),
            skippedTrackIds: Array.from(skippedTrackIdsRef.current),
          });
        }
      }
    } catch (e) {
      console.warn('[RecommendedListView] Failed to load continuation batch:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, todayMood, recommendedRecs, getContinuationBatch, user?.id, setMoodRecommendationSession]);

  // Filtered tracks for search
  const filteredRecs = useMemo(() => {
    if (!searchQuery.trim()) return recommendedRecs;
    const q = searchQuery.toLowerCase().trim();
    return recommendedRecs.filter(r =>
      r.track.title.toLowerCase().includes(q) ||
      r.track.artist.toLowerCase().includes(q) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  }, [recommendedRecs, searchQuery]);

  const allTracks = useMemo(() => filteredRecs.map(r => r.track), [filteredRecs]);

  // Shuffle play
  const handleShufflePlay = useCallback(() => {
    if (allTracks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const shuffled = [...allTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onTrackPress(shuffled[0], shuffled, true, undefined, shuffled[0].url);
  }, [allTracks, onTrackPress]);

  // Play all
  const handlePlayAll = useCallback(() => {
    if (allTracks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTrackPress(allTracks[0], allTracks, false, undefined, allTracks[0].url);
  }, [allTracks, onTrackPress]);

  // Indicator helper states & refs
  const scrollYShared = useSharedValue(0);
  const isScrollingShared = useSharedValue(false);
  const [listHeight, setListHeight] = useState(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollYShared.value = y;
    isScrollingShared.value = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingShared.value = false;
    }, 400);
  }, [scrollYShared, isScrollingShared]);

  const handleLayout = useCallback((event: any) => {
    setListHeight(event.nativeEvent.layout.height);
  }, []);

  const currentPlayingIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return filteredRecs.findIndex(r => r.track.id === currentTrack.id);
  }, [currentTrack, filteredRecs]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 86,
    offset: 86 * index,
    index,
  }), []);

  const flatListRef = useRef<FlatList>(null);

  const scrollToPlaying = useCallback(() => {
    if (currentPlayingIndex >= 0 && flatListRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        flatListRef.current.scrollToIndex({
          index: currentPlayingIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, currentPlayingIndex * 86),
          animated: true,
        });
      }
    }
  }, [currentPlayingIndex]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, info.index * 86),
      animated: true,
    });
  }, []);

  const moodColor = todayMood ? (Colors.mood[todayMood.moodType] ?? Colors.accent.primary) : Colors.accent.primary;
  const moodLabel = todayMood ? (MOOD_GENRE_MAP[todayMood.moodType as keyof typeof MOOD_GENRE_MAP]?.label ?? 'For Your Mood') : 'Recommended Music';
  const moodIcon = todayMood ? (MOOD_GENRE_MAP[todayMood.moodType as keyof typeof MOOD_GENRE_MAP]?.icon ?? 'music') : 'music';

  const renderRecommendedItem = useCallback(({ item: rec, index }: { item: any; index: number }) => {
    const track = rec.track;
    const isCurrent = currentTrack?.id === track.id;
    return (
      <GlassCard
        intensity="subtle"
        padding="none"
        style={[
          styles.recommendedTrackItem,
          isCurrent && [styles.activeTrackItem, { borderColor: moodColor + '40', backgroundColor: 'rgba(255, 255, 255, 0.08)' }]
        ]}
        onPress={() => {
          onTrackPress(track, allTracks, false, undefined, track.url);
        }}
      >
        <View style={styles.recommendedTrackItemInner}>
          <MusicCover cover={track.cover} style={styles.recommendedTrackCover} iconSize={16} />
          <View style={styles.recommendedTrackDetails}>
            <Text numberOfLines={1} style={[styles.recommendedTrackName, isCurrent && { color: moodColor }]}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={styles.recommendedTrackArtist}>
              {track.artist}
            </Text>
            {rec.reason ? (
              <View style={styles.recommendedReasonBadge}>
                <Feather
                  name={
                    rec.source === 'familiar' ? 'heart' :
                    rec.source === 'personal' ? 'user' :
                    rec.source === 'playlist' ? 'disc' :
                    rec.source === 'discovery' ? 'compass' : 'star'
                  }
                  size={10}
                  color={moodColor}
                />
                <Text style={[styles.recommendedReasonText, { color: moodColor }]} numberOfLines={1}>
                  {rec.reason}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.recommendedTrackActions}>
            <Text style={styles.recommendedTrackDuration}>{track.duration}</Text>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); handleOpenMenu(rec); }}
              hitSlop={12}
              style={styles.trackMoreBtn}
            >
              <Feather name="more-vertical" size={20} color="rgba(255, 255, 255, 0.5)" />
            </Pressable>
          </View>
        </View>
      </GlassCard>
    );
  }, [currentTrack?.id, allTracks, onTrackPress, moodColor, handleOpenMenu]);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.navigationHeader}>
        <View style={styles.absoluteTitleContainer} pointerEvents="none">
          <Text style={styles.navigationTitleText} numberOfLines={1}>
            {moodLabel}
          </Text>
        </View>

        <View style={{ width: 96, alignItems: 'flex-start' }}>
          <Pressable style={styles.closeBtn} onPress={onGoBack}>
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>
        </View>

        <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.sm }}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => loadRecommendations(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={moodColor} />
            ) : (
              <Feather name="refresh-cw" size={18} color={moodColor} />
            )}
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color={Colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Solid Vibrant Mood Hero Card */}
      {todayMood && (
        <View style={[
          styles.recommendedMoodBanner,
          {
            backgroundColor: moodColor,
            shadowColor: moodColor,
          }
        ]}>
          <View style={styles.recommendedMoodIconWrap}>
            <Feather name={moodIcon as any} size={20} color="#0A0A0C" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <Text style={styles.recommendedMoodTitle}>{moodLabel}</Text>
              <View style={styles.recommendedMoodBadge}>
                <Text style={styles.recommendedMoodBadgeText}>
                  {todayMood.moodType.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.recommendedMoodSubtitle}>
              {recommendedRecs.length} tracks • Fresh mix crafted for your vibe
            </Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={[styles.searchBar, { borderColor: moodColor + '30', borderWidth: 1 }]}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search within recommendations..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
          </Pressable>
        )}
      </View>

      {/* Action Buttons Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: 8, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md }}>
        {/* Categories Back Button */}
        <View style={{ flex: 1 }}>
          <Pressable
            style={{
              width: '100%',
              height: 38,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: Radius.md,
              gap: 6,
            }}
            onPress={onGoBack}
          >
            <Feather name="arrow-left" size={14} color="#000000" />
            <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
              Music Hub
            </Text>
          </Pressable>
        </View>

        {/* Current Queue List Button */}
        <View style={{ flex: 1 }}>
          <Pressable
            style={{
              width: '100%',
              height: 38,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#A3E635',
              borderRadius: Radius.md,
              gap: 6,
            }}
            onPress={onShowQueue}
          >
            <Feather name="list" size={14} color="#000000" />
            <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
              Queue
            </Text>
          </Pressable>
        </View>

        {/* Shuffle Play Button */}
        <View style={{ flex: 1 }}>
          <Pressable
            style={{
              width: '100%',
              height: 38,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: moodColor,
              borderRadius: Radius.md,
              gap: 6,
              opacity: filteredRecs.length > 0 ? 1 : 0.5,
            }}
            onPress={handleShufflePlay}
            disabled={filteredRecs.length === 0}
          >
            <Feather name="shuffle" size={14} color="#000000" />
            <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
              Shuffle
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Track List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={moodColor} />
          <Text style={[styles.emptyTracksDesc, { marginTop: Spacing.sm }]}>Crafting your personalized mood playlist...</Text>
        </View>
      ) : filteredRecs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="music" size={48} color={Colors.text.secondary} />
          <Text style={styles.emptyTracksTitle}>No Songs Found</Text>
          <Text style={styles.emptyTracksDesc}>
            {searchQuery.trim() !== '' ? 'No recommendations match your search.' : 'Log a mood to get personalized music.'}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, position: 'relative' }} onLayout={handleLayout}>
          <FlatList
            ref={flatListRef}
            data={filteredRecs}
            keyExtractor={(item, index) => `${item.track.id}-${index}`}
            renderItem={renderRecommendedItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listScroll}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={10}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            removeClippedSubviews={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListFooterComponent={
              <View style={{ paddingVertical: Spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                {loadingMore ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 22,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: Radius.pill,
                    borderWidth: 1,
                    borderColor: moodColor + '35',
                  }}>
                    <ActivityIndicator size="small" color={moodColor} />
                    <Text style={{ fontFamily: Fonts.bodyMedium, fontSize: FontSizes.caption, color: Colors.text.primary }}>
                      Loading more songs...
                    </Text>
                  </View>
                ) : filteredRecs.length > 0 ? (
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderWidth: 1,
                      borderColor: moodColor + '40',
                      borderRadius: Radius.pill,
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                    }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      loadMoreRecommendations();
                    }}
                  >
                    <Feather name="plus" size={16} color={moodColor} />
                    <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: Colors.text.primary }}>
                      Load More Songs
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            }
          />
          <PlayingSongIndicator
            scrollY={scrollYShared}
            currentPlayingIndex={currentPlayingIndex}
            isScrolling={isScrollingShared}
            listHeight={listHeight}
            itemHeight={78}
            itemGap={8}
            onPress={scrollToPlaying}
          />
        </View>
      )}

      {/* Track 3-dot Options Sheet */}
      <Modal
        visible={showMenu && !!menuTrack}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => handleCloseMenu()}
      >
        <RNAnimated.View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end', opacity: menuOpacityAnim }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCloseMenu()} />
          <RNAnimated.View
            style={{
              width: '100%',
              paddingHorizontal: 14,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: menuSlideAnim }],
            }}
            pointerEvents="box-none"
          >
            <GlassCard intensity="strong" padding="none" style={[styles.menuContent, { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden' }]}>
              {/* Track header */}
              <View style={styles.menuHeader}>
                <MusicCover cover={menuTrack?.track?.cover} style={[styles.menuTrackCover, { borderRadius: 12 }]} iconSize={14} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.menuTrackTitle}>{menuTrack?.track?.title}</Text>
                  <Text numberOfLines={1} style={styles.menuTrackArtist}>{menuTrack?.track?.artist}</Text>
                </View>
              </View>

              <View style={styles.menuDivider} />

              {/* Add to Queue */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!menuTrack?.track) return;
                  const targetTrack = menuTrack.track;
                  handleCloseMenu(async () => {
                    try {
                      if (targetTrack.url?.startsWith('spotify:')) {
                        await spotifyAddToQueueHook(targetTrack.url);
                        showToast('Added to Queue');

                        // Timed re-fetch of Spotify's live queue so our in-app queue list stays consistent
                        setTimeout(async () => {
                          try {
                            const { useTierStore } = require('../stores/tierStore');
                            const token = await useTierStore.getState().getValidAccessToken();
                            if (token) {
                              const { getQueue } = require('../services/spotify');
                              const { parseSpotifyQueueHelper } = require('../context/MusicContext');
                              const queueData = await getQueue(token);
                              if (queueData) {
                                const combinedQueue = parseSpotifyQueueHelper(queueData);
                                setMusicQueue(combinedQueue);
                              }
                            }
                          } catch (syncErr) {
                            console.warn('[RecommendedListView] Failed to sync updated Spotify queue:', syncErr);
                          }
                        }, 1200);
                      } else {
                        localAddToQueue(targetTrack);
                        showToast('Added to Queue');
                      }
                    } catch {
                      showToast('Could not add to queue — open Spotify and play something first', 'error');
                    }
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="plus-circle" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuOptionText}>Add to Queue</Text>
              </Pressable>

              {/* Add / Remove Comfort Box */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!menuTrack?.track || isMenuClosingRef.current) return;
                  const target = menuTrack.track;
                  const wasFav = isRecMenuComfort;
                  handleCloseMenu(() => {
                    toggleFavorite(target);
                    showToast(wasFav ? 'Removed from Comfort Box' : 'Added to Comfort Box');
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather
                    name="heart"
                    size={18}
                    color={isRecMenuComfort ? '#F472B6' : '#FFF'}
                    fill={isRecMenuComfort ? '#F472B6' : 'transparent'}
                  />
                </View>
                <Text style={[styles.menuOptionText, isRecMenuComfort && { color: '#F472B6' }]}>
                  {isRecMenuComfort ? 'Remove from Comfort Box' : 'Add to Comfort Box'}
                </Text>
              </Pressable>

              {/* Add to Spotify Playlist */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!menuTrack?.track) return;
                  const target = menuTrack.track;
                  handleCloseMenu(() => {
                    onAddToPlaylist?.({
                      id: target.id,
                      title: target.title,
                      artist: target.artist,
                      cover: target.cover,
                      uri: target.url?.startsWith('spotify:') ? target.url : `spotify:track:${target.id.replace('spotify_', '')}`,
                    });
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="folder-plus" size={18} color="#1DB954" />
                </View>
                <Text style={[styles.menuOptionText, { color: '#1DB954' }]}>Add to Spotify Playlist</Text>
              </Pressable>
            </GlassCard>
          </RNAnimated.View>
        </RNAnimated.View>
      </Modal>

      {/* Local toast */}
      {toastMsg && (
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 130,
            left: -SCREEN_PADDING,
            right: -SCREEN_PADDING,
            alignItems: 'center',
            zIndex: 999999,
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
            maxWidth: '85%',
          }}>
            <Feather
              name={toastType === 'success' ? 'check-circle' : 'alert-circle'}
              size={14}
              color={toastType === 'error'
                ? Colors.error
                : toastType === 'warning'
                  ? Colors.warning
                  : Colors.accent.primary}
            />
            <Text style={{ color: '#FFFFFF', fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.caption, flexShrink: 1 }}>
              {toastMsg}
            </Text>
          </View>
        </RNAnimated.View>
      )}
    </View>
  );
});
RecommendedListView.displayName = 'RecommendedListView';

const ListView = React.memo(({
  category,
  categoryLabel,
  onGoBack,
  onTrackPress,
  onMorePress,
  sortBy,
  setShowSortMenu,
  onShowQueue,
}: {
  category: string;
  categoryLabel: string;
  onGoBack: () => void;
  onTrackPress: (track: Track, tracks: Track[]) => void;
  onMorePress: (track: Track, fromPlaylistId?: string) => void;
  sortBy: 'default' | 'titleAsc' | 'titleDesc' | 'dateNewest' | 'dateOldest';
  setShowSortMenu: (show: boolean) => void;
  onShowQueue: () => void;
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

  const [localRefreshing, setLocalRefreshing] = useState(false);
  const handleRefreshLocalPlaylist = useCallback(async () => {
    setLocalRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await scanLocalMusic();
    } catch (e) {
      console.warn('[ListView] Failed to scan local music on refresh:', e);
    } finally {
      setTimeout(() => {
        setLocalRefreshing(false);
      }, 700);
    }
  }, [scanLocalMusic]);

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
  const dataVersion = useAppStore((s) => s.dataVersion);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const isTrackFavorited = useCallback((trackId: string) => {
    if (!trackId) return false;
    const altId = trackId.startsWith('spotify_') ? trackId.replace('spotify_', '') : `spotify_${trackId}`;
    return favoritesSet.has(trackId) || favoritesSet.has(altId) || isTrackComfort(trackId) || isTrackComfort(altId);
  }, [favoritesSet]);

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
      tracks = tracks.filter(t => isTrackFavorited(t.id));
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
  }, [category, activeFilter, selectedPlaylist, playlists, isTrackFavorited, debouncedSearchQuery, getCategoryTracks, sortBy, dataVersion]);

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

  const flatListRef = useRef<FlatList>(null);

  const scrollToPlaying = useCallback(() => {
    if (currentPlayingIndex >= 0 && flatListRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        flatListRef.current.scrollToIndex({
          index: currentPlayingIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, currentPlayingIndex * 76),
          animated: true,
        });
      }
    }
  }, [currentPlayingIndex]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, info.index * 76),
      animated: true,
    });
  }, []);

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
            {activeFilter === 'playlist' && selectedPlaylist ? selectedPlaylist.name : categoryLabel}
          </Text>
        </View>

        <View style={{ width: 96, alignItems: 'flex-start' }}>
          <Pressable
            style={styles.closeBtn}
            onPress={activeFilter === 'playlist' && selectedPlaylist ? () => setSelectedPlaylist(null) : onGoBack}
          >
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>
        </View>

        <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.sm }}>
          {activeFilter === 'playlist' && selectedPlaylist ? (
            <Pressable
              style={styles.closeBtn}
              onPress={handleRefreshLocalPlaylist}
              disabled={localRefreshing}
            >
              {localRefreshing ? (
                <ActivityIndicator size="small" color={Colors.text.primary} />
              ) : (
                <Feather name="refresh-cw" size={18} color={Colors.text.primary} />
              )}
            </Pressable>
          ) : category === 'local' ? (
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
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: 8, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md }}>
              {/* Playlists Back Button */}
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{
                    width: '100%',
                    height: 38,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: Radius.md,
                    gap: 6,
                  }}
                  onPress={() => setSelectedPlaylist(null)}
                >
                  <Feather name="arrow-left" size={14} color="#000000" />
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                    Playlists
                  </Text>
                </Pressable>
              </View>

              {/* Current Queue List Button */}
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{
                    width: '100%',
                    height: 38,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#A3E635',
                    borderRadius: Radius.md,
                    gap: 6,
                  }}
                  onPress={onShowQueue}
                >
                  <Feather name="list" size={14} color="#000000" />
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                    Queue
                  </Text>
                </Pressable>
              </View>

              {/* Play All Button */}
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{
                    width: '100%',
                    height: 38,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Colors.accent.primary,
                    borderRadius: Radius.md,
                    gap: 6,
                    opacity: tracksListToRender.length > 0 ? 1 : 0.5,
                  }}
                  onPress={() => {
                    if (tracksListToRender.length > 0) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onTrackPress(tracksListToRender[0], tracksListToRender);
                    }
                  }}
                  disabled={tracksListToRender.length === 0}
                >
                  <Feather name="play" size={14} color="#000000" />
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: FontSizes.caption, color: '#000000' }}>
                    Play All
                  </Text>
                </Pressable>
              </View>
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
                ref={flatListRef}
                data={tracksListToRender}
                keyExtractor={(item) => item.id}
                renderItem={renderTrackItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listScroll}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={10}
                getItemLayout={getItemLayout}
                onScrollToIndexFailed={handleScrollToIndexFailed}
                removeClippedSubviews={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
              <PlayingSongIndicator
                scrollY={scrollYShared}
                currentPlayingIndex={currentPlayingIndex}
                isScrolling={isScrollingShared}
                listHeight={listHeight}
                itemHeight={68}
                itemGap={8}
                onPress={scrollToPlaying}
              />
            </View>
          )}
        </View>
      )}


    </View>
  );
});
ListView.displayName = 'ListView';

// Waveform heights pattern
const WAVEFORM_PATTERN = [6, 8, 12, 16, 20, 24, 20, 16, 12, 8, 6];

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
  onAddToPlaylist,
}: {
  onGoBack: () => void;
  onShowQueue: () => void;
  isPlayerActive: boolean;
  onAddToPlaylist?: (track: SpotifyTrackTarget) => void;
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

  const { nowPlaying, refreshNowPlaying } = useSpotify();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isSpotify = currentTrack?.category === 'spotify';
  const isTrackPlaying = isPlaying;

  // Persistence of Player View Mode ('vinyl' | 'poster')
  const [playerViewMode, setPlayerViewModeState] = useState<'vinyl' | 'poster'>(() => {
    try {
      const { getSetting } = require('../services/settingsService');
      return (getSetting('player_view_mode', 'vinyl') as 'vinyl' | 'poster') || 'vinyl';
    } catch {
      return 'vinyl';
    }
  });
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
  const menuSlideAnim = useRef(new RNAnimated.Value(220)).current;
  const menuOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  const prevShowAppearanceMenuRef = useRef(false);
  const isAppearanceMenuClosingRef = useRef(false);
  const lastAppearanceMenuCloseTimeRef = useRef(0);

  useEffect(() => {
    if (showAppearanceMenu && !prevShowAppearanceMenuRef.current) {
      menuSlideAnim.setValue(220);
      menuOpacityAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(menuOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.spring(menuSlideAnim, {
          toValue: 0,
          tension: 75,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevShowAppearanceMenuRef.current = showAppearanceMenu;
  }, [showAppearanceMenu, menuSlideAnim, menuOpacityAnim]);

  const handleOpenAppearanceMenu = useCallback(() => {
    if (Date.now() - lastAppearanceMenuCloseTimeRef.current < 450) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isAppearanceMenuClosingRef.current = false;
    setShowAppearanceMenu(true);
  }, []);

  const handleCloseAppearanceMenu = useCallback((onComplete?: () => void) => {
    if (isAppearanceMenuClosingRef.current) return;
    isAppearanceMenuClosingRef.current = true;
    lastAppearanceMenuCloseTimeRef.current = Date.now();

    RNAnimated.parallel([
      RNAnimated.timing(menuOpacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      RNAnimated.timing(menuSlideAnim, {
        toValue: 220,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAppearanceMenu(false);
      isAppearanceMenuClosingRef.current = false;
      if (onComplete) onComplete();
    });
  }, [menuOpacityAnim, menuSlideAnim]);

  // Toast notification state for PlayerView
  const [playerToastMsg, setPlayerToastMsg] = useState<string | null>(null);
  const [playerToastType, setPlayerToastType] = useState<'success' | 'warning' | 'error'>('success');
  const playerToastOpacity = useRef(new RNAnimated.Value(0)).current;
  const playerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPlayerToast = useCallback((message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    if (playerToastTimerRef.current) clearTimeout(playerToastTimerRef.current);
    setPlayerToastMsg(message);
    setPlayerToastType(type);
    playerToastOpacity.setValue(0);
    RNAnimated.timing(playerToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    playerToastTimerRef.current = setTimeout(() => {
      RNAnimated.timing(playerToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPlayerToastMsg(null);
      });
    }, 2000);
  }, [playerToastOpacity]);

  // Rotation animation for vinyl mode
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isTrackPlaying && isPlayerActive && playerViewMode === 'vinyl') {
      rotation.value = rotation.value % 360;
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 35000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }
  }, [isTrackPlaying, isPlayerActive, playerViewMode, rotation]);

  const setPlayerViewMode = useCallback((mode: 'vinyl' | 'poster') => {
    setPlayerViewModeState(mode);
    try {
      const { saveSetting } = require('../services/settingsService');
      saveSetting('player_view_mode', mode);
    } catch { }
  }, []);

  // Sync / Refresh Spotify state immediately when the track ID changes
  useEffect(() => {
    if (isSpotify && currentTrack?.id) {
      refreshNowPlaying();
      const timer = setTimeout(() => {
        refreshNowPlaying();
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isSpotify, currentTrack?.id, refreshNowPlaying]);

  // Fast-responding button press handlers
  const handlePlayPausePress = useCallback(async () => {
    if (isTrackPlaying) {
      await pause();
    } else {
      await resume();
    }
    setTimeout(() => {
      refreshNowPlaying();
    }, 500);
  }, [isTrackPlaying, pause, resume, refreshNowPlaying]);

  const handleNextPress = useCallback(async () => {
    await next();
    setTimeout(() => {
      refreshNowPlaying();
    }, 500);
  }, [next, refreshNowPlaying]);

  const handlePrevPress = useCallback(async () => {
    await prev();
    setTimeout(() => {
      refreshNowPlaying();
    }, 500);
  }, [prev, refreshNowPlaying]);

  const insets = useSafeAreaInsets();

  const rotatedArtworkStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  if (!currentTrack) return null;

  const isCurrentFav = useMemo(() => {
    if (!currentTrack) return false;
    const id1 = currentTrack.id;
    const id2 = id1.startsWith('spotify_') ? id1.replace('spotify_', '') : `spotify_${id1}`;
    return favorites.includes(id1) || favorites.includes(id2) || isTrackComfort(id1) || isTrackComfort(id2);
  }, [currentTrack, favorites, dataVersion]);
  const isPosterMode = playerViewMode === 'poster';

  return (
    <View style={[styles.playerContainer, { paddingBottom: insets.bottom + 48 }]}>
      {/* Background artwork & gradient overlay for Poster Mode */}
      {isPosterMode && (
        <View
          style={[
            styles.posterBackgroundContainer,
            {
              top: -insets.top - 20,
              bottom: -insets.bottom - 48,
            },
          ]}
          pointerEvents="none"
        >
          {currentTrack.cover ? (
            <ExpoImage
              source={{ uri: currentTrack.cover }}
              style={styles.posterBgImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.posterBgImage, { backgroundColor: '#12141F' }]} />
          )}
          <LinearGradient
            colors={[
              'rgba(8, 10, 16, 0.50)',
              'rgba(8, 10, 16, 0.25)',
              'rgba(8, 10, 16, 0.90)',
            ]}
            locations={[0, 0.4, 1]}
            style={styles.posterGradientOverlay}
          />
        </View>
      )}

      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        {/* Absolute Centered Title */}
        <View style={styles.absoluteTitleContainer} pointerEvents="none">
          <View style={isPosterMode ? styles.glassHeaderBadge : undefined}>
            <Text style={styles.navigationTitleText} numberOfLines={1}>
              Now Playing
            </Text>
          </View>
        </View>

        <Pressable style={isPosterMode ? styles.glassIconBtn : styles.closeBtn} onPress={onGoBack}>
          <Feather name="chevron-left" size={24} color={Colors.text.primary} />
        </Pressable>

        {/* Single 3-dot button — opens unified Track Options sheet (Favourite + Appearance) */}
        <Pressable
          style={isPosterMode ? styles.glassIconBtn : styles.closeBtn}
          onPress={handleOpenAppearanceMenu}
        >
          <Feather
            name="more-vertical"
            size={20}
            color={Colors.text.primary}
          />
        </Pressable>
      </View>

      {/* Center Artwork Display (Square Poster Card in Poster Mode / Vinyl Disc in Vinyl Mode) */}
      {isPosterMode ? (
        <View style={styles.posterArtworkSection}>
          <View style={styles.posterArtworkCard}>
            <MusicCover
              cover={currentTrack.cover}
              style={styles.posterArtworkImg}
              iconSize={48}
              borderRadius={Radius.xl}
            />
          </View>
        </View>
      ) : (
        /* Large Centered Rotating Vinyl Disc with Center Sticker Cover */
        <View style={styles.playerArtworkSection}>
          <View style={styles.playerArtworkWrapper}>
            {/* Rotating Vinyl Disc Frame */}
            <Animated.View style={[{ width: 240, height: 240, position: 'relative' }, rotatedArtworkStyle]} renderToHardwareTextureAndroid={true}>
              {/* The Svg Vinyl Disc */}
              <Svg viewBox="0 0 400 400" width="100%" height="100%">
                <Defs>
                  <Mask id="grooves">
                    <Rect width="400" height="400" fill="white" />
                    <Circle cx={200} cy={200} r={170} fill="black" />
                    <Circle cx={200} cy={200} r={150} fill="white" />
                    <Circle cx={200} cy={200} r={145} fill="black" />
                    <Circle cx={200} cy={200} r={130} fill="white" />
                    <Circle cx={200} cy={200} r={125} fill="black" />
                    <Circle cx={200} cy={200} r={110} fill="white" />
                    <Circle cx={200} cy={200} r={105} fill="black" />
                    <Circle cx={200} cy={200} r={90} fill="white" />
                    <Circle cx={200} cy={200} r={85} fill="black" />
                    <Circle cx={200} cy={200} r={70} fill="white" />
                  </Mask>
                </Defs>

                {/* Outer Vinyl Body */}
                <G>
                  <Circle cx={200} cy={200} r={200} fill="#111111" />
                  <Circle cx={200} cy={200} r={190} fill="#0A0A0A" />
                  <Circle cx={200} cy={200} r={186} fill="none" stroke="#8DE91D" strokeWidth={1} opacity={0.35} />
                  <Circle cx={200} cy={200} r={180} fill="#2c2c2c" mask="url(#grooves)" />
                  <Circle cx={200} cy={200} r={114} fill="none" stroke="#8DE91D" strokeWidth={2} opacity={0.8} />
                  <Circle cx={200} cy={200} r={108} fill="none" stroke="#8DE91D" strokeWidth={1} opacity={0.5} strokeDasharray="4,4" />
                  <Circle cx={200} cy={200} r={100} fill="#1E1E24" />
                </G>
              </Svg>

              {/* Circular Cover Art Sticker pasted on top of the Vinyl center */}
              <View style={{
                position: 'absolute',
                width: 120,
                height: 120,
                borderRadius: 60,
                top: 60,
                left: 60,
                overflow: 'hidden',
                backgroundColor: '#1E1E24',
              }}>
                <MusicCover
                  cover={currentTrack.cover}
                  style={{ width: '100%', height: '100%' }}
                  iconSize={36}
                  borderRadius={60}
                />
              </View>

              {/* Center Spindle Hole */}
              <View style={{
                position: 'absolute',
                width: 24,
                height: 24,
                borderRadius: 12,
                top: 108,
                left: 108,
                backgroundColor: 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }} pointerEvents="none">
                <Svg width={24} height={24} viewBox="0 0 24 24">
                  <Path d="M9 12 Q 12 9 15 12 Q 12 15 9 12" fill="#ffffff" opacity={0.25} />
                  <Circle cx={12} cy={12} r={6} fill="#111111" stroke="#FFFFFF" strokeWidth={1} />
                  <Circle cx={12} cy={12} r={2} fill="#000000" />
                </Svg>
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      {/* Bottom Controls Group (Identical size & layout for both modes, with frosted glass in Poster Mode) */}
      <View style={[styles.playerControlsGroup, isPosterMode && styles.posterGlassCardContainer]}>
        {isPosterMode && (
          <BlurView
            intensity={Platform.OS === 'ios' ? 85 : 45}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}

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
          isPlaying={isTrackPlaying}
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
          <Pressable onPress={handlePrevPress} style={styles.playerSkipBtn} hitSlop={12}>
            <Feather name="skip-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Play/Pause */}
          <Pressable
            onPress={handlePlayPausePress}
            style={styles.playerPlayBtn}
          >
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
              name={isTrackPlaying ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
              style={isTrackPlaying ? undefined : { marginLeft: 3 }}
            />
          </Pressable>

          {/* Next */}
          <Pressable onPress={handleNextPress} style={styles.playerSkipBtn} hitSlop={12}>
            <Feather name="skip-forward" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Queue List */}
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

      {/* Track Options Modal — Favourite + Appearance */}
      <Modal
        visible={showAppearanceMenu}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => handleCloseAppearanceMenu()}
      >
        <RNAnimated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            justifyContent: 'flex-end',
            opacity: menuOpacityAnim,
          }}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 25}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCloseAppearanceMenu()} />
          <RNAnimated.View
            style={{
              width: '100%',
              paddingHorizontal: 14,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: menuSlideAnim }],
            }}
            pointerEvents="box-none"
          >
            <GlassCard intensity="strong" padding="none" style={[styles.menuContent, { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden' }]}>
              {/* Header */}
              <View style={styles.menuSelectorHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <Feather name="more-vertical" size={18} color={Colors.accent.primary} />
                  <Text style={styles.menuTitleText}>Track Options</Text>
                </View>
                <Pressable onPress={() => handleCloseAppearanceMenu()} hitSlop={8} style={styles.menuSelectorCloseBtn}>
                  <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              {/* Favourite row — adds/removes track in Comfort Box */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!currentTrack || isAppearanceMenuClosingRef.current) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const wasFav = isCurrentFav;
                  handleCloseAppearanceMenu(() => {
                    toggleFavorite(currentTrack);
                    showPlayerToast(wasFav ? 'Removed from Comfort Box' : 'Added to Comfort Box');
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather
                    name="heart"
                    size={18}
                    color={isCurrentFav ? '#F472B6' : '#FFF'}
                    fill={isCurrentFav ? '#F472B6' : 'transparent'}
                  />
                </View>
                <Text style={[styles.menuOptionText, isCurrentFav && { color: '#F472B6' }]}>
                  {isCurrentFav ? 'Remove from Comfort Box' : 'Add to Comfort Box'}
                </Text>
              </Pressable>

              {/* Add to Spotify Playlist (if Spotify song or connected) */}
              {(currentTrack.category === 'spotify' || currentTrack.url?.startsWith('spotify:') || currentTrack.id?.startsWith('spotify_') || isSpotify) && (
                <Pressable
                  style={styles.menuOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleCloseAppearanceMenu(() => {
                      onAddToPlaylist?.({
                        id: currentTrack.id,
                        title: currentTrack.title,
                        artist: currentTrack.artist,
                        cover: currentTrack.cover,
                        uri: currentTrack.url?.startsWith('spotify:')
                          ? currentTrack.url
                          : `spotify:track:${currentTrack.id.replace('spotify_', '')}`,
                      });
                    });
                  }}
                >
                  <View style={styles.menuOptionIconSlot}>
                    <Feather name="folder-plus" size={18} color="#1DB954" />
                  </View>
                  <Text style={[styles.menuOptionText, { color: '#1DB954' }]}>Add to Spotify Playlist</Text>
                </Pressable>
              )}

              <View style={styles.menuDivider} />

              {/* Player Appearance sub-section label */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
                <Feather name="layout" size={14} color={Colors.accent.primary} />
                <Text style={[styles.menuTitleText, { fontSize: 13 }]}>Player Appearance</Text>
              </View>

              <View style={{ flexDirection: 'row', padding: Spacing.md, gap: Spacing.md }}>
                {/* Vinyl Disc Mode Option */}
                <Pressable
                  style={[
                    styles.appearanceGridCard,
                    playerViewMode === 'vinyl' && styles.activeAppearanceGridCard,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPlayerViewMode('vinyl');
                    handleCloseAppearanceMenu();
                  }}
                >
                  <View style={[
                    styles.appearanceGridIcon,
                    playerViewMode === 'vinyl' && styles.activeAppearanceGridIcon,
                  ]}>
                    <Feather name="disc" size={24} color={playerViewMode === 'vinyl' ? Colors.accent.primary : '#FFFFFF'} />
                  </View>
                  <Text style={[
                    styles.appearanceGridText,
                    playerViewMode === 'vinyl' && styles.activeAppearanceGridText,
                  ]}>
                    Vinyl Disc View
                  </Text>
                  {playerViewMode === 'vinyl' && (
                    <View style={styles.activeCheckBadge}>
                      <Feather name="check" size={12} color="#000000" />
                    </View>
                  )}
                </Pressable>

                {/* Full Poster Mode Option */}
                <Pressable
                  style={[
                    styles.appearanceGridCard,
                    playerViewMode === 'poster' && styles.activeAppearanceGridCard,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPlayerViewMode('poster');
                    handleCloseAppearanceMenu();
                  }}
                >
                  <View style={[
                    styles.appearanceGridIcon,
                    playerViewMode === 'poster' && styles.activeAppearanceGridIcon,
                  ]}>
                    <Feather name="image" size={24} color={playerViewMode === 'poster' ? Colors.accent.primary : '#FFFFFF'} />
                  </View>
                  <Text style={[
                    styles.appearanceGridText,
                    playerViewMode === 'poster' && styles.activeAppearanceGridText,
                  ]}>
                    Full Poster View
                  </Text>
                  {playerViewMode === 'poster' && (
                    <View style={styles.activeCheckBadge}>
                      <Feather name="check" size={12} color="#000000" />
                    </View>
                  )}
                </Pressable>
              </View>
            </GlassCard>
          </RNAnimated.View>
        </RNAnimated.View>
      </Modal>

      {/* Toast Notification for PlayerView */}
      {playerToastMsg && (
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: insets.bottom + 80,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 999999,
            opacity: playerToastOpacity,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(30, 30, 36, 0.95)',
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: playerToastType === 'error'
                ? 'rgba(255, 107, 107, 0.25)'
                : playerToastType === 'warning'
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
              maxWidth: '85%',
            }}
          >
            <Feather
              name={playerToastType === 'success' ? 'check-circle' : 'alert-circle'}
              size={14}
              color={playerToastType === 'error'
                ? Colors.error
                : playerToastType === 'warning'
                  ? Colors.warning
                  : Colors.accent.primary}
            />
            <Text style={{ color: '#FFFFFF', fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.caption, flexShrink: 1 }}>
              {playerToastMsg}
            </Text>
          </View>
        </RNAnimated.View>
      )}
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
  onTrackPress: (track: Track, index: number) => void;
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
  onTrackPress,
}: QueueItemProps) => {
  // Ref to capture latest props for PanResponder closure safety
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
        {
          // Only translateY for the dragged item
          transform: isDragging
            ? [{ translateY: dragY }]
            : [],
          zIndex: isDragging ? 999 : 1,
          opacity: isDragging ? 0.95 : 1,
        },
        isDragging && styles.draggingQueueItemRow,
      ]}
    >
      <Pressable
        onPress={() => onTrackPress(track, index)}
        style={({ pressed }) => [styles.queueItemMainBtn, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.queueItemCoverWrapper}>
          <MusicCover cover={track.cover} style={styles.queueItemCover} iconSize={14} borderRadius={8} />
          {isCurrent && (
            <View style={styles.queueItemPlayingBadge}>
              <Feather name="volume-2" size={10} color="#000000" />
            </View>
          )}
        </View>

        <View style={styles.queueItemInfo}>
          <Text numberOfLines={1} style={[styles.queueItemTitle, isCurrent && styles.activeQueueItemText]}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={[styles.queueItemArtist, isCurrent && styles.activeQueueItemSubText]}>
            {track.artist}
          </Text>
        </View>
      </Pressable>

      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.queueItemDragHandle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather
          name="menu"
          size={16}
          color={isDragging ? '#1DB954' : isCurrent ? 'rgba(29, 185, 84, 0.85)' : 'rgba(255, 255, 255, 0.35)'}
        />
      </View>
    </RNAnimated.View>
  );
});
QueueItem.displayName = 'QueueItem';

const QueuePopup = React.memo(({ onClose }: { onClose: () => void }) => {
  const { queue, currentTrack, currentIndex, setQueue, syncReorderedQueue, isQueueRecommended, play, pause, resume, isPlaying } = useMusic();

  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const COMPACT_HEIGHT = Math.min(390, Math.round(SCREEN_HEIGHT * 0.52));
  const EXPANDED_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.78), 640);

  const [isExpanded, setIsExpanded] = useState(false);

  // Reanimated shared value for height layout resizing on native UI thread
  const sheetHeight = useSharedValue(COMPACT_HEIGHT);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      height: sheetHeight.value,
    };
  });

  // Entrance and Exit Slide and Opacity anims (using SCREEN_HEIGHT to ensure complete slide out)
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT + 100)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      RNAnimated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT + 100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose, SCREEN_HEIGHT]);

  const toggleHeight = useCallback(() => {
    const nextState = !isExpanded;
    const target = nextState ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
    sheetHeight.value = withSpring(target, {
      damping: 22,
      stiffness: 160,
    });
    setIsExpanded(nextState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isExpanded, EXPANDED_HEIGHT, COMPACT_HEIGHT, sheetHeight]);

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

  // Sync queue to local state (only on external queue changes, skip during active drag)
  useEffect(() => {
    if (stateRef.current.draggedIndex !== null) return;
    setLocalQueue(queue.map((track, idx) => ({
      track,
      key: `${track.id}_${idx}`
    })));
  }, [queue]);

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

    const itemHeight = 66;
    const swapThreshold = itemHeight * 0.5;
    const scrollDelta = scrollOffsetRef.current - initialScrollOffsetRef.current;
    const relativeDy = dy + scrollDelta;
    const currentDisplacement = relativeDy - dragOffsetRef.current;

    // Update the dragged item's visual position
    dragYVal.setValue(currentDisplacement);

    // Check if we should swap with the neighbor below
    if (currentDisplacement > swapThreshold && activeIdx < activeQueue.length - 1) {
      const nextIdx = activeIdx + 1;
      const updated = [...activeQueue];
      [updated[activeIdx], updated[nextIdx]] = [updated[nextIdx], updated[activeIdx]];

      // Update refs synchronously BEFORE React render so next move event reads correct state
      stateRef.current.localQueue = updated;
      stateRef.current.draggedIndex = nextIdx;

      // LayoutAnimation affects ONLY non-dragged items
      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setLocalQueue(updated);
      setDraggedIndex(nextIdx);

      // Adjust offset so the dragged item doesn't jump when its index changes
      dragOffsetRef.current += itemHeight;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Check if we should swap with the neighbor above
    else if (currentDisplacement < -swapThreshold && activeIdx > 0) {
      const prevIdx = activeIdx - 1;
      const updated = [...activeQueue];
      [updated[activeIdx], updated[prevIdx]] = [updated[prevIdx], updated[activeIdx]];

      stateRef.current.localQueue = updated;
      stateRef.current.draggedIndex = prevIdx;

      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setLocalQueue(updated);
      setDraggedIndex(prevIdx);

      dragOffsetRef.current -= itemHeight;

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

    // Instant drop — item is already at the correct index from live swaps
    dragYVal.setValue(0);
    dragOffsetRef.current = 0;

    // Cancel any pending LayoutAnimation from the last swap so the release layout change is instant
    LayoutAnimation.configureNext({
      duration: 0,
      update: { type: LayoutAnimation.Types.linear, property: LayoutAnimation.Properties.opacity },
    });

    // Clear drag state immediately
    const updated = stateRef.current.localQueue;
    setDraggedIndex(null);

    // Defer heavy global context sync so the drag styling clears first
    setTimeout(() => {
      const syncedTracks = updated.map(i => i.track);
      let newIndex = 0;
      if (currentTrack) {
        newIndex = syncedTracks.findIndex(t => t.id === currentTrack.id);
      }
      setQueue(syncedTracks, newIndex === -1 ? 0 : newIndex);
      syncReorderedQueue();
    }, 0);
  }, [dragYVal, currentTrack, setQueue, syncReorderedQueue]);

  const handleQueueTrackClick = useCallback((clickedTrack: Track, clickedIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentTrack?.id === clickedTrack.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    // Preserve current queue tracks: move clicked track to position 0 (Now Playing) without deleting any tracks
    const filtered = queue.filter(t => t.id !== clickedTrack.id);
    const newQueue = [clickedTrack, ...filtered];

    // Update local queue state live
    const updatedLocal = newQueue.map((track, idx) => ({
      track,
      key: `${track.id}_${idx}`
    }));
    setLocalQueue(updatedLocal);
    stateRef.current.localQueue = updatedLocal;

    setQueue(newQueue, 0);
    syncReorderedQueue();
    play(clickedTrack, undefined, clickedTrack.url, undefined, true, false);
  }, [currentTrack?.id, isPlaying, pause, resume, queue, setQueue, syncReorderedQueue, play]);

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
        onTrackPress={handleQueueTrackClick}
      />
    );
  }, [currentTrack?.id, draggedIndex, dragYVal, handleDragStart, handleDragMove, handleDragEnd, handleQueueTrackClick]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 66,
    offset: 66 * index + 6,
    index,
  }), []);

  return (
    <View style={styles.queuePopupBackdropOverlay}>
      {/* Backdrop with Fade In/Out */}
      <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <View style={styles.queueBackdropBg} />
        </Pressable>
      </RNAnimated.View>
      {/* Slide-up / Draggable Sheet Container */}
      <RNAnimated.View
        style={[
          styles.queueSheetContainer,
          {
            transform: [{ translateY: slideAnim }]
          }
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.queuePopupCard, animatedCardStyle]}>
          {/* Top Drag Handle Bar */}
          <Pressable onPress={toggleHeight} style={styles.queueTopHandleBar} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <View style={styles.queueDragHandlePill} />
          </Pressable>

          {/* Header */}
          <View style={styles.queueHeaderRow}>
            <View style={styles.queueHeaderLeft}>
              <View style={styles.queueIconBadge}>
                <Feather name="list" size={16} color="#1DB954" />
              </View>
              <View style={styles.queueHeaderTitles}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.queueTitleText}>Play Queue</Text>
                  {isQueueRecommended && (
                    <View style={styles.queueRecommendedBadge}>
                      <Text style={styles.queueRecommendedBadgeText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.queueSubtitleText}>
                  {localQueue.length} {localQueue.length === 1 ? 'track' : 'tracks'} • Drag to reorder
                </Text>
              </View>
            </View>

            <Pressable onPress={handleClose} hitSlop={8} style={styles.queueCloseBtn}>
              <Feather name="x" size={16} color="rgba(255, 255, 255, 0.7)" />
            </Pressable>
          </View>

          <View style={styles.queueHeaderDivider} />

          {localQueue.length === 0 ? (
            <View style={styles.queueEmptyContainer}>
              <View style={styles.queueEmptyIconCircle}>
                <Feather name="music" size={24} color="#1DB954" />
              </View>
              <Text style={styles.queueEmptyTitle}>Queue is empty</Text>
              <Text style={styles.queueEmptySubtitle}>Play a song from categories or Spotify to build your queue.</Text>
            </View>
          ) : (
            <View ref={listContainerRef} style={styles.queueListWrapper} collapsable={false}>
              <FlatList
                ref={flatListRef}
                data={localQueue}
                keyExtractor={(item) => item.key}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                style={styles.queueList}
                showsVerticalScrollIndicator={true}
                scrollEnabled={draggedIndex === null}
                contentContainerStyle={styles.queueListContent}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={5}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={() => { }}
              />
            </View>
          )}
        </Animated.View>
      </RNAnimated.View>
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

const SpotifySettingsPopup = React.memo(({
  onClose,
  cacheSize,
  clearCache,
}: {
  onClose: () => void;
  cacheSize: string;
  clearCache: () => void;
}) => {
  const handleClearCache = useCallback(() => {
    clearCache();
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
            <Text style={styles.menuTitleText}>Spotify Settings</Text>
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
                  <Text style={styles.settingsDesc}>Stored playlists cache size: {cacheSize}</Text>
                </View>
              </View>
              {cacheSize !== '0 KB' && cacheSize !== '0.0 KB' ? (
                <Pressable style={styles.settingsBtn} onPress={handleClearCache}>
                  <Text style={styles.settingsBtnText}>Clean</Text>
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

SpotifySettingsPopup.displayName = 'SpotifySettingsPopup';


export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, Spacing.lg);
  const params = useLocalSearchParams<{ view?: string }>();

  const {
    currentTrack,
    isPlaying,
    play,
    pause,
    resume,
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
  const dataVersion = useAppStore((s) => s.dataVersion);

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

  // Spotify Add to Playlist Modal states
  const [showSpotifyPlaylistModal, setShowSpotifyPlaylistModal] = useState(false);
  const [spotifyPlaylistTargetTrack, setSpotifyPlaylistTargetTrack] = useState<SpotifyTrackTarget | null>(null);

  const handleOpenSpotifyPlaylistModal = useCallback((target: SpotifyTrackTarget) => {
    setSpotifyPlaylistTargetTrack(target);
    setShowSpotifyPlaylistModal(true);
  }, []);

  // Modal / Options Menu internal states
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuSlideAnim = useRef(new RNAnimated.Value(220)).current;
  const menuOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  const prevShowMenuRef = useRef(false);
  const isMenuClosingRef = useRef(false);
  const lastMenuCloseTimeRef = useRef(0);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined);

  const isMenuTrackComfort = useMemo(() => {
    if (!menuTrack) return false;
    const id1 = menuTrack.id;
    const id2 = id1.startsWith('spotify_') ? id1.replace('spotify_', '') : `spotify_${id1}`;
    return favorites.includes(id1) || favorites.includes(id2) || isTrackComfort(id1) || isTrackComfort(id2);
  }, [menuTrack, favorites, dataVersion]);

  useEffect(() => {
    if (showMenu && !prevShowMenuRef.current) {
      menuSlideAnim.setValue(220);
      menuOpacityAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(menuOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.spring(menuSlideAnim, {
          toValue: 0,
          tension: 75,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevShowMenuRef.current = showMenu;
  }, [showMenu, menuSlideAnim, menuOpacityAnim]);

  const handleMorePress = useCallback((track: Track, fromPlaylistId?: string) => {
    if (Date.now() - lastMenuCloseTimeRef.current < 450) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isMenuClosingRef.current = false;
    setMenuTrack(track);
    setActivePlaylistId(fromPlaylistId);
    setShowMenu(true);
  }, []);

  const handleCloseMenu = useCallback((onComplete?: () => void) => {
    if (isMenuClosingRef.current) return;
    isMenuClosingRef.current = true;
    lastMenuCloseTimeRef.current = Date.now();

    RNAnimated.parallel([
      RNAnimated.timing(menuOpacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      RNAnimated.timing(menuSlideAnim, {
        toValue: 220,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowMenu(false);
      setMenuTrack(null);
      isMenuClosingRef.current = false;
      if (onComplete) onComplete();
    });
  }, [menuOpacityAnim, menuSlideAnim]);

  // Internal navigation state
  const [view, setView] = useState<'categories' | 'list' | 'recommended' | 'player'>(
    params.view === 'recommended' ? 'recommended' : 'categories'
  );
  const previousViewRef = useRef<'categories' | 'list' | 'recommended'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string>('midnight');
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string>('Midnight Vibes');

  // Sync route params with view
  useEffect(() => {
    if (params.view === 'recommended') {
      previousViewRef.current = 'categories';
      setView('recommended');
    }
  }, [params.view]);

  // New states for popup modals
  const [showQueuePopup, setShowQueuePopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  // Spotify Cache Settings states
  const [showSpotifySettings, setShowSpotifySettings] = useState(false);
  const [spotifyCacheSize, setSpotifyCacheSize] = useState('0 KB');

  const updateSpotifyCacheSize = useCallback(async () => {
    try {
      if (SPOTIFY_CACHE_FILE.exists) {
        const size = SPOTIFY_CACHE_FILE.size;
        const kb = size / 1024;
        if (kb === 0) setSpotifyCacheSize('0 KB');
        else if (kb < 1024) setSpotifyCacheSize(`${kb.toFixed(1)} KB`);
        else setSpotifyCacheSize(`${(kb / 1024).toFixed(1)} MB`);
      } else {
        setSpotifyCacheSize('0 KB');
      }
    } catch (e) {
      setSpotifyCacheSize('0 KB');
    }
  }, []);

  const handleOpenSpotifySettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSpotifyCacheSize();
    setShowSpotifySettings(true);
  }, [updateSpotifyCacheSize]);

  const handleClearSpotifyCache = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      if (SPOTIFY_CACHE_FILE.exists) {
        await SPOTIFY_CACHE_FILE.delete();
      }
      spotifyPlaylistCache = {};
    } catch (e) {
      console.warn('[MusicScreen] Failed to delete Spotify cache:', e);
    }
    updateSpotifyCacheSize();
  }, [updateSpotifyCacheSize]);

  // Sorting state
  const [sortBy, setSortBy] = useState<'default' | 'titleAsc' | 'titleDesc' | 'dateNewest' | 'dateOldest'>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const viewIndex = useSharedValue(params.view === 'recommended' ? 1 : 0);
  // Flag: when 1, the list view stays hidden during direct categories↔player jumps
  const skipListView = useSharedValue(0);

  // State representing the active view (only updates after transition completes, or instantly on exit)
  const [activeView, setActiveView] = useState<'categories' | 'list' | 'recommended' | 'player'>(
    params.view === 'recommended' ? 'recommended' : 'categories'
  );

  useEffect(() => {
    let target = 0;
    if (view === 'categories') target = 0;
    else if (view === 'list' || view === 'recommended') target = 1;
    else if (view === 'player') target = 2;

    // Immediately update activeView when entering the list/recommended layer or staying on categories.
    if (view === 'list' || view === 'recommended') {
      setActiveView(view);
    } else if (view === 'categories' && (activeView === 'categories' || activeView === 'player')) {
      // Only set immediately if we weren't coming from list/recommended
      setActiveView(view);
    }

    // Detect direct jumps that skip the list layer (categories↔player)
    const currentVal = viewIndex.value;
    const isDirectJump = (currentVal <= 0.1 && target === 2) || (currentVal >= 1.9 && target === 0);
    if (isDirectJump) {
      skipListView.value = 1;
    }

    const onFinish = (finished?: boolean) => {
      'worklet';
      if (finished) {
        skipListView.value = 0;
        runOnJS(setActiveView)(view);
      }
    };

    if (viewIndex.value >= 1.9 && target < 2) {
      // Exiting Player View: Use crisp, smooth timing transition with zero spring tail crawl
      viewIndex.value = withTiming(target, {
        duration: 260,
        easing: Easing.out(Easing.quad),
      }, onFinish);
    } else {
      viewIndex.value = withSpring(target, {
        damping: 24,
        stiffness: 140,
        mass: 0.8,
      }, onFinish);
    }
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
    // Hide the list container entirely during direct categories↔player transitions
    if (skipListView.value === 1) {
      return {
        transform: [{ translateX: SCREEN_WIDTH }, { scale: 1 }],
        opacity: 0,
        position: 'absolute',
        top: paddingTop,
        left: SCREEN_PADDING,
        right: SCREEN_PADDING,
        bottom: 0,
        display: 'none',
      };
    }
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
        const prev = previousViewRef.current;
        // If previous was 'list' but no category was explicitly selected, skip to categories
        if (prev === 'list' && selectedCategory === 'midnight' && activeCategoryLabel === 'Midnight Vibes') {
          setView('categories');
        } else {
          setView(prev);
        }
        return true;
      } else if (view === 'list' || view === 'recommended') {
        setView('categories');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [view, selectedCategory, activeCategoryLabel]);

  const handleCategoryPress = useCallback((cat: string, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    setActiveCategoryLabel(label);
    previousViewRef.current = 'list';
    setView('list');
  }, []);

  const handleOpenRecommended = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    previousViewRef.current = 'categories';
    setView('recommended');
  }, []);

  const handleTrackPress = useCallback((track: Track, tracksInCat: Track[], isShuffle?: boolean, contextUri?: string, offsetUri?: string, _isFromSearch?: boolean) => {
    if (view !== 'player') {
      previousViewRef.current = view;
    }
    if (!isShuffle && currentTrack?.id === track.id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }
    const idx = tracksInCat.findIndex(t => t.id === track.id);
    const slicedTracks = idx !== -1 ? tracksInCat.slice(idx) : [track];
    setQueue(slicedTracks, 0);
    play(track, contextUri, offsetUri, isShuffle, undefined, _isFromSearch);
    setView('player');
  }, [play, setQueue, currentTrack?.id, isPlaying, pause, resume, view]);

  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (view === 'player') {
      // Go back to whichever view was open before the player
      const prev = previousViewRef.current;
      // If previous was 'list' but no category was explicitly selected, skip to categories
      if (prev === 'list' && selectedCategory === 'midnight' && activeCategoryLabel === 'Midnight Vibes') {
        setView('categories');
      } else {
        setView(prev);
      }
    } else if (view === 'list' || view === 'recommended') {
      setView('categories');
    } else {
      router.back();
    }
  }, [view, selectedCategory, activeCategoryLabel]);

  const handleShowQueue = useCallback(() => {
    setShowQueuePopup(true);
  }, []);

  const handleShowSettings = useCallback(() => {
    setShowSettingsPopup(true);
  }, []);

  const handleMiniPlayerPress = useCallback(() => {
    if (view !== 'player') {
      previousViewRef.current = view;
    }
    setView('player');
  }, [view]);

  return (
    <GradientBackground variant="glow">
      <Animated.View style={[StyleSheet.absoluteFill, playerBgStyle]} pointerEvents="none">
        <PlayerBackground currentTrack={currentTrack} />
      </Animated.View>
      <View style={[styles.mainContainer, { paddingTop }]}>
        <Animated.View style={categoriesStyle} pointerEvents={view === 'categories' ? 'auto' : 'none'}>
          <CategoriesView
            onCategoryPress={handleCategoryPress}
            onSettingsPress={handleShowSettings}
            onTrackPress={handleTrackPress}
            onOpenRecommended={handleOpenRecommended}
          />
        </Animated.View>
        <Animated.View style={listStyle} pointerEvents={(view === 'list' || view === 'recommended') ? 'auto' : 'none'}>
          {(activeView === 'recommended' || view === 'recommended') ? (
            <RecommendedListView
              onGoBack={handleGoBack}
              onTrackPress={handleTrackPress}
              onSettingsPress={handleOpenSpotifySettings}
              onShowQueue={handleShowQueue}
              onAddToPlaylist={handleOpenSpotifyPlaylistModal}
            />
          ) : selectedCategory === 'spotify' ? (
            <SpotifyListView
              onGoBack={handleGoBack}
              onTrackPress={handleTrackPress}
              onSettingsPress={handleOpenSpotifySettings}
              onShowQueue={handleShowQueue}
              onAddToPlaylist={handleOpenSpotifyPlaylistModal}
            />
          ) : (
            <ListView
              category={selectedCategory}
              categoryLabel={activeCategoryLabel}
              onGoBack={handleGoBack}
              onTrackPress={handleTrackPress}
              onMorePress={handleMorePress}
              sortBy={sortBy}
              setShowSortMenu={setShowSortMenu}
              onShowQueue={handleShowQueue}
            />
          )}
        </Animated.View>
        <Animated.View style={playerStyle} pointerEvents={view === 'player' ? 'auto' : 'none'}>
          <PlayerView
            onGoBack={handleGoBack}
            onShowQueue={handleShowQueue}
            isPlayerActive={view === 'player' && activeView === 'player' && !showQueuePopup}
            onAddToPlaylist={handleOpenSpotifyPlaylistModal}
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
      <Modal
        visible={showMenu && !!menuTrack}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => handleCloseMenu()}
      >
        <RNAnimated.View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end', opacity: menuOpacityAnim }}>
          {/* Backdrop touch area */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCloseMenu()} />

          {/* Menu content */}
          <RNAnimated.View
            style={{
              width: '100%',
              paddingHorizontal: 14,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: menuSlideAnim }],
            }}
            pointerEvents="box-none"
          >
            <GlassCard intensity="strong" padding="none" style={[styles.menuContent, { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden' }]}>
              {/* Header */}
              <View style={styles.menuHeader}>
                <MusicCover cover={menuTrack?.cover || ''} style={styles.menuTrackCover} iconSize={12} borderRadius={10} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.menuTrackTitle}>{menuTrack?.title}</Text>
                  <Text numberOfLines={1} style={styles.menuTrackArtist}>{menuTrack?.artist}</Text>
                </View>
              </View>

              <View style={styles.menuDivider} />

              {/* Add to Queue */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (currentTrack && currentTrack.category !== menuTrack?.category) {
                    handleCloseMenu();
                    showToast('Cannot mix categories in queue', 'warning');
                  } else if (menuTrack) {
                    addToQueue(menuTrack);
                    handleCloseMenu();
                    showToast('Added to Queue');
                  }
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="plus-circle" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuOptionText}>Add to Queue</Text>
              </Pressable>

              {/* Add/Remove Comfort Box */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  if (!menuTrack || isMenuClosingRef.current) return;
                  const target = menuTrack;
                  const wasFav = isMenuTrackComfort;
                  handleCloseMenu(() => {
                    toggleFavorite(target);
                    showToast(wasFav ? 'Removed from Comfort Box' : 'Added to Comfort Box');
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather
                    name="heart"
                    size={18}
                    color={isMenuTrackComfort ? '#F472B6' : "#FFF"}
                    fill={isMenuTrackComfort ? '#F472B6' : "transparent"}
                  />
                </View>
                <Text style={[styles.menuOptionText, isMenuTrackComfort && { color: '#F472B6' }]}>
                  {isMenuTrackComfort ? 'Remove from Comfort Box' : 'Add to Comfort Box'}
                </Text>
              </Pressable>

              {/* Add to Playlist */}
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  handleCloseMenu(() => {
                    setShowPlaylistSelector(true);
                  });
                }}
              >
                <View style={styles.menuOptionIconSlot}>
                  <Feather name="folder-plus" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuOptionText}>Add to Playlist</Text>
              </Pressable>

              {/* Conditional: Remove from Playlist (only if opened from inside a playlist) */}
              {activePlaylistId !== undefined && menuTrack && (
                <Pressable
                  style={[styles.menuOption, { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' }]}
                  onPress={async () => {
                    await removeTrackFromPlaylist(activePlaylistId, menuTrack.id);
                    handleCloseMenu();
                    showToast('Removed from Playlist');
                  }}
                >
                  <View style={styles.menuOptionIconSlot}>
                    <Feather name="x-circle" size={18} color={Colors.error} />
                  </View>
                  <Text style={[styles.menuOptionText, { color: Colors.error }]}>Remove from Playlist</Text>
                </Pressable>
              )}
            </GlassCard>
          </RNAnimated.View>
        </RNAnimated.View>
      </Modal>

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
      {showSpotifySettings && (
        <SpotifySettingsPopup
          onClose={() => setShowSpotifySettings(false)}
          cacheSize={spotifyCacheSize}
          clearCache={handleClearSpotifyCache}
        />
      )}
      {/* 5b. Spotify Add to Playlist Modal */}
      <AddToSpotifyPlaylistModal
        visible={showSpotifyPlaylistModal}
        onClose={() => setShowSpotifyPlaylistModal(false)}
        track={spotifyPlaylistTargetTrack}
        onSuccess={(plName) => showToast(`Added to "${plName}"`)}
      />
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
  spotifyPremiumCard: {
    borderWidth: 1.5,
    borderColor: '#FFD166',
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  spotifyPremiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 209, 102, 0.25)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD166',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotifyPremiumBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#FFD166',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  waveformBar: {
    width: 4.5,
    borderRadius: 2.25,
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
  menuOptionIconSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  activePlaylistItemCard: {
    borderColor: 'rgba(29, 185, 84, 0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
  },
  activePlaylistItemName: {
    color: '#1DB954',
  },
  activePlaylistItemCount: {
    color: 'rgba(29, 185, 84, 0.7)',
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
  queuePopupCard: {
    backgroundColor: '#0E1210',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 14,
  },
  queueTopHandleBar: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueDragHandlePill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    paddingBottom: Spacing.sm,
  },
  queueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  queueIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(29, 185, 84, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueHeaderTitles: {
    flex: 1,
  },
  queueTitleText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 1,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  queueSubtitleText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption - 1,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  queueRecommendedBadge: {
    backgroundColor: 'rgba(29, 185, 84, 0.16)',
    borderColor: 'rgba(29, 185, 84, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  queueRecommendedBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9,
    color: '#1DB954',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queueCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueHeaderDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginHorizontal: Spacing.lg,
    marginBottom: 6,
  },
  queueListWrapper: {
    flex: 1,
  },
  queueList: {
    flex: 1,
  },
  queueListContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    gap: 8,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: Radius.card,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 10,
    height: 58,
  },
  activeQueueItemRow: {
    backgroundColor: 'rgba(29, 185, 84, 0.13)',
    borderColor: 'rgba(29, 185, 84, 0.45)',
  },
  draggingQueueItemRow: {
    backgroundColor: 'rgba(29, 185, 84, 0.22)',
    borderColor: 'rgba(29, 185, 84, 0.7)',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  queueItemMainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  queueItemCoverWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  queueItemCover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#181A1B',
  },
  queueItemPlayingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0E1210',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall + 0.5,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  activeQueueItemText: {
    color: '#1DB954',
    fontFamily: Fonts.bodyBold,
  },
  queueItemArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 0.5,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  activeQueueItemSubText: {
    color: 'rgba(29, 185, 84, 0.8)',
  },
  queueItemDragHandle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  queueSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  queueEmptyContainer: {
    flex: 1,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueEmptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  queueEmptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  queueEmptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
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

  // Music Recs Styles
  musicRecsSection: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  musicRecsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  musicRecsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flex: 1,
    marginRight: Spacing.xs,
  },
  musicRecsTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  musicRecsMoodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  musicRecsMoodText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  musicRecsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flexShrink: 0,
  },
  musicRecsRefreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  musicRecsBottomSeeAllButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#8DE91D',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    marginTop: Spacing.md + 2,
  },
  musicRecsBottomSeeAllText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#03070E',
    letterSpacing: 0.3,
  },
  spotifyGateCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(18, 22, 28, 0.75)',
  },
  spotifyGateIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.35)',
    marginBottom: Spacing.md,
  },
  spotifyGateTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
    fontWeight: '700',
  },
  spotifyGateSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  spotifyGateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFD166',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    minWidth: 200,
  },
  spotifyGateButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#03070E',
    letterSpacing: 0.3,
  },
  musicRecCard: {
    width: 90,
    alignItems: 'center',
  },
  musicRecCoverWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  musicRecCoverImg: {
    width: '100%',
    height: '100%',
  },
  musicRecTrackTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  musicRecTrackArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    textAlign: 'center',
    width: '100%',
    marginTop: 1,
  },
  cardTitleSm: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },

  // Full Poster & Appearance Modal Styles
  posterBackgroundContainer: {
    position: 'absolute',
    left: -SCREEN_PADDING,
    right: -SCREEN_PADDING,
    zIndex: -1,
    overflow: 'hidden',
  },
  posterBgImage: {
    width: '100%',
    height: '100%',
  },
  posterGradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  posterArtworkSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  posterArtworkCard: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72,
    maxWidth: 320,
    maxHeight: 320,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(20, 22, 30, 0.6)',
  },
  posterArtworkImg: {
    width: '100%',
    height: '100%',
  },
  posterGlassCardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(12, 14, 22, 0.55)' : 'rgba(14, 16, 26, 0.88)',
    paddingVertical: Spacing.md,
  },
  glassIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 18, 26, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassHeaderBadge: {
    backgroundColor: 'rgba(16, 18, 26, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  appearanceGridCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    gap: Spacing.sm,
  },
  activeAppearanceGridCard: {
    backgroundColor: 'rgba(141, 233, 29, 0.12)',
    borderColor: Colors.accent.primary,
  },
  appearanceGridIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAppearanceGridIcon: {
    backgroundColor: 'rgba(141, 233, 29, 0.2)',
  },
  appearanceGridText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  activeAppearanceGridText: {
    fontFamily: Fonts.bodyBold,
    color: '#FFFFFF',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedMoodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  recommendedMoodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedMoodTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: '#0A0A0C',
  },
  recommendedMoodSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: 'rgba(10, 10, 12, 0.75)',
    marginTop: 2,
  },
  recommendedMoodBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  recommendedMoodBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#0A0A0C',
  },
  recommendedTrackItem: {
    height: 78,
    borderRadius: 18,
  },
  recommendedTrackItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 14,
  },
  recommendedTrackCover: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.background.elevated,
    marginRight: 12,
  },
  recommendedTrackDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  recommendedTrackName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  recommendedTrackArtist: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 1,
  },
  recommendedTrackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 8,
  },
  recommendedTrackDuration: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  recommendedReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  recommendedReasonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
});

