/**
 * MoodMap — Profile Screen
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, Button, customAlert } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { signOut } from '@/lib/auth';
import { getMoodScoreForPeriod, getMoodStreak, getMoodCount } from '@/services/moodService';
import { getJournalCount } from '@/services/journalService';
import { exportUserData, importUserData } from '@/services/dataTransferService';

// XP thresholds per level
const XP_PER_LEVEL = 500;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const totalXP = useAppStore((s) => s.totalXP);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const displayName = user?.user_metadata?.display_name ?? 'User';
  const email = user?.email ?? '';

  const [journalCount, setJournalCount] = useState(0);
  const [moodCount, setMoodCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);

  const refreshData = useAppStore((s) => s.refreshData);

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const jCount = getJournalCount(userId);
      const mCount = getMoodCount(userId);
      const streakData = getMoodStreak(userId);
      const scoreVal = getMoodScoreForPeriod(userId, 7);

      setJournalCount(jCount);
      setMoodCount(mCount);
      setStreak(streakData.current);
      setScore(scoreVal);

      // Dynamically calculate and update total XP in store
      const computedXP = (mCount * 25) + (jCount * 15);
      useAppStore.getState().setTotalXP(computedXP);
    } catch (e) {
      console.error('[Profile] Load error:', e);
    }
  }, [user?.id, dataVersion, isAppReady]);

  const handleExport = async () => {
    if (!user?.id) return;
    await exportUserData(user.id);
  };

  const handleImport = async () => {
    if (!user?.id) return;
    const success = await importUserData(user.id);
    if (success) {
      refreshData(); // Trigger UI refresh across all screens
      loadData();     // Refresh profile stats
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currentLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXP % XP_PER_LEVEL;
  const xpProgress = xpInLevel / XP_PER_LEVEL;

  const handleLogout = async () => {
    customAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // The auth state listener in _layout.tsx will handle navigation,
            // also navigate explicitly for immediate feedback
            router.replace('/(auth)/login');
          } catch (e) {
            console.error('[Profile] Sign out error:', e);
          }
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'bell' as const, label: 'Notifications', value: 'On', onPress: undefined as (() => void) | undefined },
    { icon: 'shield' as const, label: 'Privacy', value: '', onPress: undefined as (() => void) | undefined },
    { icon: 'download' as const, label: 'Export Data', value: '', onPress: handleExport },
    { icon: 'upload' as const, label: 'Import Data', value: '', onPress: handleImport },
    { icon: 'moon' as const, label: 'Theme', value: 'Dark', onPress: undefined as (() => void) | undefined },
    { icon: 'info' as const, label: 'About', value: 'v1.0', onPress: undefined as (() => void) | undefined },
  ];

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
        <Text style={styles.title}>Profile</Text>

        {/* Avatar Card */}
        <GlassCard intensity="medium" padding="lg" style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.memberBadge}>
                <Feather name="star" size={12} color={Colors.accent.olive} />
                <Text style={styles.memberText}>Member</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Dashboard Section: Circle Progress & Stats Side-by-Side */}
        <View style={styles.dashboardRow}>
          {/* Left Card: Ring for Mood Level / XP Progress */}
          <GlassCard intensity="medium" padding="md" style={styles.leftDashboardCard}>
            <View style={styles.circleContainer}>
              <Svg width={110} height={110} viewBox="0 0 100 100">
                {/* Thin dark track circle */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="6.5"
                  fill="none"
                />
                {/* Glowing border underlay */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke={Colors.accent.primary}
                  strokeWidth="11"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - Math.max(xpProgress, 0.02))}`}
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.12"
                  transform="rotate(-90 50 50)"
                />
                {/* Main progress arc */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke={Colors.accent.primary}
                  strokeWidth="6.5"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - Math.max(xpProgress, 0.02))}`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              {/* Inner Text content overlay */}
              <View style={styles.circleTextOverlay}>
                <Text style={styles.circleLevelLabel}>Lvl</Text>
                <Text style={styles.circleLevelValue}>{currentLevel}</Text>
                <Text style={styles.circleXPText}>
                  {xpInLevel}/{XP_PER_LEVEL}
                </Text>
              </View>
            </View>
            <Text style={styles.circleCardFooter} numberOfLines={1}>
              {moodCount} total entries
            </Text>
          </GlassCard>

          {/* Right Card: Score, Journals & Streak */}
          <GlassCard intensity="medium" padding="md" style={styles.rightDashboardCard}>
            {/* Top half: Mood Score */}
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreValue}>{score || '—'}</Text>
              <Text style={styles.scoreLabel}>Mood Score</Text>
            </View>

            {/* Separator */}
            <View style={styles.cardDivider} />

            {/* Bottom half: Journal & Streak side-by-side */}
            <View style={styles.bottomStatsRow}>
              <View style={styles.bottomStatItem}>
                <Text style={styles.bottomStatValue}>{journalCount}</Text>
                <Text style={styles.bottomStatLabel}>Journals</Text>
              </View>
              <View style={styles.bottomStatDivider} />
              <View style={styles.bottomStatItem}>
                <Text style={styles.bottomStatValue}>{streak}</Text>
                <Text style={styles.bottomStatLabel}>Streak</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Menu */}
        <GlassCard intensity="subtle" padding="none" style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <Pressable
              key={item.label}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuDivider]}
              onPress={item.onPress}
            >
              <Feather name={item.icon} size={20} color={Colors.accent.olive} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuValue}>{item.value}</Text>
              <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
            </Pressable>
          ))}
        </GlassCard>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          variant="ghost"
          size="md"
          fullWidth
          onPress={handleLogout}
          style={styles.signOutBtn}
        />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xxl,
  },

  profileCard: {
    marginBottom: Spacing.xl,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.olive,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.onAccent,
  },
  profileInfo: { flex: 1 },
  name: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  memberText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.accent.olive,
  },

  dashboardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    alignItems: 'stretch',
  },
  leftDashboardCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightDashboardCard: {
    flex: 1,
    justifyContent: 'space-between',
  },
  circleContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLevelLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  circleLevelValue: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: Colors.text.primary,
    lineHeight: 32,
  },
  circleXPText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.accent.olive,
    lineHeight: 12,
  },
  circleCardFooter: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  scoreValue: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    color: Colors.text.primary,
    lineHeight: 36,
  },
  scoreLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.sm,
  },
  bottomStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  bottomStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  bottomStatValue: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.text.primary,
    lineHeight: 26,
  },
  bottomStatLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  bottomStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  menuCard: {
    marginBottom: Spacing.xxl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    flex: 1,
  },
  menuValue: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginRight: Spacing.sm,
  },

  signOutBtn: {
    marginBottom: Spacing.xxl,
  },
});
