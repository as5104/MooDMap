import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useMusic, usePlaybackTime } from '../../context/MusicContext';
import { Colors } from '../../constants/colors';
import { Fonts, FontSizes } from '../../constants/typography';
import { Spacing } from '../../constants/layout';
import { GlassCard } from '../ui';
import * as Haptics from 'expo-haptics';
import { MusicCover } from './MusicCover';

const AVATAR_SIZE = 38;
const CIRCLE_RADIUS = 17;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// Extracted progress ring — sole consumer of usePlaybackTime() to isolate
// high-frequency re-renders (~4×/sec) from the rest of the mini player
const MiniPlayerProgressRing = React.memo(() => {
  const { currentTime, duration } = usePlaybackTime();
  const progress = duration > 0 ? currentTime / duration : 0;
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE - progress * CIRCLE_CIRCUMFERENCE;
  const accentColor = Colors.accent.primary;

  return (
    <Svg width={AVATAR_SIZE + 6} height={AVATAR_SIZE + 6} style={styles.progressSvg}>
      {/* Background circle track */}
      <Circle
        cx={(AVATAR_SIZE + 6) / 2}
        cy={(AVATAR_SIZE + 6) / 2}
        r={CIRCLE_RADIUS + 1}
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth={1.5}
        fill="transparent"
      />
      {/* Progress circle */}
      <Circle
        cx={(AVATAR_SIZE + 6) / 2}
        cy={(AVATAR_SIZE + 6) / 2}
        r={CIRCLE_RADIUS + 1}
        stroke={accentColor}
        strokeWidth={1.5}
        fill="transparent"
        strokeDasharray={CIRCLE_CIRCUMFERENCE}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90, ${(AVATAR_SIZE + 6) / 2}, ${(AVATAR_SIZE + 6) / 2})`}
      />
    </Svg>
  );
});
MiniPlayerProgressRing.displayName = 'MiniPlayerProgressRing';

interface FloatingMiniPlayerProps {
  onPress?: () => void;
  style?: any;
}

export const FloatingMiniPlayer = React.memo(({ onPress, style }: FloatingMiniPlayerProps) => {
  const { currentTrack, isPlaying, pause, resume, next, prev } = useMusic();
  
  const rotation = useSharedValue(0);

  // Animate rotating cover art when playing
  useEffect(() => {
    if (isPlaying) {
      rotation.value = rotation.value % 360;
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, {
          duration: 12000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }
  }, [isPlaying, rotation]);

  const animatedCoverStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Hide if no track is loaded
  if (!currentTrack) {
    return null;
  }

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleNext = (e: any) => {
    e.stopPropagation();
    next();
  };

  const handlePrev = (e: any) => {
    e.stopPropagation();
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
        <GlassCard style={styles.card} intensity="medium">
          {/* Track details */}
          <View style={styles.details}>
            <Text numberOfLines={1} style={styles.title}>
              {currentTrack.title}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {currentTrack.artist}
            </Text>
          </View>

          {/* Transport buttons */}
          <View style={styles.controls}>
            <Pressable hitSlop={12} onPress={handlePrev} style={styles.controlBtn}>
              <Feather name="skip-back" size={15} color={Colors.text.secondary} />
            </Pressable>

            <Pressable hitSlop={12} onPress={handlePlayPause} style={[styles.controlBtn, styles.playToggle]}>
              <Feather
                name={isPlaying ? 'pause' : 'play'}
                size={16}
                color={Colors.text.primary}
                style={!isPlaying ? { marginLeft: 1.5 } : undefined}
              />
            </Pressable>

            <Pressable hitSlop={12} onPress={handleNext} style={styles.controlBtn}>
              <Feather name="skip-forward" size={15} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Rotating Cover + Progress Ring */}
          <View style={styles.artworkContainer}>
            {/* SVG Progress Ring (isolated re-render boundary) */}
            <MiniPlayerProgressRing />
            
            {/* Cover image (rotates) */}
            <Animated.View style={[animatedCoverStyle, { width: AVATAR_SIZE - 4, height: AVATAR_SIZE - 4, borderRadius: (AVATAR_SIZE - 4) / 2, overflow: 'hidden' }]}>
              <MusicCover
                cover={currentTrack.cover}
                style={{ width: '100%', height: '100%' }}
                iconSize={14}
                borderRadius={(AVATAR_SIZE - 4) / 2}
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
  details: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  title: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption + 1,
    color: Colors.text.primary,
    marginBottom: 1,
  },
  artist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: Colors.text.secondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginRight: Spacing.md,
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
  progressSvg: {
    position: 'absolute',
    top: -3,
    left: -3,
    transform: [{ rotate: '0deg' }],
  },
  cover: {
    width: AVATAR_SIZE - 4,
    height: AVATAR_SIZE - 4,
    borderRadius: (AVATAR_SIZE - 4) / 2,
    backgroundColor: Colors.background.elevated,
  },
});
