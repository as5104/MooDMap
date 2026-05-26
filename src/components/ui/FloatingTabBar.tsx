/**
 * MoodMap — Floating Tab Bar with Center FAB
 * Pill-shaped bar with glowing green "+" button, matching Freud reference
 */

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN, TAB_BAR_RADIUS, FAB_SIZE, Spacing } from '@/constants/layout';

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  insights: 'bar-chart-2',
  journal: 'book-open',
  profile: 'user',
};

interface FloatingTabBarProps {
  state: any;
  navigation: any;
  descriptors: any;
  onFabPress?: () => void;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  navigation,
  onFabPress,
}) => {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter(
    (r: any) => TAB_ICONS[r.name] !== undefined
  );

  // Split routes into left (first 2) and right (last 2) for FAB in center
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  // Compute the real active index within filtered routes
  const activeRoute = state.routes[state.index];
  const activeFilteredIndex = routes.findIndex(
    (r: any) => r.key === activeRoute.key
  );

  const renderTab = (route: any, index: number) => {
    const isFocused = activeFilteredIndex === index;
    const iconName = TAB_ICONS[route.name] ?? 'circle';

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tab}
        hitSlop={{ top: 10, bottom: 10 }}
      >
        <Feather
          name={iconName}
          size={22}
          color={isFocused ? Colors.accent.olive : 'rgba(240, 235, 227, 0.3)'}
        />
        {isFocused && <View style={styles.activeDot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {/* Left tabs */}
        {leftRoutes.map((route: any, i: number) => renderTab(route, i))}

        {/* Center FAB */}
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          onPress={onFabPress}
        >
          <Feather name="plus" size={26} color={Colors.text.onAccent} />
        </Pressable>

        {/* Right tabs */}
        {rightRoutes.map((route: any, i: number) => renderTab(route, i + leftRoutes.length))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: TAB_BAR_MARGIN,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.background.card,
    borderRadius: TAB_BAR_RADIUS,
    height: TAB_BAR_HEIGHT,
    width: '100%',
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(240, 235, 227, 0.06)',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent.olive,
    marginTop: 4,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.accent.olive,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    // Glow
    shadowColor: Colors.accent.olive,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
});
