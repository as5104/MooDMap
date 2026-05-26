/**
 * MoodMap — Journal Screen (Real Data)
 * Journal counter, colored dot grid, recent entries — all from DB
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import {
  getJournalCount,
  getRecentJournals,
  getJournalDotGrid,
  type JournalEntryRow,
  type JournalDotData,
} from '@/services/journalService';

const DOT_COLORS: Record<string, string> = {
  positive: Colors.accent.olive,
  neutral: Colors.accent.brown,
  negative: Colors.accent.terracotta,
  empty: 'rgba(240, 235, 227, 0.08)',
};

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);

  const [journalCount, setJournalCount] = useState(0);
  const [dotGrid, setDotGrid] = useState<JournalDotData[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const count = getJournalCount(userId);
      const dots = getJournalDotGrid(userId, 48);
      const recent = getRecentJournals(userId, 10);

      setJournalCount(count);
      setDotGrid(dots);
      setRecentEntries(recent);
    } catch (e) {
      console.error('[Journal] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, dataVersion, isAppReady]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.terracotta }]} />
              <Text style={styles.legendText}>Negative</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.brown }]} />
              <Text style={styles.legendText}>Neutral</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent.olive }]} />
              <Text style={styles.legendText}>Positive</Text>
            </View>
          </View>
        </GlassCard>

        {/* Recent Entries or Empty State */}
        <Text style={styles.sectionTitle}>Recent Entries</Text>

        {!hasEntries ? (
          <GlassCard
            intensity="medium"
            padding="lg"
            onPress={() => router.push('/journal-editor')}
          >
            <View style={styles.emptyState}>
              <Feather name="edit-3" size={32} color={Colors.accent.olive} />
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

            return (
              <GlassCard key={entry.id} intensity="medium" padding="md" style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={[
                    styles.sentimentBar,
                    { backgroundColor: DOT_COLORS[sentiment] },
                  ]} />
                  <View style={styles.entryContent}>
                    <Text style={styles.entryDate}>{dateLabel}</Text>
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
            );
          })
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
    backgroundColor: 'rgba(240, 235, 227, 0.08)',
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

  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
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
  entryDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
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
