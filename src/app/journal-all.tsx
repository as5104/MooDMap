/**
 * MoodMap — All Journals Screen
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import {
  getRecentJournals,
  deleteJournalEntry,
  type JournalEntryRow,
} from '@/services/journalService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.xl;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

type ViewMode = 'list' | 'grid';

export default function AllJournalsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);

  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const all = getRecentJournals(user?.id, 500);
      setEntries(all);
    } catch (e) {
      console.error('[AllJournals] Load error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, dataVersion, isAppReady]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = (entryId: string, entryTitle: string | null) => {
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

  const toggleView = () => {
    setViewMode((prev) => (prev === 'list' ? 'grid' : 'list'));
  };

  // Group entries by month
  const groupedEntries = entries.reduce<{ month: string; data: JournalEntryRow[] }[]>(
    (acc, entry) => {
      const date = new Date(entry.created_at);
      const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const existing = acc.find((g) => g.month === monthKey);
      if (existing) {
        existing.data.push(entry);
      } else {
        acc.push({ month: monthKey, data: [entry] });
      }
      return acc;
    },
    []
  );

  // List view entry
  const renderListEntry = (entry: JournalEntryRow) => {
    const dateObj = new Date(entry.created_at);
    const dateLabel = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeLabel = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const preview = entry.content.slice(0, 80);
    const wordCount = entry.content.trim().split(/\s+/).length;

    return (
      <Pressable
        key={entry.id}
        onPress={() =>
          router.push({
            pathname: '/journal-editor',
            params: { entryId: entry.id },
          })
        }
        onLongPress={() => handleDelete(entry.id, entry.title)}
        delayLongPress={500}
      >
        <GlassCard intensity="medium" padding="md" style={styles.entryCard}>
          <View style={styles.entryRow}>
            <View style={styles.entryContent}>
              <Text style={styles.entryTitle}>
                {entry.title ?? 'Untitled'}
              </Text>
              <Text style={styles.entryPreview} numberOfLines={2}>
                {preview}{preview.length < entry.content.length ? '...' : ''}
              </Text>
              <View style={styles.entryMeta}>
                <Text style={styles.entryDate}>{dateLabel}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.entryDate}>{timeLabel}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.entryDate}>{wordCount} words</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
          </View>
        </GlassCard>
      </Pressable>
    );
  };

  // Grid view entry
  const renderGridEntry = (entry: JournalEntryRow) => {
    const dateObj = new Date(entry.created_at);
    const dateLabel = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const preview = entry.content.slice(0, 60);
    const wordCount = entry.content.trim().split(/\s+/).length;

    return (
      <Pressable
        key={entry.id}
        style={styles.gridItem}
        onPress={() =>
          router.push({
            pathname: '/journal-editor',
            params: { entryId: entry.id },
          })
        }
        onLongPress={() => handleDelete(entry.id, entry.title)}
        delayLongPress={500}
      >
        <GlassCard intensity="medium" padding="md" style={styles.gridCard}>
          <Text style={styles.gridTitle} numberOfLines={1}>
            {entry.title ?? 'Untitled'}
          </Text>
          <Text style={styles.gridPreview} numberOfLines={4}>
            {preview}{preview.length < entry.content.length ? '...' : ''}
          </Text>
          <View style={styles.gridFooter}>
            <Text style={styles.gridDate}>{dateLabel}</Text>
            <Text style={styles.gridWords}>{wordCount}w</Text>
          </View>
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>All Journals</Text>
          <Text style={styles.headerCount}>{entries.length}</Text>
          <Pressable
            style={[
              styles.viewToggle,
              viewMode === 'grid' && styles.viewToggleActive,
            ]}
            onPress={toggleView}
          >
            <Feather
              name={viewMode === 'list' ? 'grid' : 'list'}
              size={18}
              color={viewMode === 'grid' ? Colors.background.primary : Colors.accent.primary}
            />
          </Pressable>
        </View>

        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="book-open" size={48} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No journals yet</Text>
            <Text style={styles.emptySubtitle}>
              Start writing to see your entries here
            </Text>
          </View>
        ) : viewMode === 'list' ? (
          /* List View */
          <FlatList
            key="list"
            data={groupedEntries}
            keyExtractor={(item) => item.month}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor={Colors.accent.primary}
                colors={[Colors.accent.primary]}
                progressBackgroundColor={Colors.background.card}
              />
            }
            renderItem={({ item: group }) => (
              <View style={styles.monthGroup}>
                <Text style={styles.monthLabel}>{group.month}</Text>
                {group.data.map(renderListEntry)}
              </View>
            )}
            ListFooterComponent={<View style={{ height: insets.bottom + Spacing.xxxl }} />}
          />
        ) : (
          /* Grid View */
          <FlatList
            key="grid"
            data={entries}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor={Colors.accent.primary}
                colors={[Colors.accent.primary]}
                progressBackgroundColor={Colors.background.card}
              />
            }
            renderItem={({ item }) => renderGridEntry(item)}
            ListFooterComponent={<View style={{ height: insets.bottom + Spacing.xxxl }} />}
          />
        )}
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    flex: 1,
  },
  headerCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    backgroundColor: Colors.glass.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.accent.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },

  // List
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  monthGroup: {
    marginBottom: Spacing.xxl,
  },
  monthLabel: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  entryCard: {
    marginBottom: Spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryContent: {
    flex: 1,
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
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.text.tertiary,
  },
  entryDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
  },

  // Grid
  gridContent: {
    paddingBottom: Spacing.xxxl,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
  },
  gridCard: {
    minHeight: 160,
    justifyContent: 'space-between',
  },
  gridTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  gridPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    lineHeight: 18,
    flex: 1,
    marginBottom: Spacing.md,
  },
  gridFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },
  gridWords: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
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
  },
});
