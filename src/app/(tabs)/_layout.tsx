/**
 * MoodMap — Tab Layout with Floating Tab Bar
 * Custom pill-shaped bottom bar with center FAB for mood entry
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { FloatingTabBar } from '@/components/ui';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          onFabPress={() => router.push('/mood-entry')}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="insights" options={{ title: 'Stats' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="activities" options={{ href: null }} />
    </Tabs>
  );
}
