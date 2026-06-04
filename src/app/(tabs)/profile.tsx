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
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { signOut } from '@/lib/auth';
import { getMoodScore, getMoodStreak, getMoodCount } from '@/services/moodService';
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
      const scoreVal = getMoodScore(userId);

      setJournalCount(jCount);
      setMoodCount(mCount);
      setStreak(streakData.current);
      setScore(scoreVal);
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
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // The auth state listener in _layout.tsx will handle navigation,
            // but we also navigate explicitly for immediate feedback
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

        {/* Stats Row */}
        <GlassCard intensity="medium" padding="lg" style={styles.statsRow}>
          <View style={styles.statsInner}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{journalCount}</Text>
              <Text style={styles.statLabel}>Journals</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{score || '—'}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
          </View>
        </GlassCard>

        {/* XP Progress */}
        <GlassCard intensity="medium" padding="lg" style={styles.xpCard}>
          <View style={styles.xpRow}>
            <Text style={styles.xpTitle}>Mood Level</Text>
            <Text style={styles.xpLevel}>Lvl {currentLevel}</Text>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${Math.max(xpProgress * 100, 2)}%` }]} />
          </View>
          <Text style={styles.xpText}>
            {xpInLevel} / {XP_PER_LEVEL} XP to next level • {moodCount} total entries
          </Text>
        </GlassCard>

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

  statsRow: {
    marginBottom: Spacing.xl,
  },
  statsInner: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  xpCard: {
    marginBottom: Spacing.xl,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  xpTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  xpLevel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.olive,
  },
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.sm,
  },
  xpBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.olive,
  },
  xpText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
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
