/**
 * MoodMap — Root Layout
 * Loads Poppins + Sora fonts, initializes DB, listens to auth state,
 * and reactively redirects based on authentication status.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/colors';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/lib/supabase';
import { initializeDatabase } from '@/db/client';

// Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Reactively guards routes based on auth state.
 * When the user signs out (session becomes null), they are immediately
 * redirected to the login screen. When they sign in, they go to the
 * index which handles onboarding/home routing.
 */
function useProtectedRoute() {
  const session = useAppStore((s) => s.session);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while still loading
    if (isAuthLoading || !isAppReady) return;

    // Determine which route group the user is currently in
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // User is NOT authenticated but is outside the auth screens
      // → Force them to the login screen
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // User IS authenticated but still on an auth screen (e.g. just logged in)
      // → Send them to the index which handles onboarding/home routing
      router.replace('/');
    }
  }, [session, isAuthLoading, isAppReady, segments]);
}

export default function RootLayout() {
  const setSession = useAppStore((s) => s.setSession);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setAppReady = useAppStore((s) => s.setAppReady);
  const resetForSignOut = useAppStore((s) => s.resetForSignOut);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  // Initialize app: DB + Auth
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize SQLite database
        await initializeDatabase();

        // Check for existing session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (error) {
        console.error('[App] Initialization error:', error);
      } finally {
        setAuthLoading(false);
        setAppReady(true);
      }
    };

    init();

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Clear all user data from the store
          resetForSignOut();
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Activate the auth guard
  useProtectedRoute();

  // Hide splash once fonts are loaded and app is ready
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background.primary },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="mood-entry"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="journal-editor"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="sound-player"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
});
