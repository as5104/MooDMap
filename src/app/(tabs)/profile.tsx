/**
 * MoodMap — Profile Tab (Placeholder)
 * Will be fully built in Phase 6
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Card, Button, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { signOut } from '@/lib/auth';
import { getLevelForXP, getNextLevel } from '@/constants/badges';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const totalXP = useAppStore((s) => s.totalXP);

  const displayName = user?.user_metadata?.display_name ?? 'User';
  const email = user?.email ?? '';
  const currentLevel = getLevelForXP(totalXP);
  const nextLevel = getNextLevel(currentLevel.level);
  const xpProgress = nextLevel
    ? (totalXP - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)
    : 1;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <GradientBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        {/* ─── Profile Card ─── */}
        <Card padding="lg" style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </Card>

        {/* ─── Level Card ─── */}
        <Card padding="md" style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelTitle}>Level {currentLevel.level}</Text>
            <Text style={styles.levelName}>{currentLevel.title}</Text>
          </View>
          <View style={styles.xpBar}>
            <View
              style={[
                styles.xpFill,
                { width: `${Math.min(xpProgress * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.xpText}>
            {totalXP} XP{nextLevel ? ` / ${nextLevel.xpRequired} XP` : ' (Max Level!)'}
          </Text>
        </Card>

        {/* ─── Settings ─── */}
        <Text style={styles.sectionTitle}>Settings</Text>

        {[
          { icon: 'bell' as const, label: 'Reminders', color: Colors.accent.primary },
          { icon: 'moon' as const, label: 'Theme', color: Colors.accent.teal },
          { icon: 'lock' as const, label: 'App Lock', color: '#7C5CFC' },
          { icon: 'download' as const, label: 'Export Data', color: Colors.accent.green },
          { icon: 'info' as const, label: 'About', color: Colors.text.secondary },
        ].map((item) => (
          <AnimatedPressable key={item.label} style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: item.color + '20' }]}>
              <Feather name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.settingLabel}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
          </AnimatedPressable>
        ))}

        {/* ─── Sign Out ─── */}
        <Button
          title="Sign Out"
          variant="ghost"
          onPress={handleSignOut}
          fullWidth
          style={styles.signOutButton}
          icon={<Feather name="log-out" size={18} color={Colors.error} />}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  pageTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xxl,
  },

  // Profile
  profileCard: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.primary,
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.accent.primary,
  },
  userName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },

  // Level
  levelCard: { marginBottom: Spacing.xxl },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  levelTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  levelName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.primary,
  },
  xpBar: {
    height: 8,
    backgroundColor: Colors.background.elevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.accent.primary,
    borderRadius: 4,
  },
  xpText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  // Settings
  sectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  signOutButton: {
    marginTop: Spacing.xxl,
  },
});
