/**
 * MoodMap — Sound Player Screen (Placeholder)
 * Will be fully built in Phase 6
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

export default function SoundPlayerScreen() {
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Feather name="x" size={24} color={Colors.text.primary} />
        </Pressable>

        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Feather name="headphones" size={48} color={Colors.accent.olive} />
          </View>
          <Text style={styles.title}>Ambient Sounds</Text>
          <Text style={styles.subtitle}>
            Curated soundscapes to help you relax, focus, and unwind.
          </Text>
          <Text style={styles.coming}>Coming in Phase 6...</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SCREEN_PADDING },
  closeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignSelf: 'flex-end',
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(168, 181, 114, 0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: Fonts.heading, fontSize: FontSizes.h1,
    color: Colors.text.primary, marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.body, fontSize: FontSizes.body,
    color: Colors.text.secondary, textAlign: 'center',
    lineHeight: 24, maxWidth: 280, marginBottom: Spacing.xxl,
  },
  coming: {
    fontFamily: Fonts.bodyMedium, fontSize: FontSizes.bodySmall,
    color: Colors.text.tertiary,
  },
});
