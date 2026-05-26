/**
 * MoodMap — Home Dashboard
 * The main screen users see after login
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Card, Button, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { getMoodByType } from '@/constants/moods';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const todayMood = useAppStore((s) => s.todayMood);
  const moodStreak = useAppStore((s) => s.moodStreak);

  const displayName = user?.user_metadata?.display_name ?? 'there';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const moodDef = todayMood ? getMoodByType(todayMood.moodType) : null;

  return (
    <GradientBackground withGlow>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Greeting ─── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>
              {greeting}, {displayName} 👋
            </Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <AnimatedPressable
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.profileInitial}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </AnimatedPressable>
        </View>

        {/* ─── Today's Mood Card ─── */}
        {todayMood && moodDef ? (
          <Card
            glowColor={moodDef.color}
            padding="lg"
            style={styles.moodCard}
          >
            <Text style={styles.moodCardLabel}>Today's Mood</Text>
            <View style={styles.moodCardRow}>
              <Text style={styles.moodEmoji}>{moodDef.emoji}</Text>
              <View style={styles.moodCardInfo}>
                <Text style={[styles.moodName, { color: moodDef.color }]}>
                  {moodDef.label}
                </Text>
                <Text style={styles.moodScore}>
                  Intensity: {todayMood.moodScore}/10
                </Text>
              </View>
            </View>
            {todayMood.note ? (
              <Text style={styles.moodNote}>"{todayMood.note}"</Text>
            ) : null}
          </Card>
        ) : (
          <Card
            onPress={() => router.push('/mood-entry')}
            glowColor={Colors.accent.teal}
            padding="lg"
            style={styles.moodCard}
          >
            <Text style={styles.checkinTitle}>How are you feeling?</Text>
            <Text style={styles.checkinSubtitle}>
              Tap to log your mood for today
            </Text>
            <View style={styles.checkinEmojis}>
              {['😊', '😌', '😢', '😤', '🔥'].map((emoji) => (
                <Text key={emoji} style={styles.checkinEmoji}>
                  {emoji}
                </Text>
              ))}
            </View>
          </Card>
        )}

        {/* ─── Quick Actions ─── */}
        <View style={styles.quickActions}>
          <AnimatedPressable
            style={styles.quickAction}
            onPress={() => router.push('/mood-entry')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.accent.primaryMuted }]}>
              <Feather name="smile" size={20} color={Colors.accent.primary} />
            </View>
            <Text style={styles.quickActionText}>Check-in</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.quickAction}
            onPress={() => router.push('/journal-editor')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.accent.tealMuted }]}>
              <Feather name="edit-3" size={20} color={Colors.accent.teal} />
            </View>
            <Text style={styles.quickActionText}>Journal</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.quickAction}
            onPress={() => router.push('/sound-player')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(124, 92, 252, 0.15)' }]}>
              <Feather name="headphones" size={20} color="#7C5CFC" />
            </View>
            <Text style={styles.quickActionText}>Sounds</Text>
          </AnimatedPressable>
        </View>

        {/* ─── Streak Card ─── */}
        <Card padding="md" style={styles.streakCard}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFire}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakCount}>{moodStreak} day streak</Text>
              <Text style={styles.streakSubtext}>
                {moodStreak === 0
                  ? 'Start your streak today!'
                  : 'Keep it going!'}
              </Text>
            </View>
          </View>
        </Card>

        {/* ─── Suggested Action ─── */}
        <Card padding="md" style={styles.suggestionCard}>
          <View style={styles.suggestionRow}>
            <View style={styles.suggestionIconBg}>
              <Feather name="wind" size={20} color={Colors.accent.teal} />
            </View>
            <View style={styles.suggestionInfo}>
              <Text style={styles.suggestionTitle}>Try a breathing exercise</Text>
              <Text style={styles.suggestionSubtitle}>
                A 4-7-8 pattern can help calm your mind
              </Text>
            </View>
          </View>
          <Button
            title="Try it"
            variant="teal"
            size="sm"
            onPress={() => router.push('/(tabs)/activities')}
            style={styles.suggestionButton}
          />
        </Card>

        {/* ─── Bottom spacing ─── */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: Spacing.section,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  greetingText: { flex: 1 },
  greeting: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  date: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.primary,
  },
  profileInitial: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.accent.primary,
  },

  // Mood Card
  moodCard: { marginBottom: Spacing.xl },
  moodCardLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  moodCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodEmoji: { fontSize: 48, marginRight: Spacing.lg },
  moodCardInfo: { flex: 1 },
  moodName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    marginBottom: Spacing.xs,
  },
  moodScore: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  moodNote: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.md,
  },

  // Check-in CTA
  checkinTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  checkinSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  checkinEmojis: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  checkinEmoji: { fontSize: 32 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },

  // Streak
  streakCard: { marginBottom: Spacing.xl },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFire: { fontSize: 36, marginRight: Spacing.lg },
  streakInfo: { flex: 1 },
  streakCount: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  streakSubtext: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },

  // Suggestion
  suggestionCard: { marginBottom: Spacing.xl },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  suggestionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  suggestionInfo: { flex: 1 },
  suggestionTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  suggestionSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  suggestionButton: { alignSelf: 'flex-start' },
});
