/**
 * MoodMap — ComfortSurfacingModal
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { useMusic } from '@/context/MusicContext';
import {
  ComfortSurfacedItem,
  getSurfacedComfortItem,
} from '@/services/comfortBoxService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);

interface ComfortSurfacingModalProps {
  visible: boolean;
  initialItem: ComfortSurfacedItem;
  userId?: string;
  onClose: () => void;
}

export function ComfortSurfacingModal({
  visible,
  initialItem,
  userId,
  onClose,
}: ComfortSurfacingModalProps) {
  const { play, pause, isPlaying, currentTrack } = useMusic();
  const [item, setItem] = useState<ComfortSurfacedItem>(initialItem);

  // Sync item when modal opens
  React.useEffect(() => {
    if (initialItem) {
      setItem(initialItem);
    }
  }, [initialItem]);

  const isCurrentTrackPlaying =
    item.type === 'track' &&
    item.track &&
    currentTrack?.id === item.track.id &&
    isPlaying;

  const handleTogglePlay = useCallback(async () => {
    if (!item.track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isCurrentTrackPlaying) {
      await pause();
    } else {
      await play(item.track);
    }
  }, [item.track, isCurrentTrackPlaying, pause, play]);

  const handleShuffleAnother = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = getSurfacedComfortItem(userId);
    if (next) {
      setItem(next);
    }
  }, [userId]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  if (!visible || !item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <Animated.View entering={FadeInUp.duration(300)} style={styles.modalCard}>
          {/* Top Decorative Aura Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="heart" size={20} color="#BE185D" />
            </View>
            <View style={styles.headerTextWrapper}>
              <Text style={styles.headerTitle}>A Little Comfort For You</Text>
              <Text style={styles.headerSubtitle}>From your personal Comfort Box</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={handleDismiss}>
              <Feather name="x" size={18} color={Colors.text.tertiary} />
            </Pressable>
          </View>

          {/* Anchor Content Card */}
          <Animated.View
            key={item.id}
            entering={FadeIn.duration(300)}
            style={styles.anchorBody}
          >
            {item.type === 'journal' ? (
              <View style={styles.journalContainer}>
                {item.image && (
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.memoryImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                <View style={styles.journalInfo}>
                  <View style={styles.tagRow}>
                    <View style={styles.memoryBadge}>
                      <Feather name="bookmark" size={11} color="#BE185D" />
                      <Text style={styles.memoryBadgeText}>Saved Memory</Text>
                    </View>
                    {item.date && (
                      <Text style={styles.dateText}>{item.date}</Text>
                    )}
                  </View>
                  <Text style={styles.journalTitle}>{item.title}</Text>
                  {item.content && (
                    <View style={styles.journalScrollWrapper}>
                      <ScrollView
                        style={styles.journalScroll}
                        contentContainerStyle={styles.journalScrollContent}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        <Text style={styles.journalExcerpt}>
                          &ldquo;{item.content}&rdquo;
                        </Text>
                      </ScrollView>
                    </View>
                  )}

                  {/* Open Full Journal Button */}
                  <Pressable
                    style={styles.openFullJournalBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onClose();
                      router.push({
                        pathname: '/journal-editor',
                        params: { entryId: item.id },
                      });
                    }}
                  >
                    <Feather name="book-open" size={13} color="#F472B6" />
                    <Text style={styles.openFullJournalBtnText}>Open Full Journal</Text>
                    <Feather name="arrow-up-right" size={13} color="#F472B6" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.trackContainer}>
                <View style={styles.trackTopRow}>
                  {item.albumArt ? (
                    <Image
                      source={{ uri: item.albumArt }}
                      style={styles.albumArt}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.albumArtPlaceholder}>
                      <Feather name="music" size={28} color="#BE185D" />
                    </View>
                  )}
                  <View style={styles.trackInfo}>
                    <View style={styles.songBadge}>
                      <Feather name="headphones" size={11} color="#BE185D" />
                      <Text style={styles.songBadgeText}>Soothing Song</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.trackTitle}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.trackArtist}>
                      {item.subtitle}
                    </Text>
                  </View>
                </View>

                {/* Integrated Play Button */}
                <Pressable
                  style={[
                    styles.playBtn,
                    isCurrentTrackPlaying && styles.playBtnActive,
                  ]}
                  onPress={handleTogglePlay}
                >
                  <Feather
                    name={isCurrentTrackPlaying ? 'pause' : 'play'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.playBtnText}>
                    {isCurrentTrackPlaying ? 'Playing Audio' : 'Listen Now'}
                  </Text>
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.shuffleBtn}
              onPress={handleShuffleAnother}
            >
              <Feather name="refresh-cw" size={14} color={Colors.text.secondary} />
              <Text style={styles.shuffleBtnText}>Another</Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Button
                title="That Helps"
                variant="primary"
                size="md"
                fullWidth
                onPress={handleDismiss}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: MODAL_WIDTH,
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(190, 24, 93, 0.35)',
    padding: Spacing.lg,
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(190, 24, 93, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  anchorBody: {
    backgroundColor: '#16161A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },

  journalContainer: {
    padding: Spacing.md,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  journalInfo: {
    gap: 4,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  memoryBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#F472B6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },
  journalTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.bodySmall + 1,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  journalScrollWrapper: {
    maxHeight: 120,
    marginVertical: 4,
  },
  journalScroll: {
    flexGrow: 0,
  },
  journalScrollContent: {
    paddingVertical: 2,
  },
  journalExcerpt: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  openFullJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(190, 24, 93, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.25)',
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginTop: 8,
  },
  openFullJournalBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: '#F472B6',
  },

  trackContainer: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  trackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  albumArtPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(190, 24, 93, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  songBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  songBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#F472B6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.bodySmall + 1,
    color: '#FFFFFF',
  },
  trackArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#BE185D',
    paddingVertical: 10,
    borderRadius: 12,
  },
  playBtnActive: {
    backgroundColor: '#047857',
  },
  playBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: '#FFFFFF',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.button,
  },
  shuffleBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
});
