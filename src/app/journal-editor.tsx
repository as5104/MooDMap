/**
 * MoodMap — Journal Editor Screen (Placeholder)
 * Will be fully built in Phase 4
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

export default function JournalEditorScreen() {
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Feather name="x" size={24} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.title}>New Entry</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.center}>
          <Feather name="edit-3" size={48} color={Colors.accent.olive} />
          <Text style={styles.placeholder}>Journal editor coming in Phase 4...</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SCREEN_PADDING },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxl,
  },
  closeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  title: {
    fontFamily: Fonts.heading, fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, gap: Spacing.lg,
  },
  placeholder: {
    fontFamily: Fonts.body, fontSize: FontSizes.body,
    color: Colors.text.secondary,
  },
});
