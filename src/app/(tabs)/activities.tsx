/**
 * MoodMap - Activities Tab
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GradientBackground, GlassCard, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { getSuggestion } from '@/constants/suggestions';
import { MOOD_MAP } from '@/constants/moods';
import { getMoodCount } from '@/services/moodService';
import { getJournalCount } from '@/services/journalService';

interface ActivityItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  route: string;
  badge: string;
}

const ACTIVITIES: ActivityItem[] = [
  { key: 'breathing', icon: 'wind', title: 'Breathing', subtitle: '4-7-8 calming pattern', color: '#6BCB77', route: '/breathing', badge: 'Calm' },
  { key: 'grounding', icon: 'anchor', title: 'Grounding', subtitle: '5-4-3-2-1 senses', color: '#C59CFF', route: '/grounding', badge: 'Stabilize' },
  { key: 'gratitude', icon: 'heart', title: 'Gratitude', subtitle: '3 things grateful for', color: '#FFD166', route: '/gratitude', badge: 'Joy' },
  { key: 'pause', icon: 'clock', title: 'Pause Timer', subtitle: 'Take a mindful break', color: '#FF7A6E', route: '/pause-timer', badge: 'Pause' },
  { key: 'sounds', icon: 'music', title: 'Music Player', subtitle: 'Ambient & Lo-fi music', color: '#74B9FF', route: '/music', badge: 'Audio' },
  { key: 'reflection', icon: 'message-circle', title: 'Reflection', subtitle: 'A question to ponder', color: '#4ECDC4', route: '/reflection', badge: 'Reflect' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const todayMood = useAppStore((s) => s.todayMood);
  const user = useAppStore((s) => s.user);
  const isAppReady = useAppStore((s) => s.isAppReady);

  // Mood-based recommended activity
  const recommendation = useMemo(() => {
    if (!todayMood) return null;
    const suggestion = getSuggestion(todayMood.moodType, todayMood.stressLevel);
    const mood = MOOD_MAP[todayMood.moodType];
    return { suggestion, mood };
  }, [todayMood]);

  // Quick stats
  const stats = useMemo(() => {
    if (!isAppReady) return { moods: 0, journals: 0 };
    const userId = user?.id;
    return {
      moods: getMoodCount(userId),
      journals: getJournalCount(userId),
    };
  }, [user?.id, isAppReady]);

  const handleActivityPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

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
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Mind Studio</Text>
          </View>
          <Text style={styles.title}>Wellness Studio</Text>
          <Text style={styles.subtitle}>Mindful practices crafted for your inner balance.</Text>
        </View>

        {/* Recommended for You or Check-in Promotion — Hero Card */}
        {recommendation ? (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (recommendation.suggestion.route) {
                router.push(recommendation.suggestion.route as any);
              }
            }}
            style={styles.heroPressable}
          >
            <GlassCard intensity="strong" padding="none" style={styles.heroGlassCard}>
              {/* Outer border neon wash */}
              <View style={[styles.heroGlowCircle, { backgroundColor: recommendation.mood.color }]} />
              
              <View style={styles.heroContentInner}>
                <View style={styles.heroHeader}>
                  <View style={[styles.heroBadge, { backgroundColor: `${recommendation.mood.color}15`, borderColor: `${recommendation.mood.color}35` }]}>
                    <Feather name="star" size={10} color={recommendation.mood.color} />
                    <Text style={[styles.heroBadgeText, { color: recommendation.mood.color }]}>Recommended</Text>
                  </View>
                  <View style={[styles.heroIconContainer, { backgroundColor: `${recommendation.suggestion.color}15` }]}>
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
                  <Text style={[styles.heroActionText, { color: recommendation.mood.color }]}>Start Practice</Text>
                  <Feather name="arrow-right" size={14} color={recommendation.mood.color} />
                </View>
              </View>
            </GlassCard>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/mood-entry');
            }}
            style={styles.heroPressable}
          >
            <GlassCard intensity="strong" padding="none" style={[styles.heroGlassCard, styles.checkinPromoBorder]}>
              {/* Soft primary glow */}
              <View style={[styles.heroGlowCircle, { backgroundColor: Colors.accent.primary }]} />
              
              <View style={styles.heroContentInner}>
                <View style={styles.heroHeader}>
                  <View style={[styles.heroBadge, { backgroundColor: `${Colors.accent.primary}15`, borderColor: `${Colors.accent.primary}25` }]}>
                    <Feather name="heart" size={10} color={Colors.accent.primary} />
                    <Text style={[styles.heroBadgeText, { color: Colors.accent.primary }]}>Reveal Recommended</Text>
                  </View>
                  <View style={[styles.heroIconContainer, { backgroundColor: `${Colors.accent.primary}15` }]}>
                    <Feather name="smile" size={20} color={Colors.accent.primary} />
                  </View>
                </View>

                <View style={styles.heroBody}>
                  <Text style={styles.heroTitle}>How are you feeling today?</Text>
                  <Text style={styles.heroSubtitle}>Log your mood to unlock a mindful practice recommended just for you.</Text>
                </View>

                <View style={styles.heroFooter}>
                  <Text style={[styles.heroActionText, { color: Colors.accent.primary }]}>Check-in Now</Text>
                  <Feather name="arrow-right" size={14} color={Colors.accent.primary} />
                </View>
              </View>
            </GlassCard>
          </AnimatedPressable>
        )}

        {/* Activity Grid Section */}
        <View style={styles.sectionHeaderRow}>
          <Feather name="grid" size={14} color={Colors.accent.primary} />
          <Text style={styles.sectionTitle}>Mind & Body Studio</Text>
        </View>

        <View style={styles.grid}>
          {ACTIVITIES.map((activity) => (
            <AnimatedPressable
              key={activity.key}
              style={[styles.activityCardWrapper, { width: CARD_WIDTH }]}
              onPress={() => handleActivityPress(activity.route)}
            >
              <GlassCard intensity="subtle" padding="none" style={styles.activityGlassCard}>
                {/* Glow Orb in background */}
                <View style={[styles.cardGlow, { backgroundColor: activity.color }]} />
                
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.activityIconBg, { backgroundColor: `${activity.color}15` }]}>
                    <Feather name={activity.icon} size={18} color={activity.color} />
                  </View>
                  <View style={[styles.activityBadge, { backgroundColor: `${activity.color}12`, borderColor: `${activity.color}25` }]}>
                    <Text style={[styles.activityBadgeText, { color: activity.color }]}>{activity.badge}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text numberOfLines={2} style={styles.activitySubtitle}>{activity.subtitle}</Text>
                </View>
                
                <View style={styles.cardFooter}>
                  <Feather name="arrow-up-right" size={14} color={`${activity.color}60`} />
                </View>
              </GlassCard>
            </AnimatedPressable>
          ))}
        </View>

        {/* Practice Progress Dashboard */}
        <GlassCard intensity="subtle" padding="none" style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <View style={styles.statsHeaderLeft}>
              <Feather name="compass" size={16} color={Colors.accent.primary} />
              <Text style={styles.statsTitle}>Practice Summary</Text>
            </View>
            <Text style={styles.statsLevelText}>Level 1 Mindful</Text>
          </View>
          <View style={styles.statsDividerLine} />
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: `${Colors.accent.primary}10` }]}>
                <Feather name="check-circle" size={16} color={Colors.accent.primary} />
              </View>
              <Text style={styles.statValue}>{stats.moods}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: `${Colors.accent.lavender}10` }]}>
                <Feather name="book-open" size={16} color={Colors.accent.lavender} />
              </View>
              <Text style={styles.statValue}>{stats.journals}</Text>
              <Text style={styles.statLabel}>Journals</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: `${Colors.accent.amber}10` }]}>
                <Feather name="activity" size={16} color={Colors.accent.amber} />
              </View>
              <Text style={styles.statValue}>6</Text>
              <Text style={styles.statLabel}>Practices</Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  header: {
    marginBottom: Spacing.xxl,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
  },
  headerBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Hero Card
  heroPressable: {
    marginBottom: Spacing.xxl,
    borderRadius: 24,
  },
  heroGlassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  checkinPromoBorder: {
    borderColor: 'rgba(190, 255, 108, 0.15)',
  },
  heroGlowCircle: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.06,
  },
  heroContentInner: {
    padding: Spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2 - 2,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
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
    fontSize: FontSizes.bodySmall + 1,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  activityCardWrapper: {
    borderRadius: 20,
  },
  activityGlassCard: {
    flex: 1,
    borderRadius: 20,
    padding: Spacing.md,
    minHeight: 154,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardGlow: {
    position: 'absolute',
    right: -25,
    bottom: -25,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.06,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  activityIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  activityBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 2,
  },
  activityTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 14,
  },
  cardFooter: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },

  // Stats Card
  statsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: Spacing.xl,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.bodySmall + 1,
    color: Colors.text.primary,
  },
  statsLevelText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },
  statsDividerLine: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: Colors.text.primary,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
