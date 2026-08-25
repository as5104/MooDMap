/**
 * MoodMap — Global Quick Music Floating Widget
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated as RNAnimated,
  Platform,
  Easing,
} from 'react-native';
import { useSegments, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useMusic } from '@/context/MusicContext';
import { MusicCover } from '@/components/music/MusicCover';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { useAppStore } from '@/stores/appStore';
import { isTrackComfort } from '@/services/comfortBoxService';

interface GlobalQuickMusicWidgetProps {
  inline?: boolean;
}

export const GlobalQuickMusicWidget: React.FC<GlobalQuickMusicWidgetProps> = () => {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { currentTrack, isPlaying, pause, resume, next, prev, favorites, toggleFavorite } = useMusic();
  const dataVersion = useAppStore((s) => s.dataVersion);

  const isComfort = useMemo(() => {
    if (!currentTrack) return false;
    const id1 = currentTrack.id;
    const id2 = id1.startsWith('spotify_') ? id1.replace('spotify_', '') : `spotify_${id1}`;
    return favorites.includes(id1) || favorites.includes(id2) || isTrackComfort(id1) || isTrackComfort(id2);
  }, [currentTrack, favorites, dataVersion]);

  const [isExpanded, setIsExpanded] = useState(false);
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Width animation starting at 38px (collapsed cover) expanding leftward to 252px
  const widthAnim = useRef(new RNAnimated.Value(38)).current;

  // 1. Whitelist visibility check:
  // ONLY show on 4 main tab pages: journal, insights, activities, profile
  const isHidden = useMemo(() => {
    if (!currentTrack) return true;
    const segList = (segments as string[]) || [];
    if (segList.length === 0) return true;

    const first = segList[0] || '';
    const second = segList[1] || '';

    if (first !== '(tabs)') return true;

    const ALLOWED_TABS = ['journal', 'insights', 'activities', 'profile'];
    if (!ALLOWED_TABS.includes(second)) return true;

    return false;
  }, [currentTrack, segments]);

  // 2. Auto-collapse timer
  const resetAutoCollapseTimer = useCallback(() => {
    if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    autoCollapseTimerRef.current = setTimeout(() => {
      handleClose();
    }, 5000);
  }, []);

  const handleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(true);
    resetAutoCollapseTimer();

    widthAnim.setValue(38);

    RNAnimated.spring(widthAnim, {
      toValue: 252,
      tension: 90,
      friction: 14,
      useNativeDriver: false,
    }).start();
  }, [widthAnim, resetAutoCollapseTimer]);

  const handleClose = useCallback(() => {
    RNAnimated.timing(widthAnim, {
      toValue: 38,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      setIsExpanded(false);
    });
  }, [widthAnim]);

  const handlePlayPause = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetAutoCollapseTimer();
    if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  }, [isPlaying, pause, resume, resetAutoCollapseTimer]);

  const handlePrev = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetAutoCollapseTimer();
    await prev();
  }, [prev, resetAutoCollapseTimer]);

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetAutoCollapseTimer();
    await next();
  }, [next, resetAutoCollapseTimer]);

  const handleOpenMusicPage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleClose();
    router.push('/music');
  }, [handleClose]);

  // 3. Effects
  useEffect(() => {
    if (isHidden && isExpanded) {
      setIsExpanded(false);
    }
  }, [isHidden, isExpanded]);

  useEffect(() => {
    return () => {
      if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    };
  }, []);

  // Early return after all hooks
  if (isHidden || !currentTrack) {
    return null;
  }

  return (
    <View style={styles.anchorContainer}>
      {/* Collapsed Mode: Pure Round Cover Artwork */}
      {!isExpanded && (
        <Pressable
          onPress={handleOpen}
          style={styles.collapsedPressable}
          hitSlop={6}
        >
          <View style={styles.coverWrapper}>
            <View style={styles.imageClipContainer}>
              <MusicCover
                cover={currentTrack.cover}
                style={styles.collapsedCover}
                iconSize={12}
                borderRadius={19}
              />
            </View>

            {/* Unclipped Green Status Badge */}
            <View
              style={[
                styles.badgeIndicator,
                { backgroundColor: isPlaying ? Colors.accent.primary : 'rgba(255,255,255,0.4)' },
              ]}
            >
              <Feather
                name={isPlaying ? 'disc' : 'pause'}
                size={7.5}
                color="#000000"
              />
            </View>
          </View>
        </Pressable>
      )}

      {/* Expanded Mode: Right edge FIXED at right:0, left edge slides open leftward */}
      {isExpanded && (
        <RNAnimated.View
          style={[
            styles.expandedCapsuleContainer,
            {
              width: widthAnim,
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 50}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
          />
          <View style={styles.innerFixedLayout}>
            {/* Left side: Track Info -> opens Music page */}
            <Pressable
              onPress={handleOpenMusicPage}
              style={styles.trackInfoSection}
            >
              <MusicCover
                cover={currentTrack.cover}
                style={styles.expandedCover}
                iconSize={12}
                borderRadius={8}
              />
              <View style={styles.textDetails}>
                <Text numberOfLines={1} style={styles.trackTitleText}>
                  {currentTrack.title}
                </Text>
                <Text numberOfLines={1} style={styles.artistNameText}>
                  {currentTrack.artist}
                </Text>
              </View>
            </Pressable>

            {/* Right side: Quick Transport Buttons */}
            <View style={styles.controlsRow}>
              <Pressable
                onPress={() => {
                  if (!currentTrack) return;
                  toggleFavorite(currentTrack);
                }}
                hitSlop={6}
                style={styles.controlBtn}
              >
                <Feather
                  name="heart"
                  size={13}
                  color={isComfort ? '#F472B6' : 'rgba(255,255,255,0.4)'}
                  fill={isComfort ? '#F472B6' : 'transparent'}
                />
              </Pressable>

              <Pressable onPress={handlePrev} hitSlop={6} style={styles.controlBtn}>
                <Feather name="skip-back" size={13} color="#FFFFFF" />
              </Pressable>

              <Pressable onPress={handlePlayPause} hitSlop={6} style={styles.playPauseBtn}>
                <Feather
                  name={isPlaying ? 'pause' : 'play'}
                  size={13}
                  color="#000000"
                  style={{ marginLeft: isPlaying ? 0 : 1.5 }}
                />
              </Pressable>

              <Pressable onPress={handleNext} hitSlop={6} style={styles.controlBtn}>
                <Feather name="skip-forward" size={13} color="#FFFFFF" />
              </Pressable>

              <Pressable onPress={handleClose} hitSlop={6} style={styles.closeBtn}>
                <Feather name="x" size={12} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          </View>
        </RNAnimated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  anchorContainer: {
    width: 38,
    height: 38,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedPressable: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  imageClipContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  collapsedCover: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  badgeIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0E1017',
    zIndex: 10,
  },

  /* Expanded Floating Overlay Capsule: Fixed right: 0, width expands leftward */
  expandedCapsuleContainer: {
    position: 'absolute',
    right: 0,
    top: -3,
    height: 44,
    backgroundColor: 'rgba(16, 18, 26, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 22,
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    overflow: 'hidden',
  },
  innerFixedLayout: {
    width: 252,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  trackInfoSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  expandedCover: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  textDetails: {
    flex: 1,
  },
  trackTitleText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  artistNameText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  controlBtn: {
    padding: 3,
  },
  playPauseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 3,
    marginLeft: 2,
  },
});
