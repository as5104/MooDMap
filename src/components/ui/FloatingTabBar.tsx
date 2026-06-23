/**
 * MoodMap — Floating Tab Bar
 */

import React from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN, TAB_BAR_RADIUS, FAB_SIZE, Spacing } from '@/constants/layout';
import { useBlurTarget } from './GradientBackground';

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  insights: 'bar-chart-2',
  journal: 'book-open',
  activities: 'compass',
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
  const blurCtx = useBlurTarget();
  const canUseAndroidTargetBlur = Platform.OS === 'android' && !!blurCtx?.ref && blurCtx.ready;

  const routes = state.routes.filter(
    (r: any) => TAB_ICONS[r.name] !== undefined
  );

  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  const activeRoute = state.routes[state.index];
  const activeFilteredIndex = routes.findIndex(
    (r: any) => r.key === activeRoute.key
  );

  const renderTab = (route: any, index: number) => {
    const isFocused = activeFilteredIndex === index;
    const iconName = TAB_ICONS[route.name] ?? 'circle';

    const onPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          size={26}
          color={isFocused ? Colors.accent.primary : 'rgba(255, 255, 255, 0.30)'}
        />
        {isFocused && <View style={styles.activeDot} />}
      </Pressable>
    );
  };

  const renderBarBackground = () => {
    if (Platform.OS === 'ios') {
      return (
        <>
          {/* Layered blur for a denser frosted glass effect */}
          <BlurView
            intensity={100}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={100}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={100}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.barTint} />
        </>
      );
    }

    if (canUseAndroidTargetBlur) {
      return (
        <>
          {/* Layered Android blur for stronger distortion */}
          <BlurView
            intensity={100}
            tint="dark"
            blurMethod="dimezisBlurView"
            blurReductionFactor={1}
            blurTarget={blurCtx!.ref}
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={100}
            tint="dark"
            blurMethod="dimezisBlurView"
            blurReductionFactor={1}
            blurTarget={blurCtx!.ref}
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={100}
            tint="dark"
            blurMethod="dimezisBlurView"
            blurReductionFactor={1}
            blurTarget={blurCtx!.ref}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.barTint} />
        </>
      );
    }

    return <View style={styles.barSolid} />;
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* FAB rendered OUTSIDE the bar so it's not clipped */}
      <View style={styles.fabWrapper}>
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          onPress={onFabPress}
        >
          <Feather name="plus" size={30} color={Colors.text.onAccent} />
        </Pressable>
      </View>

      {/* Frosted glass bar */}
      <View style={styles.bar}>
        {renderBarBackground()}

        <View style={styles.tabContent}>
          {leftRoutes.map((route: any, i: number) => renderTab(route, i))}
          <View style={styles.fabSpacer} />
          {rightRoutes.map((route: any, i: number) => renderTab(route, i + leftRoutes.length))}
        </View>
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
    borderRadius: TAB_BAR_RADIUS,
    height: TAB_BAR_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  barTint: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(8, 10, 16, 0.84)',
  },
  barSolid: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(8, 10, 16, 1)',
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.lg,
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
    backgroundColor: Colors.accent.primary,
    marginTop: 4,
  },
  fabSpacer: {
    width: FAB_SIZE,
  },
  fabWrapper: {
    position: 'absolute',
    // Place the FAB with ~30% outside and ~70% inside the tab bar.
    top: -(FAB_SIZE * 0.3),
    alignSelf: 'center',
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
});
