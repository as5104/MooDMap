/**
 * MoodMap — Activities Tab
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, GlassCard, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';

const ACTIVITIES = [
  { key: 'breathing', icon: 'wind' as const, title: 'Breathing', subtitle: '4-7-8 calming pattern', color: '#6BCB77' },
  { key: 'grounding', icon: 'anchor' as const, title: 'Grounding', subtitle: '5-4-3-2-1 senses', color: '#C59CFF' },
  { key: 'gratitude', icon: 'heart' as const, title: 'Gratitude', subtitle: '3 things you\'re grateful for', color: '#FFD166' },
  { key: 'pause', icon: 'pause-circle' as const, title: 'Pause Timer', subtitle: 'Take a mindful break', color: '#FF6B6B' },
  { key: 'sounds', icon: 'headphones' as const, title: 'Sounds', subtitle: 'Soundscapes to relax', color: '#74B9FF' },
  { key: 'reflection', icon: 'message-circle' as const, title: 'Reflection', subtitle: 'A question to ponder', color: '#4ECDC4' },
];

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();

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
              <View style={[styles.activityIcon, { backgroundColor: activity.color + '15' }]}>
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
    color: 'rgba(255,255,255,0.4)',
    marginBottom: Spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  activityCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 150,
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
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 16,
  },
});
