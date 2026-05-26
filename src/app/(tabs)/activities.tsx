/**
 * MoodMap — Activities Tab (Placeholder)
 * Will be fully built in Phase 6
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Card } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';
import { AnimatedPressable } from '@/components/ui';

const ACTIVITIES = [
  { key: 'breathing', icon: 'wind' as const, title: 'Breathing Exercise', subtitle: '4-7-8 calming pattern', color: '#19C7B8' },
  { key: 'grounding', icon: 'anchor' as const, title: 'Grounding Exercise', subtitle: '5-4-3-2-1 senses technique', color: '#7C5CFC' },
  { key: 'gratitude', icon: 'heart' as const, title: 'Gratitude Prompt', subtitle: 'Write 3 things you\'re grateful for', color: '#FFD60A' },
  { key: 'pause', icon: 'pause-circle' as const, title: 'Pause Timer', subtitle: 'Take a mindful break', color: '#FF6B6B' },
  { key: 'sounds', icon: 'headphones' as const, title: 'Ambient Sounds', subtitle: 'Curated soundscapes to relax', color: '#00D9FF' },
  { key: 'reflection', icon: 'message-circle' as const, title: 'Reflection Prompt', subtitle: 'A question to ponder', color: '#6EE7A8' },
];

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();

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
        <Text style={styles.title}>Activities</Text>
        <Text style={styles.subtitle}>Choose an activity to support your mood</Text>

        <View style={styles.grid}>
          {ACTIVITIES.map((activity) => (
            <AnimatedPressable
              key={activity.key}
              style={styles.activityCard}
              onPress={() => {
                if (activity.key === 'sounds') {
                  router.push('/sound-player');
                }
              }}
            >
              <View style={[styles.activityIcon, { backgroundColor: activity.color + '20' }]}>
                <Feather name={activity.icon} size={24} color={activity.color} />
              </View>
              <Text style={styles.activityTitle}>{activity.title}</Text>
              <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  activityCard: {
    width: '48%',
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    minHeight: 160,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  activityTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  activitySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
});
