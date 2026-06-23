/**
 * MoodMap — Tab Layout with Floating Tab Bar
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { FloatingTabBar } from '@/components/ui';

export default function TabLayout() {
  const handleFabPress = (activeRouteName?: string) => {
    router.push(activeRouteName === 'journal' ? '/journal-editor' : '/mood-entry');
  };

  return (
    <Tabs
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          onFabPress={() => handleFabPress(props.state.routes[props.state.index]?.name)}
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
      <Tabs.Screen name="activities" options={{ title: 'Activities' }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
