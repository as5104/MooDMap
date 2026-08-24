/**
 * MoodMap — Time Letters
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, customAlert } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import {
  getLetters,
  deleteJournalEntry,
  isLetterSealed,
  isLetterKeywordLocked,
  getLetterCountdown,
  type JournalEntryRow,
} from '@/services/journalService';
import { toggleJournalComfort } from '@/services/comfortBoxService';
import { LetterUnlockModal } from '@/components/letters/LetterUnlockModal';

type FilterTab = 'all' | 'future_self' | 'someone' | 'past_self';

export default function LettersScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [letters, setLetters] = useState<JournalEntryRow[]>([]);
  const [sealedPopupEntry, setSealedPopupEntry] = useState<JournalEntryRow | null>(null);
  const [unlockModalEntry, setUnlockModalEntry] = useState<JournalEntryRow | null>(null);

  const loadData = useCallback(() => {
    try {
      const data = getLetters(user?.id, activeTab);
      setLetters(data);
    } catch (e) {
      console.error('[LettersScreen] Load error:', e);
    }
  }, [user?.id, activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [loadData, activeTab]);

  const handleDeleteLetter = (id: string, title?: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    customAlert(
      'Delete Letter',
      title ? `Are you sure you want to delete "${title}"?` : 'Are you sure you want to delete this letter? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteJournalEntry(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          },
        },
      ]
    );
  };

  const handleLetterPress = (letter: JournalEntryRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLetterSealed(letter)) {
      setSealedPopupEntry(letter);
    } else if (isLetterKeywordLocked(letter)) {
      setUnlockModalEntry(letter);
    } else {
      router.push({
        pathname: '/journal-editor',
        params: { entryId: letter.id, mode: 'letter' },
      });
    }
  };

  // Counts for tabs
  const allLetters = getLetters(user?.id, 'all');
  const totalCount = allLetters.length;
  const futureCount = allLetters.filter((l) => l.recipient === 'future_self').length;
  const someoneCount = allLetters.filter((l) => l.recipient === 'someone').length;
  const pastCount = allLetters.filter((l) => l.recipient === 'past_self').length;

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Time Letters</Text>
            <Text style={styles.headerSubtitle}>Notes across time & reflections</Text>
          </View>

          <Pressable
            style={styles.composeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: '/journal-editor',
                params: { mode: 'letter' },
              });
            }}
            hitSlop={8}
          >
            <Feather name="edit-3" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Write Hero Card */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: '/journal-editor',
                params: { mode: 'letter' },
              });
            }}
          >
            <GlassCard intensity="strong" padding="md" style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroIconBg}>
                  <Feather name="mail" size={22} color="#C084FC" />
                </View>
                <View style={styles.heroTextCol}>
                  <Text style={styles.heroTitle}>Write a New Letter</Text>
                  <Text style={styles.heroSubtitle}>Send a message to Future You or heal Younger You</Text>
                </View>
                <View style={styles.heroArrow}>
                  <Feather name="chevron-right" size={18} color="#C084FC" />
                </View>
              </View>
            </GlassCard>
          </Pressable>

          {/* Filter Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('all');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All ({totalCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, activeTab === 'future_self' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('future_self');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'future_self' && styles.tabTextActive]}>
                Future Self ({futureCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, activeTab === 'someone' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('someone');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'someone' && styles.tabTextActive]}>
                Someone ({someoneCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, activeTab === 'past_self' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('past_self');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'past_self' && styles.tabTextActive]}>
                Past Self ({pastCount})
              </Text>
            </Pressable>
          </View>

          {/* Letters List */}
          {letters.length === 0 ? (
            <GlassCard intensity="subtle" padding="lg" style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Feather name="mail" size={30} color="#C084FC" />
              </View>
              <Text style={styles.emptyTitle}>No Letters in this View</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'future_self'
                  ? 'No future-self letters yet. Write a time capsule letter and set an unlock date!'
                  : activeTab === 'someone'
                    ? 'No letters written for someone special yet.'
                    : activeTab === 'past_self'
                      ? 'No letters to your younger self yet.'
                      : 'Start by writing a note across time.'}
              </Text>
            </GlassCard>
          ) : (
            letters.map((letter) => {
              const isSealed = isLetterSealed(letter);
              const isKeyLocked = isLetterKeywordLocked(letter);
              const countdown = getLetterCountdown(letter.reveal_at);
              const dateObj = new Date(letter.created_at);
              const createdDateLabel = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              const recipientLabel =
                letter.recipient === 'future_self'
                  ? 'Future Self'
                  : letter.recipient === 'past_self'
                    ? 'Past Self'
                    : letter.recipient_name
                      ? `To: ${letter.recipient_name}`
                      : 'Someone Special';

              return (
                <Pressable
                  key={letter.id}
                  onPress={() => handleLetterPress(letter)}
                  onLongPress={() => handleDeleteLetter(letter.id, letter.title)}
                  delayLongPress={500}
                >
                  <GlassCard
                    intensity="medium"
                    padding="md"
                    style={styles.letterCard}
                  >
                    {/* Header Row */}
                    <View style={styles.letterCardHeader}>
                      <View style={styles.letterTagRow}>
                        <View style={styles.recipientBadge}>
                          <Feather
                            name={
                              letter.recipient === 'future_self'
                                ? 'send'
                                : letter.recipient === 'past_self'
                                  ? 'heart'
                                  : 'user'
                            }
                            size={11}
                            color="#C084FC"
                          />
                          <Text style={styles.recipientBadgeText}>
                            {recipientLabel}
                          </Text>
                        </View>

                        {isSealed && (
                          <View style={styles.countdownBadge}>
                            <Feather name="clock" size={10} color="#FBBF24" />
                            <Text style={styles.countdownBadgeText}>{countdown.text}</Text>
                          </View>
                        )}

                        {isKeyLocked && (
                          <View style={styles.keywordLockBadge}>
                            <Feather name="key" size={10} color="#FBBF24" />
                            <Text style={styles.keywordLockBadgeText}>Protected</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardActionRow}>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toggleJournalComfort(letter.id, !letter.is_comfort);
                            loadData();
                          }}
                        >
                          <Feather
                            name="heart"
                            size={15}
                            color={letter.is_comfort ? '#F472B6' : 'rgba(255, 255, 255, 0.25)'}
                          />
                        </Pressable>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteLetter(letter.id, letter.title);
                          }}
                        >
                          <Feather name="trash-2" size={14} color="rgba(255, 255, 255, 0.35)" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.letterTitle} numberOfLines={1}>
                      {letter.title || (isSealed ? 'Sealed Time Capsule' : isKeyLocked ? 'Protected Letter' : 'Untitled Letter')}
                    </Text>

                    {/* Content Preview */}
                    {isSealed ? (
                      <View style={styles.statusRow}>
                        <Feather name="shield" size={13} color="rgba(233, 213, 255, 0.5)" />
                        <Text style={styles.sealedStatusText}>
                          Sealed time capsule • Opens on{' '}
                          {new Date(letter.reveal_at!).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    ) : isKeyLocked ? (
                      <View style={styles.statusRow}>
                        <Feather name="lock" size={12} color="#FBBF24" />
                        <Text style={styles.keywordStatusText}>
                          Locked with a secret password
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.letterPreview} numberOfLines={2}>
                        {letter.content}
                      </Text>
                    )}

                    {/* Footer Date Info */}
                    <View style={styles.letterFooter}>
                      <Text style={styles.letterDateText}>Penned on {createdDateLabel}</Text>
                      {isSealed ? (
                        <Text style={styles.revealDateText}>
                          Opens {new Date(letter.reveal_at!).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      ) : isKeyLocked ? (
                        <Text style={[styles.revealDateText, { color: '#FBBF24' }]}>Tap to unlock →</Text>
                      ) : (
                        <Text style={[styles.revealDateText, { color: '#C084FC' }]}>Read letter →</Text>
                      )}
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Sealed Letter Modal Popup */}
        <Modal
          visible={!!sealedPopupEntry}
          transparent
          animationType="fade"
          onRequestClose={() => setSealedPopupEntry(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBg}>
                <Feather name="lock" size={24} color={Colors.accent.primary} />
              </View>
              <Text style={styles.modalTitle}>Time Capsule is Sealed</Text>
              <Text style={styles.modalBody}>
                This letter was sealed for your future self on{' '}
                <Text style={{ fontFamily: Fonts.bodyBold, color: '#FFFFFF' }}>
                  {sealedPopupEntry?.created_at
                    ? new Date(sealedPopupEntry.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : ''}
                </Text>
                .
                {'\n\n'}
                It will unlock automatically on{' '}
                <Text style={{ fontFamily: Fonts.bodyBold, color: Colors.accent.primary }}>
                  {sealedPopupEntry?.reveal_at
                    ? new Date(sealedPopupEntry.reveal_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : ''}
                </Text>
                . Take comfort in knowing your reflection is safe across time.
              </Text>

              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSealedPopupEntry(null);
                }}
              >
                <Text style={styles.modalCloseBtnText}>Keep Sealed</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Keyword Password Unlock Modal */}
        <LetterUnlockModal
          visible={!!unlockModalEntry}
          entry={unlockModalEntry}
          onClose={() => setUnlockModalEntry(null)}
          onUnlocked={(unlocked) => {
            router.push({
              pathname: '/journal-editor',
              params: { entryId: unlocked.id, mode: 'letter' },
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
    paddingHorizontal: SCREEN_PADDING,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    height: 44,
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(233, 213, 255, 0.7)',
    marginTop: 1,
  },
  composeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.xs,
  },

  // Hero Compose Card
  heroCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#18122B',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.22)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(233, 213, 255, 0.7)',
    lineHeight: 16,
  },
  heroArrow: {
    paddingLeft: Spacing.xs,
  },

  // Filter Tabs
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#C084FC',
  },
  tabText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny - 0.5,
    color: 'rgba(233, 213, 255, 0.65)',
  },
  tabTextActive: {
    fontFamily: Fonts.bodyBold,
    color: '#FFFFFF',
  },

  // Empty View
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    borderRadius: Radius.xl,
    marginTop: Spacing.sm,
    backgroundColor: '#18122B',
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(233, 213, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },

  // Letter Preview Cards (GlassCard UI)
  letterCard: {
    borderRadius: Radius.xl,
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.22)',
  },
  letterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs + 2,
  },
  letterTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },
  recipientBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 0.5,
    color: '#E9D5FF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  countdownBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 0.5,
    color: '#FBBF24',
  },
  keywordLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  keywordLockBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 1,
    color: '#FDE68A',
    textTransform: 'uppercase',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  letterTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 0.5,
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 6,
  },
  letterPreview: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(233, 213, 255, 0.75)',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    marginBottom: Spacing.sm,
  },
  sealedStatusText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(233, 213, 255, 0.65)',
    flex: 1,
  },
  keywordStatusText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: '#FEF3C7',
    flex: 1,
  },
  letterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  letterDateText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(233, 213, 255, 0.45)',
  },
  revealDateText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: '#C084FC',
  },

  // Modal (Official App Theme)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#16161B',
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  modalCloseBtn: {
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.xxl + 4,
    paddingVertical: 12,
    borderRadius: Radius.pill,
  },
  modalCloseBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.onAccent,
  },
});
