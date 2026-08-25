/**
 * MoodMap — Comfort Box Studio
 * Dedicated personal sanctuary for comforting memories and soothing songs
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { useMusic } from '@/context/MusicContext';
import {
  getComfortJournals,
  getComfortTracks,
  getSurfacedComfortItem,
  toggleJournalComfort,
  type ComfortTrackRow,
  type ComfortSurfacedItem,
} from '@/services/comfortBoxService';
import { JournalEntryRow } from '@/services/journalService';
import { ComfortSurfacingModal } from '@/components/comfort/ComfortSurfacingModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterTab = 'all' | 'journals' | 'tracks';

export default function ComfortBoxScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const { play, pause, isPlaying, currentTrack, toggleFavorite } = useMusic();

  const [filter, setFilter] = useState<FilterTab>('all');
  const [journals, setJournals] = useState<JournalEntryRow[]>([]);
  const [tracks, setTracks] = useState<ComfortTrackRow[]>([]);
  const [surfacedModalItem, setSurfacedModalItem] = useState<ComfortSurfacedItem | null>(null);

  const loadData = useCallback(() => {
    try {
      const j = getComfortJournals(user?.id);
      const t = getComfortTracks(user?.id);
      setJournals(j);
      setTracks(t);
    } catch (e) {
      console.error('[ComfortBox] Failed to load anchors:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  const totalCount = journals.length + tracks.length;

  const handleOpenRandom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const item = getSurfacedComfortItem(user?.id);
    if (item) {
      setSurfacedModalItem(item);
    }
  };

  const handleRemoveJournal = (journalId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleJournalComfort(journalId, false);
    loadData();
  };

  const handleRemoveTrack = (track: ComfortTrackRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite({
      id: track.id,
      title: track.track_name,
      artist: track.artist_name,
      category: (track.track_source as any) || 'ambient',
      cover: track.album_art || '',
      url: track.audio_url || '',
      duration: track.duration || '3:30',
    });
    loadData();
  };

  const handlePlayTrack = async (track: ComfortTrackRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentTrack?.id === track.id && isPlaying) {
      await pause();
    } else {
      await play({
        id: track.id,
        title: track.track_name,
        artist: track.artist_name,
        category: (track.track_source as any) || 'ambient',
        cover: track.album_art || '',
        url: track.audio_url || '',
        duration: track.duration || '3:30',
        durationSec: 210,
      });
    }
  };

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Centered Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Comfort Box</Text>
            <Text style={styles.headerSubtitle}>Personal Soothing Anchors</Text>
          </View>
          <View style={styles.badgePill}>
            <Feather name="heart" size={11} color="#F472B6" />
            <Text style={styles.badgePillText}>{totalCount} Anchors</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO SANCTUARY CARD */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.heroCard}>
              <View style={styles.heroBackgroundAura} />
              <View style={styles.heroHeader}>
                <View style={styles.heroIconBg}>
                  <Feather name="package" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.heroHeaderText}>
                  <Text style={styles.heroTitle}>Your Soothing Box</Text>
                  <Text style={styles.heroSubtitle}>
                    A repository of your safest memories and comforting music.
                  </Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.surpriseBtn,
                  totalCount === 0 && { opacity: 0.5 },
                ]}
                onPress={handleOpenRandom}
                disabled={totalCount === 0}
              >
                <Feather name="gift" size={16} color="#FFFFFF" />
                <Text style={styles.surpriseBtnText}>Open Random Comfort</Text>
                <Feather name="arrow-right" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </Animated.View>

          {/* FILTER TABS */}
          <View style={styles.filterRow}>
            <Pressable
              style={[
                styles.filterTab,
                filter === 'all' && styles.filterTabActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter('all');
              }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === 'all' && styles.filterTabTextActive,
                ]}
              >
                All ({totalCount})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterTab,
                filter === 'journals' && styles.filterTabActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter('journals');
              }}
            >
              <Feather
                name="book-open"
                size={12}
                color={filter === 'journals' ? '#0A0A0C' : Colors.text.secondary}
              />
              <Text
                style={[
                  styles.filterTabText,
                  filter === 'journals' && styles.filterTabTextActive,
                ]}
              >
                Memories ({journals.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterTab,
                filter === 'tracks' && styles.filterTabActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter('tracks');
              }}
            >
              <Feather
                name="music"
                size={12}
                color={filter === 'tracks' ? '#0A0A0C' : Colors.text.secondary}
              />
              <Text
                style={[
                  styles.filterTabText,
                  filter === 'tracks' && styles.filterTabTextActive,
                ]}
              >
                Songs ({tracks.length})
              </Text>
            </Pressable>
          </View>

          {/* LIST OF ANCHORS */}
          {totalCount === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Feather name="heart" size={32} color="#F472B6" />
              </View>
              <Text style={styles.emptyTitle}>Your Comfort Box is Empty</Text>
              <Text style={styles.emptyText}>
                Tap the heart comfort icon on any journal memory or song to save it here for difficult days.
              </Text>
            </View>
          ) : (
            <View style={styles.anchorsList}>
              {/* Comfort Journals */}
              {(filter === 'all' || filter === 'journals') &&
                journals.map((j) => {
                  let parsedImage: string | null = null;
                  if (j.images) {
                    try {
                      const p = JSON.parse(j.images);
                      if (Array.isArray(p) && p.length > 0) parsedImage = p[0];
                    } catch {}
                  }

                  return (
                    <Pressable
                      key={j.id}
                      style={styles.anchorCard}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({
                          pathname: '/journal-editor',
                          params: { entryId: j.id },
                        });
                      }}
                    >
                      {parsedImage && (
                        <Image
                          source={{ uri: parsedImage }}
                          style={styles.cardCoverImage}
                          resizeMode="cover"
                        />
                      )}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTypeBadge}>
                          <Feather name="bookmark" size={11} color="#F472B6" />
                          <Text style={styles.cardTypeBadgeText}>Memory</Text>
                        </View>
                        <Pressable
                          style={styles.removeBtn}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleRemoveJournal(j.id);
                          }}
                        >
                          <Feather name="heart" size={14} color="#F472B6" />
                        </Pressable>
                      </View>

                      <Text style={styles.cardTitle}>{j.title || 'Journal Entry'}</Text>
                      <Text numberOfLines={3} style={styles.cardContent}>
                        {j.content}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={styles.cardDate}>{j.date}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.tiny, color: '#F472B6' }}>
                            Read Full
                          </Text>
                          <Feather name="arrow-right" size={11} color="#F472B6" />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}

              {/* Comfort Tracks */}
              {(filter === 'all' || filter === 'tracks') &&
                tracks.map((t) => {
                  const isThisPlaying = currentTrack?.id === t.id && isPlaying;

                  return (
                    <View key={t.id} style={styles.anchorCard}>
                      <View style={styles.trackRow}>
                        {t.album_art ? (
                          <Image
                            source={{ uri: t.album_art }}
                            style={styles.trackCover}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.trackCoverPlaceholder}>
                            <Feather name="music" size={20} color="#F472B6" />
                          </View>
                        )}

                        <View style={styles.trackDetails}>
                          <View style={styles.cardTypeBadge}>
                            <Feather name="headphones" size={11} color="#F472B6" />
                            <Text style={styles.cardTypeBadgeText}>Song Anchor</Text>
                          </View>
                          <Text numberOfLines={1} style={styles.cardTitle}>
                            {t.track_name}
                          </Text>
                          <Text numberOfLines={1} style={styles.cardSubtitle}>
                            {t.artist_name}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.removeBtn}
                          onPress={() => handleRemoveTrack(t)}
                        >
                          <Feather name="heart" size={14} color="#F472B6" />
                        </Pressable>
                      </View>

                      {/* Play Action */}
                      <Pressable
                        style={[
                          styles.inlinePlayBtn,
                          isThisPlaying && styles.inlinePlayBtnActive,
                        ]}
                        onPress={() => handlePlayTrack(t)}
                      >
                        <Feather
                          name={isThisPlaying ? 'pause' : 'play'}
                          size={14}
                          color="#FFFFFF"
                        />
                        <Text style={styles.inlinePlayBtnText}>
                          {isThisPlaying ? 'Pause Audio' : 'Play Song'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
            </View>
          )}
        </ScrollView>

        {/* Modal for Surprise/Surfaced Comfort */}
        {surfacedModalItem && (
          <ComfortSurfacingModal
            visible={Boolean(surfacedModalItem)}
            initialItem={surfacedModalItem}
            userId={user?.id}
            onClose={() => setSurfacedModalItem(null)}
          />
        )}
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 48,
    marginBottom: Spacing.xs,
  },
  closeBtn: {
    position: 'absolute',
    left: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  badgePill: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(190, 24, 93, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    zIndex: 10,
  },
  badgePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#F472B6',
  },

  scrollContent: {
    paddingTop: Spacing.sm,
  },

  heroCard: {
    backgroundColor: '#831843',
    borderRadius: 22,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  heroBackgroundAura: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(244, 114, 182, 0.25)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  heroIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderText: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
    marginTop: 2,
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 10,
    borderRadius: 14,
  },
  surpriseBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: '#FFFFFF',
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterTabActive: {
    backgroundColor: '#F472B6',
    borderColor: '#F472B6',
  },
  filterTabText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  filterTabTextActive: {
    color: '#0A0A0C',
    fontFamily: Fonts.bodyBold,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    padding: Spacing.xxl,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  anchorsList: {
    gap: 12,
  },
  anchorCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardCoverImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  cardTypeBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#F472B6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(190, 24, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.bodySmall + 1,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  cardContent: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },

  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  trackCoverPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(190, 24, 93, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDetails: {
    flex: 1,
    gap: 2,
  },

  inlinePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  inlinePlayBtnActive: {
    backgroundColor: '#047857',
  },
  inlinePlayBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
  },
});
