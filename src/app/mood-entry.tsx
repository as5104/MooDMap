/**
 * MoodMap — Mood Entry Screen (Placeholder)
 * Multi-step mood check-in flow — will be fully built in Phase 3
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, SCREEN_PADDING } from '@/constants/layout';

export default function MoodEntryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Feather name="x" size={24} color={Colors.text.primary} />
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.question}>How are you feeling{'\n'}right now?</Text>
          <Text style={styles.subtitle}>Coming soon in Phase 3...</Text>
          <Text style={styles.emojis}>😊 😌 🎯 🧘 🔥 😢 😴 😰 😤 😣</Text>
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignSelf: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  question: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xxxl,
  },
  emojis: {
    fontSize: 32,
    letterSpacing: 8,
  },
});
