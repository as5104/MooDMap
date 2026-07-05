/**
 * MoodMap — Spotify OAuth Callback Route
 * Handles deep linking redirects from Spotify authentication.
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { GradientBackground } from '@/components/ui';

export default function SpotifyCallbackScreen() {
  useEffect(() => {
    // Redirect back to profile where the useSpotify hook will finish processing the response
    const timer = setTimeout(() => {
      router.replace('/(tabs)/profile');
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <GradientBackground style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.title}>Connecting Spotify</Text>
        <Text style={styles.subtitle}>Returning you to MooDMap...</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
});
