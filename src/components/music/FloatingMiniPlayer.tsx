import { Feather } from '@expo/vector-icons';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/layout';
import { Fonts, FontSizes } from '../../constants/typography';
import { useMusic, usePlaybackTime } from '../../context/MusicContext';
import { useSpotify } from '../../hooks/useSpotify';
import { usePlaybackRotation } from '../../hooks/usePlaybackRotation';
import { GlassCard } from '../ui';
import { MusicCover } from './MusicCover';

const AVATAR_SIZE = 38;

// Extracted progress ring — sole consumer of usePlaybackTime() to isolate
// high-frequency re-renders (~4×/sec) from the rest of the mini player
export const MiniPlayerProgressRing = React.memo(({ size = AVATAR_SIZE }: { size?: number }) => {
  const { currentTime, duration } = usePlaybackTime();
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const radius = size / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;
  const accentColor = Colors.accent.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size + 8} height={size + 8}>
          {/* Background circle track */}
          <Circle
            cx={(size + 8) / 2}
            cy={(size + 8) / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={2}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={(size + 8) / 2}
            cy={(size + 8) / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={2}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90, ${(size + 8) / 2}, ${(size + 8) / 2})`}
          />
        </Svg>
      </View>
    </View>
  );
});
MiniPlayerProgressRing.displayName = 'MiniPlayerProgressRing';

export interface FloatingMiniPlayerProps {
  onPress?: () => void;
  style?: any;
  /** A quieter footprint for screens that already have a floating control surface. */
  compact?: boolean;
  /** Visual theme variant: 'spotify' uses the liquid-glass dark theme matching the Spotify section. */
  variant?: 'default' | 'spotify';
}

export const FloatingMiniPlayer = React.memo(({
  onPress,
  style,
  compact = false,
  variant = 'default',
}: FloatingMiniPlayerProps) => {
  const { currentTrack, isPlaying, pause, resume, next, prev } = useMusic();
  useSpotify();

  const isSpotify = currentTrack?.category === 'spotify';
  const isSpotifyVariant = variant === 'spotify' || isSpotify;
  const isTrackPlaying = isPlaying;
  const avatarSize = compact ? 32 : AVATAR_SIZE;
  const liquidGlassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  const rotation = usePlaybackRotation(isTrackPlaying);

  const animatedCoverStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Hide if no track is loaded
  if (!currentTrack) {
    return null;
  }

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isTrackPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleNext = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    next();
  };

  const handlePrev = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prev();
  };

  const handlePressPill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.push('/music');
    }
  };

  // Dedicated Spotify Liquid-Glass Variant (used inside Spotify playlists & Spotify view)
  if (isSpotifyVariant) {
    const cardContent = (
      <>
        {/* Left: Rotating Vinyl Disc + Concentric Progress Ring */}
        <View style={styles.spotifyArtworkContainer}>
          <MiniPlayerProgressRing size={44} />
          <View style={styles.spotifyDiscBacking} />
          <Animated.View style={[animatedCoverStyle, styles.spotifyRotatingDisc]}>
            <MusicCover
              cover={currentTrack.cover}
              style={{ width: '100%', height: '100%' }}
              iconSize={14}
              borderRadius={21}
            />
          </Animated.View>
          <View style={styles.spotifyCenterPin} />
        </View>

        {/* Center: Title & Artist */}
        <View style={styles.spotifyDetails}>
          <Text numberOfLines={1} style={styles.spotifyTitle}>
            {currentTrack.title || 'Unknown Track'}
          </Text>
          <Text numberOfLines={1} style={styles.spotifyArtist}>
            {currentTrack.artist || 'Unknown Artist'}
          </Text>
        </View>

        {/* Right: Transport Controls */}
        <View style={styles.spotifyControls}>
          <Pressable
            hitSlop={10}
            onPress={handlePrev}
            style={styles.spotifyCtrlBtn}
          >
            <Feather name="skip-back" size={16} color="rgba(255, 255, 255, 0.78)" />
          </Pressable>

          <Pressable
            hitSlop={10}
            onPress={handlePlayPause}
            style={styles.spotifyPlayBtn}
          >
            <Feather
              name={isTrackPlaying ? 'pause' : 'play'}
              size={18}
              color={Colors.text.onAccent}
              style={isTrackPlaying ? undefined : { marginLeft: 2.5 }}
            />
          </Pressable>

          <Pressable
            hitSlop={10}
            onPress={handleNext}
            style={styles.spotifyCtrlBtn}
          >
            <Feather name="skip-forward" size={16} color="rgba(255, 255, 255, 0.78)" />
          </Pressable>
        </View>
      </>
    );

    return (
      <View style={[styles.container, style]}>
        <Pressable
          onPress={handlePressPill}
          style={({ pressed }) => [
            styles.pressable,
            pressed && styles.pressed,
            { borderRadius: 34, overflow: 'hidden' }
          ]}
        >
          {liquidGlassAvailable ? (
            <GlassView
              glassEffectStyle="regular"
              tintColor="rgba(190, 255, 108, 0.22)"
              colorScheme="dark"
              style={styles.spotifyCard}
            >
              {cardContent}
            </GlassView>
          ) : (
            <View style={styles.spotifyCard}>
              {cardContent}
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  // Default Standard Mini Player (Categories & other sections)
  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={handlePressPill}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
          { borderRadius: 9999, overflow: 'hidden' }
        ]}
      >
        <GlassCard style={[styles.card, compact && styles.compactCard]} intensity="medium">
          {/* Track details */}
          <View style={[styles.details, compact && styles.compactDetails]}>
            <Text numberOfLines={1} style={[styles.title, compact && styles.compactTitle]}>
              {currentTrack.title}
            </Text>
            <Text numberOfLines={1} style={[styles.artist, compact && styles.compactArtist]}>
              {currentTrack.artist}
            </Text>
          </View>

          {/* Transport buttons */}
          <View style={[styles.controls, compact && styles.compactControls]}>
            <Pressable hitSlop={12} onPress={handlePrev} style={styles.controlBtn}>
              <Feather name="skip-back" size={15} color={Colors.text.secondary} />
            </Pressable>

            <Pressable hitSlop={12} onPress={handlePlayPause} style={[styles.controlBtn, styles.playToggle]}>
              <Feather
                name={isTrackPlaying ? 'pause' : 'play'}
                size={16}
                color={Colors.text.primary}
                style={isTrackPlaying ? undefined : { marginLeft: 2.5 }}
              />
            </Pressable>

            <Pressable hitSlop={12} onPress={handleNext} style={styles.controlBtn}>
              <Feather name="skip-forward" size={15} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Rotating Cover + Progress Ring */}
          <View style={[styles.artworkContainer, { width: avatarSize, height: avatarSize }]}>
            <MiniPlayerProgressRing size={avatarSize} />
            <View style={{ position: 'absolute', width: avatarSize - 4, height: avatarSize - 4, borderRadius: (avatarSize - 4) / 2, backgroundColor: '#1E1E24' }} />
            <Animated.View style={[animatedCoverStyle, { width: avatarSize - 4, height: avatarSize - 4 }]}>
              <MusicCover
                cover={currentTrack.cover}
                style={{ width: '100%', height: '100%' }}
                iconSize={14}
                borderRadius={(avatarSize - 4) / 2}
              />
            </Animated.View>
          </View>
        </GlassCard>
      </Pressable>
    </View>
  );
});

FloatingMiniPlayer.displayName = 'FloatingMiniPlayer';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 84, // Float above the floating tab bar (tab bar height is ~64px + padding)
    left: 14,
    right: 14,
    zIndex: 999,
  },
  pressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  // Spotify Liquid-Glass Theme
  spotifyCard: {
    width: '100%',
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 34,
    backgroundColor: 'rgba(18, 23, 15, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.26)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  spotifyArtworkContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spotifyDiscBacking: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#141A12',
  },
  spotifyRotatingDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  spotifyCenterPin: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#141A12',
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.45)',
  },
  spotifyDetails: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  spotifyTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.text.primary,
    marginBottom: 1,
  },
  spotifyArtist: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  spotifyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  spotifyCtrlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyPlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },

  // Standard Theme
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  compactCard: {
    minHeight: 54,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 0.5,
    borderColor: 'rgba(190, 255, 108, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  details: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  compactDetails: {
    paddingRight: 6,
  },
  title: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption + 1,
    color: Colors.text.primary,
    marginBottom: 1,
  },
  compactTitle: {
    fontSize: 11.5,
  },
  artist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: Colors.text.secondary,
  },
  compactArtist: {
    fontSize: 9.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginRight: Spacing.md,
  },
  compactControls: {
    gap: 7,
    marginRight: 9,
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  artworkContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cover: {
    width: AVATAR_SIZE - 4,
    height: AVATAR_SIZE - 4,
    borderRadius: (AVATAR_SIZE - 4) / 2,
    backgroundColor: Colors.background.elevated,
  },
});
