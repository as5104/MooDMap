/**
 * MoodMap — All Journals Screen
 */

import { GlassCard, GradientBackground, customAlert } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Radius, Shadows, Spacing } from '@/constants/layout';
import { Fonts, FontSizes } from '@/constants/typography';
import {
  deleteJournalEntry,
  getRecentJournals,
  isLetterSealed,
  isLetterKeywordLocked,
  getLetterCountdown,
  type JournalEntryRow,
} from '@/services/journalService';
import { toggleJournalComfort } from '@/services/comfortBoxService';
import { LetterUnlockModal } from '@/components/letters/LetterUnlockModal';
import { useAppStore } from '@/stores/appStore';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.xl;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
const NEW_JOURNAL_BUTTON_SIZE = 58;

export default function AllJournalsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const viewMode = useAppStore((s) => s.journalViewMode);
  const setViewMode = useAppStore((s) => s.setJournalViewMode);

  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unlockModalEntry, setUnlockModalEntry] = useState<JournalEntryRow | null>(null);

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
    customAlert(
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
    setViewMode(viewMode === 'list' ? 'grid' : 'list');
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

    const isLetter = entry.subtype === 'letter';
    const isSealed = isLetter && isLetterSealed(entry);
    const isKeyLocked = isLetter && isLetterKeywordLocked(entry);
    const countdown = isLetter ? getLetterCountdown(entry.reveal_at) : null;

    const handlePress = () => {
      if (isSealed) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        customAlert(
          'Time Capsule Sealed',
          `This letter is safely locked in your personal time capsule until ${new Date(entry.reveal_at!).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}.`
        );
      } else if (isKeyLocked) {
        setUnlockModalEntry(entry);
      } else {
        router.push({
          pathname: '/journal-editor',
          params: { entryId: entry.id, mode: isLetter ? 'letter' : 'journal' },
        });
      }
    };

    return (
      <Pressable
        key={entry.id}
        onPress={handlePress}
        onLongPress={() => handleDelete(entry.id, entry.title)}
        delayLongPress={500}
      >
        <GlassCard
          intensity="medium"
          padding="md"
          style={[
            styles.entryCard,
            isSealed && {
              backgroundColor: 'rgba(124, 58, 237, 0.12)',
              borderColor: 'rgba(192, 132, 252, 0.35)',
            },
            isKeyLocked && {
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(251, 191, 36, 0.35)',
            },
          ]}
        >
          <View style={styles.entryRow}>
            <View style={styles.entryContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Text
                  style={[
                    styles.entryTitle,
                    isSealed && { color: '#E9D5FF' },
                    isKeyLocked && { color: '#FEF3C7' },
                  ]}
                >
                  {entry.title ?? (isSealed ? 'Sealed Time Capsule' : isKeyLocked ? 'Protected Letter' : isLetter ? 'Time Letter' : 'Untitled')}
                </Text>
                {isLetter && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: isSealed
                        ? 'rgba(124, 58, 237, 0.25)'
                        : isKeyLocked
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(124, 58, 237, 0.2)',
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: Radius.pill,
                      borderWidth: 1,
                      borderColor: isSealed
                        ? 'rgba(192, 132, 252, 0.35)'
                        : isKeyLocked
                          ? 'rgba(251, 191, 36, 0.35)'
                          : 'rgba(192, 132, 252, 0.3)',
                    }}
                  >
                    <Feather
                      name={isSealed ? 'lock' : isKeyLocked ? 'key' : entry.recipient === 'past_self' ? 'heart' : 'mail'}
                      size={10}
                      color={isSealed ? '#FBBF24' : isKeyLocked ? '#FDE68A' : '#C084FC'}
                    />
                    <Text
                      style={{
                        fontFamily: Fonts.bodySemiBold,
                        fontSize: FontSizes.tiny - 1.5,
                        color: isSealed ? '#FBBF24' : isKeyLocked ? '#FDE68A' : '#C084FC',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isSealed
                        ? countdown?.text
                        : isKeyLocked
                          ? 'Locked'
                          : entry.recipient === 'future_self'
                            ? 'Delivered'
                            : entry.recipient === 'past_self'
                              ? 'Past Self'
                              : entry.recipient_name
                                ? `To: ${entry.recipient_name}`
                                : 'Letter'}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.entryPreview,
                  (isSealed || isKeyLocked) && { fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.55)' },
                ]}
                numberOfLines={2}
              >
                {isSealed
                  ? 'Locked for your future self...'
                  : isKeyLocked
                    ? `Protected with secret keyword • Hint: "${entry.lock_hint}"`
                    : `${preview}${preview.length < entry.content.length ? '...' : ''}`}
              </Text>
              <View style={styles.entryMeta}>
                <Text style={styles.entryDate}>{dateLabel}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.entryDate}>{timeLabel}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.entryDate}>{wordCount} words</Text>
                <View style={styles.metaDot} />
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleJournalComfort(entry.id, !entry.is_comfort);
                    loadData();
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Feather
                    name="heart"
                    size={12}
                    color={entry.is_comfort ? '#F472B6' : 'rgba(255, 255, 255, 0.35)'}
                  />
                  {Boolean(entry.is_comfort) && (
                    <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.tiny - 1, color: '#F472B6' }}>
                      Comfort
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
            <Feather
              name={isSealed ? 'lock' : isKeyLocked ? 'key' : 'chevron-right'}
              size={18}
              color={isSealed ? '#C084FC' : isKeyLocked ? '#FBBF24' : Colors.text.tertiary}
            />
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

    const isLetter = entry.subtype === 'letter';
    const isSealed = isLetter && isLetterSealed(entry);
    const isKeyLocked = isLetter && isLetterKeywordLocked(entry);
    const countdown = isLetter ? getLetterCountdown(entry.reveal_at) : null;

    const handlePress = () => {
      if (isSealed) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        customAlert(
          'Time Capsule Sealed',
          `This letter is safely locked until ${new Date(entry.reveal_at!).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}.`
        );
      } else if (isKeyLocked) {
        setUnlockModalEntry(entry);
      } else {
        router.push({
          pathname: '/journal-editor',
          params: { entryId: entry.id, mode: isLetter ? 'letter' : 'journal' },
        });
      }
    };

    return (
      <Pressable
        key={entry.id}
        style={styles.gridItem}
        onPress={handlePress}
        onLongPress={() => handleDelete(entry.id, entry.title)}
        delayLongPress={500}
      >
        <GlassCard
          intensity="medium"
          padding="md"
          style={[
            styles.gridCard,
            isSealed && {
              backgroundColor: 'rgba(124, 58, 237, 0.12)',
              borderColor: 'rgba(192, 132, 252, 0.35)',
            },
            isKeyLocked && {
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(251, 191, 36, 0.35)',
            },
          ]}
        >
          <View style={styles.gridCardTop}>
            <View style={styles.gridTitleRow}>
              <Text
                style={[
                  styles.gridTitle,
                  isSealed && { color: '#E9D5FF' },
                  isKeyLocked && { color: '#FEF3C7' },
                ]}
                numberOfLines={1}
              >
                {entry.title ?? (isSealed ? 'Time Capsule' : isKeyLocked ? 'Protected Letter' : isLetter ? 'Letter' : 'Untitled')}
              </Text>
              {isSealed ? (
                <Feather name="lock" size={11} color="#FBBF24" />
              ) : isKeyLocked ? (
                <Feather name="key" size={11} color="#FBBF24" />
              ) : null}
            </View>

            <Text
              style={[
                styles.gridPreview,
                (isSealed || isKeyLocked) && { fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.6)' },
              ]}
              numberOfLines={3}
            >
              {isSealed ? `Sealed (${countdown?.text})` : isKeyLocked ? 'Locked with secret password' : `${preview}${preview.length < entry.content.length ? '...' : ''}`}
            </Text>
          </View>

          <View style={styles.gridFooter}>
            <View style={styles.gridMetaLeft}>
              <Text style={styles.gridDate}>{dateLabel}</Text>
              <View style={styles.gridMetaDot} />
              <Text style={styles.gridWords}>{wordCount}w</Text>
            </View>

            <Pressable
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleJournalComfort(entry.id, !entry.is_comfort);
                loadData();
              }}
              style={styles.gridHeartBtn}
            >
              <Feather
                name="heart"
                size={13}
                color={entry.is_comfort ? '#F472B6' : 'rgba(255, 255, 255, 0.3)'}
              />
            </Pressable>
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
            ListFooterComponent={<View style={{ height: insets.bottom + NEW_JOURNAL_BUTTON_SIZE + Spacing.xxxl }} />}
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
            ListFooterComponent={<View style={{ height: insets.bottom + NEW_JOURNAL_BUTTON_SIZE + Spacing.xxxl }} />}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Write new journal"
          hitSlop={8}
          style={[
            styles.newJournalButton,
            {
              right: Spacing.xl,
              bottom: insets.bottom + Spacing.xl,
            },
          ]}
          onPress={() => router.push('/journal-editor')}
        >
          <Feather name="plus" size={30} color={Colors.text.onAccent} />
        </Pressable>

        {/* Keyword Unlock Modal */}
        <LetterUnlockModal
          visible={!!unlockModalEntry}
          entry={unlockModalEntry}
          onClose={() => setUnlockModalEntry(null)}
          onUnlocked={(entry) => {
            router.push({
              pathname: '/journal-editor',
              params: { entryId: entry.id, mode: 'letter' },
            });
          }}
        />
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
    height: 168,
    flex: 1,
    justifyContent: 'space-between',
  },
  gridCardTop: {
    flex: 1,
  },
  gridTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gridTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    flex: 1,
    marginRight: 4,
  },
  gridPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginTop: 2,
  },
  gridFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridMetaDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: Colors.text.tertiary,
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
  gridHeartBtn: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Floating action
  newJournalButton: {
    position: 'absolute',
    zIndex: 10,
    width: NEW_JOURNAL_BUTTON_SIZE,
    height: NEW_JOURNAL_BUTTON_SIZE,
    borderRadius: NEW_JOURNAL_BUTTON_SIZE / 2,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.accentStrong,
    ...Shadows.glow(Colors.accent.primary),
  },
});
