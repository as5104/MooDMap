/**
 * MoodMap — Profile Tab
 * Glassmorphic profile with XP bar and settings
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientBackground, GlassCard, Button, AnimatedPressable } from '@/components/ui';
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
    <GradientBackground variant="default">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        {/* Profile Card */}
        <GlassCard intensity="medium" padding="lg" style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </GlassCard>

        {/* Level Card */}
        <GlassCard intensity="subtle" padding="md" style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelTitle}>Level {currentLevel.level}</Text>
            <Text style={styles.levelName}>{currentLevel.title}</Text>
          </View>
          <View style={styles.xpBar}>
            <LinearGradient
              colors={['#FFD60A', '#F0C000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.xpFill,
                { width: `${Math.min(xpProgress * 100, 100)}%` as any },
              ]}
            />
          </View>
          <Text style={styles.xpText}>
            {totalXP} XP{nextLevel ? ` / ${nextLevel.xpRequired} XP` : ' (Max Level!)'}
          </Text>
        </GlassCard>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>

        {[
          { icon: 'bell' as const, label: 'Reminders', color: Colors.accent.primary },
          { icon: 'moon' as const, label: 'Theme', color: Colors.accent.teal },
          { icon: 'lock' as const, label: 'App Lock', color: '#7C5CFC' },
          { icon: 'download' as const, label: 'Export Data', color: Colors.accent.green },
          { icon: 'info' as const, label: 'About', color: 'rgba(255,255,255,0.4)' },
        ].map((item) => (
          <AnimatedPressable key={item.label} style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: item.color + '15' }]}>
              <Feather name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.settingLabel}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.2)" />
          </AnimatedPressable>
        ))}

        {/* Sign Out */}
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
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 214, 10, 0.3)',
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
    color: 'rgba(255,255,255,0.4)',
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
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
