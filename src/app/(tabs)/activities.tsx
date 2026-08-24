/**
 * MoodMap - Activities Tab
 */

import React, { useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GradientBackground, GlassCard, AnimatedPressable } from '@/components/ui';
import { GlobalQuickMusicWidget } from '@/components/music/GlobalQuickMusicWidget';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { useTierStore } from '@/stores/tierStore';
import { getSuggestion } from '@/constants/suggestions';
import { MOOD_MAP } from '@/constants/moods';
import { getSetting, hasPracticeToday, recordPracticeToday } from '@/services/settingsService';
import { hasTodayJournal } from '@/services/journalService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ActivityBentoItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  solidColor: string;
  route: string;
  badge: string;
  bentoWidth: 'full' | 'wide' | 'narrow' | 'half';
  height: number;
  watermarkIcon: keyof typeof Feather.glyphMap;
  previewType?: 'matrix' | 'breath' | 'grounding' | 'deck' | 'timer' | 'reflect';
}

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const todayMood = useAppStore((s) => s.todayMood);
  const user = useAppStore((s) => s.user);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const isVIP = useTierStore((s) => s.isVIP);

  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [journalCompleted, setJournalCompleted] = useState(false);

  const checkRoutineStatus = useCallback(() => {
    try {
      setPracticeCompleted(hasPracticeToday());
      setJournalCompleted(hasTodayJournal(user?.id));
    } catch (e) {
      console.error('[Activities] Routine status check error:', e);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      checkRoutineStatus();
    }, [checkRoutineStatus])
  );

  const moodCompleted = !!todayMood;
  const totalCompleted = (moodCompleted ? 1 : 0) + (practiceCompleted ? 1 : 0) + (journalCompleted ? 1 : 0);
  const allCompleted = totalCompleted === 3;
  const progressPercent = Math.round((totalCompleted / 3) * 100);

  // Best score for Memory Matrix
  const bestLevel = useMemo(() => {
    try {
      return getSetting('memory_matrix_best_level', '1');
    } catch {
      return '1';
    }
  }, []);

  // Mood-based recommended activity
  const recommendation = useMemo(() => {
    if (!todayMood) return null;
    const suggestion = getSuggestion(todayMood.moodType, todayMood.stressLevel, todayMood.energyLevel);
    const mood = MOOD_MAP[todayMood.moodType];
    return { suggestion, mood };
  }, [todayMood]);

  const handleActivityPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    recordPracticeToday();
    setPracticeCompleted(true);
    router.push(route as any);
  };

  const totalContentWidth = SCREEN_WIDTH - Spacing.xl * 2;
  const gap = Spacing.md;

  const AUDIO_ACTIVITIES: ActivityBentoItem[] = [
    {
      key: 'sounds',
      icon: 'music',
      title: 'Music Player',
      subtitle: 'Ambient, lo-fi & Spotify playlists',
      solidColor: '#1E3A8A', // Azure Blue
      route: '/music',
      badge: 'Audio',
      bentoWidth: 'full',
      height: 76,
      watermarkIcon: 'headphones',
    },
  ];

  const PRACTICE_ACTIVITIES: ActivityBentoItem[] = [
    // ROW 1: Memory Matrix (Wide) + Breathing (Narrow)
    {
      key: 'memory_matrix',
      icon: 'grid',
      title: 'Memory Matrix',
      subtitle: `Cognitive recall game • Best Lvl ${bestLevel}`,
      solidColor: '#065F46', // Emerald
      route: '/memory-matrix',
      badge: 'Focus',
      bentoWidth: 'wide',
      height: 164,
      watermarkIcon: 'cpu',
      previewType: 'matrix',
    },
    {
      key: 'breathing',
      icon: 'wind',
      title: 'Breathing',
      subtitle: '4-7-8 & Box patterns',
      solidColor: '#0E7490', // Cyan
      route: '/breathing',
      badge: 'Calm',
      bentoWidth: 'narrow',
      height: 164,
      watermarkIcon: 'disc',
      previewType: 'breath',
    },
    // ROW 2: Grounding (Narrow) + Gratitude (Wide)
    {
      key: 'grounding',
      icon: 'anchor',
      title: 'Grounding',
      subtitle: '5-4-3-2-1 senses',
      solidColor: '#581C87', // Violet
      route: '/grounding',
      badge: 'Sensory',
      bentoWidth: 'narrow',
      height: 164,
      watermarkIcon: 'compass',
      previewType: 'grounding',
    },
    {
      key: 'gratitude',
      icon: 'heart',
      title: 'Gratitude',
      subtitle: '3 blessings on appreciation cards',
      solidColor: '#92400E', // Amber
      route: '/gratitude',
      badge: 'Joy',
      bentoWidth: 'wide',
      height: 164,
      watermarkIcon: 'heart',
    },
    // ROW 3: Pause Timer (Half) + Reflection (Half)
    {
      key: 'pause',
      icon: 'clock',
      title: 'Pause Timer',
      subtitle: 'Mindful break & focus',
      solidColor: '#3F6212', // Lime
      route: '/pause-timer',
      badge: 'Timer',
      bentoWidth: 'half',
      height: 154,
      watermarkIcon: 'watch',
      previewType: 'timer',
    },
    {
      key: 'reflection',
      icon: 'message-circle',
      title: 'Reflection',
      subtitle: 'A question to ponder',
      solidColor: '#115E59', // Teal
      route: '/reflection',
      badge: 'Reflect',
      bentoWidth: 'half',
      height: 154,
      watermarkIcon: 'feather',
      previewType: 'reflect',
    },
  ];

  const SANCTUARY_ACTIVITIES: ActivityBentoItem[] = [
    {
      key: 'letters',
      icon: 'mail',
      title: 'Time Letters',
      subtitle: 'Write to your future or past self',
      solidColor: '#4C1D95', // Deep Velvet Violet
      route: '/letters',
      badge: 'Capsule',
      bentoWidth: 'full',
      height: 76,
      watermarkIcon: 'mail',
    },
    {
      key: 'comfort',
      icon: 'package',
      title: 'Comfort Box',
      subtitle: 'Soothing memories & calming songs',
      solidColor: '#831843', // Deep Rose / Wine
      route: '/comfort-box',
      badge: 'Soothing',
      bentoWidth: 'full',
      height: 76,
      watermarkIcon: 'heart',
    },
  ];

  const getItemWidth = (bentoWidth: ActivityBentoItem['bentoWidth']) => {
    if (bentoWidth === 'full') return totalContentWidth;
    if (bentoWidth === 'wide') return (totalContentWidth - gap) * 0.58;
    if (bentoWidth === 'narrow') return (totalContentWidth - gap) * 0.42;
    return (totalContentWidth - gap) / 2;
  };

  const renderActivityCard = (item: ActivityBentoItem) => {
    const isFullWidth = item.bentoWidth === 'full';
    const itemWidth = getItemWidth(item.bentoWidth);

    if (isFullWidth) {
      return (
        <AnimatedPressable
          key={item.key}
          onPress={() => handleActivityPress(item.route)}
          style={[styles.cardWrapper, { width: totalContentWidth }]}
        >
          <View
            style={[
              styles.solidActivityCard,
              styles.fullWidthSolidCard,
              { backgroundColor: item.solidColor },
            ]}
          >
            {/* Subtle Background Watermark */}
            <View style={styles.watermarkContainer}>
              <Feather
                name={item.watermarkIcon}
                size={76}
                color="rgba(255, 255, 255, 0.10)"
              />
            </View>

            <View style={styles.fullWidthLeft}>
              <View style={styles.activityIconBg}>
                <Feather name={item.icon} size={18} color="#FFFFFF" />
              </View>
              <View style={styles.fullWidthTextContainer}>
                <Text style={styles.fullWidthTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.fullWidthSubtitle}>
                  {item.subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.fullWidthRight}>
              {item.key === 'sounds' && isVIP ? (
                <View style={styles.vipActiveBadge}>
                  <Feather name="star" size={11} color="#F59E0B" />
                  <Text style={styles.vipActiveBadgeText}>VIP ACTIVE</Text>
                </View>
              ) : (
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>{item.badge}</Text>
                </View>
              )}
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </View>
          </View>
        </AnimatedPressable>
      );
    }

    return (
      <AnimatedPressable
        key={item.key}
        onPress={() => handleActivityPress(item.route)}
        style={[
          styles.cardWrapper,
          { width: itemWidth, height: item.height },
        ]}
      >
        <View style={[styles.solidActivityCard, { backgroundColor: item.solidColor, height: '100%' }]}>
          {/* Bottom Right Corner Background Watermark Icon */}
          <View style={styles.cornerWatermark}>
            <Feather
              name={item.watermarkIcon}
              size={68}
              color="rgba(255, 255, 255, 0.12)"
            />
          </View>

          {/* Top Bar: Pill Badge & Icon */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{item.badge}</Text>
            </View>
            <View style={styles.activityIconBg}>
              <Feather name={item.icon} size={15} color="#FFFFFF" />
            </View>
          </View>

          {/* Center Content */}
          <View style={styles.cardBody}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.activitySubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          </View>

          {/* Card Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardActionText}>Launch</Text>
            <Feather name="arrow-up-right" size={14} color="#FFFFFF" />
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <GradientBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.title}>Activities</Text>
            <Text style={styles.subtitle}>Mindful practices crafted for your inner balance.</Text>
          </View>
          <GlobalQuickMusicWidget inline />
        </View>

        {/* Section 1: Recommended For You */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="star" size={15} color={Colors.accent.amber} />
          <Text style={styles.sectionTitle}>Recommended For You</Text>
        </View>

        {/* Recommended for You — GlassCard with Ambient Glow */}
        {recommendation ? (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (recommendation.suggestion.route) {
                recordPracticeToday();
                setPracticeCompleted(true);
                router.push(recommendation.suggestion.route as any);
              }
            }}
            style={styles.heroPressable}
          >
            <GlassCard intensity="strong" padding="none" style={styles.heroGlassCard}>
              <View style={[styles.heroGlowCircle, { backgroundColor: recommendation.suggestion.color }]} />

              <View style={styles.heroContentInner}>
                <View style={styles.heroHeader}>
                  <View style={[styles.heroBadge, { backgroundColor: `${recommendation.suggestion.color}20`, borderColor: `${recommendation.suggestion.color}45` }]}>
                    <Feather name="star" size={10} color={recommendation.suggestion.color} />
                    <Text style={[styles.heroBadgeText, { color: recommendation.suggestion.color }]}>
                      {recommendation.suggestion.badge || 'Recommended'}
                    </Text>
                  </View>
                  <View style={[styles.heroIconContainer, { backgroundColor: `${recommendation.suggestion.color}20` }]}>
                    <Feather
                      name={recommendation.suggestion.icon as keyof typeof Feather.glyphMap}
                      size={20}
                      color={recommendation.suggestion.color}
                    />
                  </View>
                </View>

                <View style={styles.heroBody}>
                  <Text style={styles.heroTitle}>{recommendation.suggestion.title}</Text>
                  <Text style={styles.heroSubtitle}>{recommendation.suggestion.subtitle}</Text>
                </View>

                <View style={styles.heroFooter}>
                  <Text style={[styles.heroActionText, { color: recommendation.suggestion.color }]}>
                    {recommendation.suggestion.actionText || 'Start Practice'}
                  </Text>
                  <Feather name="arrow-right" size={14} color={recommendation.suggestion.color} />
                </View>
              </View>
            </GlassCard>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)');
            }}
            style={styles.heroPressable}
          >
            <GlassCard intensity="subtle" padding="none" style={styles.heroGlassCard}>
              <View style={styles.heroContentInner}>
                <View style={styles.heroHeader}>
                  <View style={[styles.heroBadge, { backgroundColor: `${Colors.accent.primary}15`, borderColor: `${Colors.accent.primary}35` }]}>
                    <Feather name="info" size={10} color={Colors.accent.primary} />
                    <Text style={[styles.heroBadgeText, { color: Colors.accent.primary }]}>Daily Check-in</Text>
                  </View>
                </View>

                <View style={styles.heroBody}>
                  <Text style={styles.heroTitle}>Check in with yourself</Text>
                  <Text style={styles.heroSubtitle}>Log your mood to unlock personalized wellness practices.</Text>
                </View>

                <View style={styles.heroFooter}>
                  <Text style={[styles.heroActionText, { color: Colors.accent.primary }]}>Log Mood</Text>
                  <Feather name="arrow-right" size={14} color={Colors.accent.primary} />
                </View>
              </View>
            </GlassCard>
          </AnimatedPressable>
        )}

        {/* Section 2: Soundscapes & Audio */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="music" size={15} color="#60A5FA" />
          <Text style={styles.sectionTitle}>Soundscapes & Audio</Text>
        </View>

        {/* Audio Stack */}
        <View style={styles.sanctuaryStack}>
          {AUDIO_ACTIVITIES.map(renderActivityCard)}
        </View>

        {/* Section 3: Mindful Practices */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="grid" size={15} color={Colors.accent.primary} />
          <Text style={styles.sectionTitle}>Mindful Practices</Text>
        </View>

        {/* Bento Grid Activities */}
        <View style={[styles.bentoGrid, { gap }]}>
          {PRACTICE_ACTIVITIES.map(renderActivityCard)}
        </View>

        {/* Section 4: Emotional Sanctuary */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="heart" size={15} color={Colors.accent.coral} />
          <Text style={styles.sectionTitle}>Emotional Sanctuary</Text>
        </View>

        {/* Sanctuary Stack */}
        <View style={styles.sanctuaryStack}>
          {SANCTUARY_ACTIVITIES.map(renderActivityCard)}
        </View>

        {/* Section 5: Daily Mindful Routine Tracker */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="compass" size={15} color={Colors.accent.primary} />
          <Text style={styles.sectionTitle}>Daily Routine</Text>
        </View>

        {/* Daily Mindful Routine Tracker */}
        <GlassCard intensity="strong" padding="md" style={styles.routineCard}>
          <View style={styles.routineHeader}>
            <View style={styles.routineHeaderLeft}>
              <View style={styles.routineIconCircle}>
                <Feather name="compass" size={16} color={Colors.accent.primary} />
              </View>
              <View>
                <Text style={styles.routineTitle}>Today's Mindful Routine</Text>
                <Text style={styles.routineSubtitle}>Daily rituals for emotional balance</Text>
              </View>
            </View>

            <View style={[styles.progressBadge, allCompleted && styles.progressBadgeDone]}>
              <Text style={[styles.progressBadgeText, allCompleted && styles.progressBadgeTextDone]}>
                {totalCompleted}/3 Done
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.checklist}>
            <Pressable
              style={styles.checkItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!moodCompleted) {
                  router.push('/(tabs)');
                }
              }}
            >
              <View style={[styles.checkCircle, moodCompleted && styles.checkCircleDone]}>
                {moodCompleted && <Feather name="check" size={12} color="#0A0A0C" />}
              </View>
              <View style={styles.checkContent}>
                <Text style={[styles.checkTitle, moodCompleted && styles.checkTitleDone]}>
                  Log Today's Mood
                </Text>
                <Text style={styles.checkDesc}>
                  {moodCompleted ? 'Checked in for today' : 'Capture how you feel right now'}
                </Text>
              </View>
              {!moodCompleted && (
                <Feather name="chevron-right" size={16} color="rgba(255, 255, 255, 0.35)" />
              )}
            </Pressable>

            <Pressable
              style={styles.checkItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                recordPracticeToday();
                setPracticeCompleted(true);
                if (recommendation?.suggestion?.route) {
                  router.push(recommendation.suggestion.route as any);
                } else {
                  router.push('/breathing');
                }
              }}
            >
              <View style={[styles.checkCircle, practiceCompleted && styles.checkCircleDone]}>
                {practiceCompleted && <Feather name="check" size={12} color="#0A0A0C" />}
              </View>
              <View style={styles.checkContent}>
                <Text style={[styles.checkTitle, practiceCompleted && styles.checkTitleDone]}>
                  Mindful Practice
                </Text>
                <Text style={styles.checkDesc}>
                  {practiceCompleted ? 'Completed a calming practice' : 'Breathing, Grounding, or Focus Matrix'}
                </Text>
              </View>
              {!practiceCompleted && (
                <Feather name="chevron-right" size={16} color="rgba(255, 255, 255, 0.35)" />
              )}
            </Pressable>

            <Pressable
              style={[styles.checkItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!journalCompleted) {
                  router.push('/journal-editor');
                }
              }}
            >
              <View style={[styles.checkCircle, journalCompleted && styles.checkCircleDone]}>
                {journalCompleted && <Feather name="check" size={12} color="#0A0A0C" />}
              </View>
              <View style={styles.checkContent}>
                <Text style={[styles.checkTitle, journalCompleted && styles.checkTitleDone]}>
                  Pen a Reflection or Journal
                </Text>
                <Text style={styles.checkDesc}>
                  {journalCompleted ? 'Penned thoughts for today' : 'Express your thoughts & reflections'}
                </Text>
              </View>
              {!journalCompleted && (
                <Feather name="chevron-right" size={16} color="rgba(255, 255, 255, 0.35)" />
              )}
            </Pressable>
          </View>

          {allCompleted && (
            <View style={styles.allDoneBanner}>
              <Feather name="award" size={15} color={Colors.accent.primary} />
              <Text style={styles.allDoneText}>
                All daily rituals complete! Great job maintaining your inner balance today.
              </Text>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall + 1,
    color: Colors.text.secondary,
    lineHeight: 20,
  },

  // Hero GlassCard
  heroPressable: {
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl,
  },
  heroGlassCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroGlowCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.15,
  },
  heroContentInner: {
    padding: Spacing.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption + 1,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Bento Grid
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sanctuaryStack: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  cardWrapper: {
    borderRadius: 22,
  },
  solidActivityCard: {
    borderRadius: 22,
    padding: Spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  watermarkContainer: {
    position: 'absolute',
    right: 20,
    top: -10,
  },
  cornerWatermark: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },

  fullWidthSolidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 76,
  },
  fullWidthLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  fullWidthTextContainer: {
    flex: 1,
  },
  fullWidthTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  fullWidthSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  fullWidthRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activityBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vipActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.55)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.pill,
  },
  vipActiveBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny - 1,
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardBody: {
    marginVertical: 4,
  },
  activityTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 1,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 16,
  },

  // Mini Previews
  miniMatrixPreview: {
    marginVertical: 3,
  },
  miniMatrixRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardActionText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Daily Mindful Routine Tracker
  routineCard: {
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  routineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  routineIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
  },
  routineTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  routineSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  progressBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBadgeDone: {
    backgroundColor: 'rgba(190, 255, 108, 0.18)',
    borderColor: 'rgba(190, 255, 108, 0.4)',
  },
  progressBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  progressBadgeTextDone: {
    color: Colors.accent.primary,
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.pill,
  },
  checklist: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  checkContent: {
    flex: 1,
  },
  checkTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
  },
  checkTitleDone: {
    color: 'rgba(255, 255, 255, 0.75)',
    textDecorationLine: 'line-through',
  },
  checkDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(190, 255, 108, 0.1)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
  },
  allDoneText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: '#E2FDC2',
    flex: 1,
    lineHeight: 16,
  },
});
