/**
 * MoodMap — Entry Point
 * Routes user to auth, onboarding, or home based on state
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '@/stores/appStore';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';

export default function Index() {
  const session = useAppStore((s) => s.session);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  // Show loading while initializing
  if (isAuthLoading || !isAppReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🗺️</Text>
        <Text style={styles.title}>MoodMap</Text>
      </View>
    );
  }

  // Not authenticated → go to login
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but hasn't completed onboarding
  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }

  // Fully ready → go to home
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.hero,
    color: Colors.accent.olive,
  },
});
