/**
 * MoodMap — Journal Tab (Placeholder)
 * Will be fully built in Phase 4
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Card, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <Text style={styles.title}>Journal</Text>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="edit-3" size={48} color={Colors.accent.teal} />
          </View>
          <Text style={styles.emptyTitle}>Start Writing</Text>
          <Text style={styles.emptyText}>
            Capture your thoughts, feelings, and reflections in your personal journal.
          </Text>
          <Button
            title="New Entry"
            onPress={() => router.push('/journal-editor')}
            size="lg"
            icon={<Feather name="plus" size={18} color={Colors.text.onAccent} />}
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xxl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accent.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
});
