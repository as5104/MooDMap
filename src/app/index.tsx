import React, { useEffect } from 'react';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { useAppStore } from '@/stores/appStore';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const session = useAppStore((s) => s.session);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const router = useRouter();

  useEffect(() => {
    if (isAuthLoading || !isAppReady) return;

    if (!session) {
      router.replace('/(auth)/login');
    } else if (!hasCompletedOnboarding) {
      router.replace('/(onboarding)');
    } else {
      router.replace('/(tabs)');
    }
  }, [session, isAuthLoading, isAppReady, hasCompletedOnboarding]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Feather name="map" size={34} color={Colors.accent.olive} />
      </View>
      <Text style={styles.title}>MoodMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.hero,
    color: Colors.accent.olive,
  },
});
