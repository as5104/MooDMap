/**
 * MoodMap — Journal Screen
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard } from '@/components/ui';
import { MoodFace } from '@/components/ui/MoodFace';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { JOURNAL_PROMPTS } from '@/constants/prompts';
import { useAppStore } from '@/stores/appStore';
import {
  getJournalCount,
  getRecentJournals,
  getJournalDotGrid,
  deleteJournalEntry,
  loadDraft,
  deleteDraft,
  type JournalEntryRow,
  type JournalDotData,
  type JournalDraft,
} from '@/services/journalService';
import { getTodayMood } from '@/services/moodService';

const DOT_COLORS: Record<string, string> = {
  positive: Colors.accent.primary,
  neutral: Colors.accent.lavender,
  negative: Colors.accent.coral,
  empty: 'rgba(255, 255, 255, 0.08)',
};

const MAX_RECENT = 5;

// Pick 4 random prompts for the carousel
function getRandomPrompts(count: number = 4) {
  const shuffled = [...JOURNAL_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const refreshData = useAppStore((s) => s.refreshData);

  const [journalCount, setJournalCount] = useState(0);
  const [dotGrid, setDotGrid] = useState<JournalDotData[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntryRow[]>([]);
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [randomPrompts] = useState(() => getRandomPrompts());
  const [linkedMoods, setLinkedMoods] = useState<Record<string, { moodType: MoodType }>>({});

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const count = getJournalCount(userId);
      const dots = getJournalDotGrid(userId, 48);
      const recent = getRecentJournals(userId, MAX_RECENT);
      const currentDraft = loadDraft(userId);

      setJournalCount(count);
      setDotGrid(dots);
      setRecentEntries(recent);
      setDraft(
        currentDraft && (currentDraft.content.trim().length > 0 || (currentDraft.title && currentDraft.title.trim().length > 0))
          ? currentDraft
          : null
      );

      // Build mood lookup
      const moodMap: Record<string, { moodType: MoodType }> = {};
      for (const entry of recent) {
        if (entry.mood_entry_id) {
          const todayMoodData = getTodayMood(userId);
          if (todayMoodData && todayMoodData.id === entry.mood_entry_id) {
            moodMap[entry.id] = { moodType: todayMoodData.mood_type as MoodType };
          }
        }
      }
      setLinkedMoods(moodMap);
    } catch (e) {
      console.error('[Journal] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, dataVersion, isAppReady]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteEntry = (entryId: string, entryTitle: string | null) => {
    Alert.alert(
      'Delete Entry',
      `Delete "${entryTitle || 'this entry'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const success = deleteJournalEntry(entryId);
            if (success) {
              refreshData();
              loadData();
            }
          },
        },
      ]
    );
  };

  const handleDeleteDraft = () => {
    Alert.alert(
      'Discard Draft',
      'Are you sure you want to discard this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            deleteDraft(user?.id);
            setDraft(null);
          },
        },
      ]
    );
  };

  const hasEntries = recentEntries.length > 0;

  return (
    <GradientBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent.primary}
            colors={[Colors.accent.primary]}
            progressBackgroundColor={Colors.background.card}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Journal History</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/journal-editor')}
          >
            <Feather name="plus" size={22} color={Colors.text.primary} />
          </Pressable>
        </View>

        {/* Counter */}
        <View style={styles.counterSection}>
          <Text style={styles.counterValue}>
            <Text style={styles.counterHighlight}>{journalCount}</Text>/365
          </Text>
          <Text style={styles.counterLabel}>
            {journalCount === 0
              ? 'No journals yet this year.\nStart writing!'
              : `Journals this year.\n${journalCount >= 10 ? 'Keep it Up!' : 'Great start!'}`}
          </Text>
        </View>

        {/* Dot Grid */}
        <GlassCard intensity="medium" padding="lg" style={styles.gridCard}>
          <View style={styles.dotGrid}>
            {dotGrid.map((dot, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: DOT_COLORS[dot.sentiment] },
                ]}
              />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.coral }]} />
              <Text style={styles.legendText}>Negative</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.lavender }]} />
              <Text style={styles.legendText}>Neutral</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.primary }]} />
              <Text style={styles.legendText}>Positive</Text>
            </View>
          </View>
        </GlassCard>

        {/* Prompt Carousel */}
        <Text style={styles.sectionTitle}>Writing Prompts</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptCarousel}
        >
          {randomPrompts.map((prompt) => (
            <Pressable
              key={prompt.id}
              style={styles.promptCard}
              onPress={() =>
                router.push({
                  pathname: '/journal-editor',
                  params: { prompt: prompt.text, promptId: prompt.id },
                })
              }
            >
              <View style={[styles.promptCardIcon, { backgroundColor: Colors.accent.primaryMuted }]}>
                <Feather name={prompt.icon as any} size={18} color={Colors.accent.primary} />
              </View>
              <Text style={styles.promptCardText} numberOfLines={2}>
                {prompt.text}
              </Text>
              <View style={styles.promptCardArrow}>
                <Feather name="arrow-right" size={14} color={Colors.text.tertiary} />
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Draft Section */}
        {draft && (
          <>
            <Text style={styles.sectionTitle}>Draft</Text>
            <Pressable
              onPress={() => router.push('/journal-editor')}
              onLongPress={handleDeleteDraft}
              delayLongPress={500}
            >
              <GlassCard intensity="medium" padding="md" style={styles.draftCard}>
                <View style={styles.draftRow}>
                  <View style={styles.draftIconBg}>
                    <Feather name="file-text" size={18} color={Colors.accent.primary} />
                  </View>
                  <View style={styles.draftContent}>
                    <View style={styles.draftTitleRow}>
                      <Text style={styles.draftTitle}>
                        {draft.title || 'Untitled draft'}
                      </Text>
                      <View style={styles.draftBadge}>
                        <Text style={styles.draftBadgeText}>DRAFT</Text>
                      </View>
                    </View>
                    <Text style={styles.draftPreview} numberOfLines={1}>
                      {draft.content.slice(0, 60) || 'Empty draft'}
                      {draft.content.length > 60 ? '...' : ''}
                    </Text>
                    <Text style={styles.draftDate}>
                      Last edited {new Date(draft.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
                </View>
              </GlassCard>
            </Pressable>
          </>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Entries</Text>
          <Pressable
            style={styles.seeAllBtn}
            onPress={() => router.push('/journal-all')}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Feather name="chevron-right" size={14} color={Colors.accent.primary} />
          </Pressable>
        </View>

        {!hasEntries ? (
          <GlassCard
            intensity="medium"
            padding="lg"
            onPress={() => router.push('/journal-editor')}
          >
            <View style={styles.emptyState}>
              <Feather name="edit-3" size={32} color={Colors.accent.primary} />
              <Text style={styles.emptyTitle}>Start your first journal</Text>
              <Text style={styles.emptySubtitle}>
                Writing helps you process your emotions and track your growth
              </Text>
            </View>
          </GlassCard>
        ) : (
          recentEntries.map((entry) => {
            const dateObj = new Date(entry.created_at);
            const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const preview = entry.content.slice(0, 60);
            const len = entry.content.length;
            const sentiment = len > 200 ? 'positive' : len > 50 ? 'neutral' : 'negative';
            const linkedMood = linkedMoods[entry.id];
            const moodDef = linkedMood ? MOOD_MAP[linkedMood.moodType] : null;

            return (
              <Pressable
                key={entry.id}
                onPress={() =>
                  router.push({
                    pathname: '/journal-editor',
                    params: { entryId: entry.id },
                  })
                }
                onLongPress={() => handleDeleteEntry(entry.id, entry.title)}
                delayLongPress={500}
              >
                <GlassCard intensity="medium" padding="md" style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={[
                      styles.sentimentBar,
                      { backgroundColor: DOT_COLORS[sentiment] },
                    ]} />
                    <View style={styles.entryContent}>
                      <View style={styles.entryDateRow}>
                        <Text style={styles.entryDate}>{dateLabel}</Text>
                        {moodDef && (
                          <View style={styles.entryMoodChip}>
                            <MoodFace
                              expression={moodDef.expression}
                              bgColor={moodDef.bgColor}
                              faceColor={moodDef.faceColor}
                              size="xs"
                            />
                          </View>
                        )}
                      </View>
                      <Text style={styles.entryTitle}>
                        {entry.title ?? 'Journal Entry'}
                      </Text>
                      <Text style={styles.entryPreview} numberOfLines={1}>
                        {preview}...
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
                  </View>
                </GlassCard>
              </Pressable>
            );
          })
        )}

        {/* See all footer */}
        {hasEntries && (
          <Pressable
            style={styles.seeAllFooter}
            onPress={() => router.push('/journal-all')}
          >
            <Text style={styles.seeAllFooterText}>
              View all {journalCount} entries
            </Text>
            <Feather name="arrow-right" size={16} color={Colors.accent.primary} />
          </Pressable>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  counterSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  counterValue: {
    fontFamily: Fonts.heading,
    fontSize: 56,
    color: Colors.text.secondary,
    lineHeight: 64,
  },
  counterHighlight: {
    color: Colors.text.primary,
    fontSize: 64,
  },
  counterLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  gridCard: {
    marginBottom: Spacing.xxl,
  },
  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  // Prompt Carousel
  promptCarousel: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.md,
  },
  promptCard: {
    width: 200,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.borderSubtle,
    borderRadius: Radius.card,
    padding: Spacing.lg,
  },
  promptCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  promptCardText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  promptCardArrow: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.glass.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section headers
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },

  // See All
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  seeAllText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.primary,
  },
  seeAllFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent.primaryMuted,
  },
  seeAllFooterText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.primary,
  },

  // Draft
  draftCard: {
    marginBottom: Spacing.xxl,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  draftContent: {
    flex: 1,
  },
  draftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  draftTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    flex: 1,
  },
  draftBadge: {
    backgroundColor: Colors.accent.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  draftBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  draftPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  draftDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
  },

  // Entry cards
  entryCard: {
    marginBottom: Spacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sentimentBar: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  entryContent: {
    flex: 1,
  },
  entryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  entryDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  entryMoodChip: {},
  entryTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  entryPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 250,
  },
});
