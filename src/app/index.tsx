/**
 * MoodMap - Entry Point
 * Routes user to auth, onboarding, or home based on state
 */

import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { useAppStore } from '@/stores/appStore';
import { Feather } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const session = useAppStore((s) => s.session);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  if (isAuthLoading || !isAppReady) {
    return (
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Feather name="map" size={34} color={Colors.accent.olive} />
        </View>
        <Text style={styles.title}>MoodMap</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(tabs)" />;
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
