/** MooDMap — floating navigation with a separate quick-entry island. */
import { Colors } from '@/constants/colors';
import { TAB_BAR_MARGIN } from '@/constants/layout';
import { Fonts } from '@/constants/typography';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home', insights: 'bar-chart-2', journal: 'book-open', activities: 'compass',
};
const TAB_LABELS: Record<string, string> = {
  index: 'Home', insights: 'Stats', journal: 'Journal', activities: 'Activities',
};
const SELECTION_SPRING = { damping: 26, stiffness: 320, mass: 0.75, overshootClamping: true };
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.55 };

interface FloatingTabBarProps {
  state: any;
  navigation: any;
  descriptors: any;
  onFabPress?: () => void;
}
interface TabButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const TabButton = React.memo(function TabButton({
  icon, label, selected, onPress, accessibilityLabel, testID,
}: TabButtonProps) {
  const reduceMotion = useReducedMotion();
  const focus = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    focus.set(withTiming(selected ? 1 : 0, { duration: 180 }));
  }, [selected, focus]);
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduceMotion ? 0 : -1.5 * focus.get() }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.get(), [0, 1], ['#B1B7C2', '#F1FAE8']),
  }));
  return (
    <Pressable
      accessibilityRole="tab" accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label} testID={testID}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(reduceMotion ? 1 : 0.92, { duration: 90 }))}
      onPressOut={() => press.set(withSpring(1, PRESS_SPRING))}
      style={styles.tab}
    >
      <Animated.View pointerEvents="none" style={[styles.tabContent, contentStyle]}>
        <Animated.View style={iconStyle}>
          <Feather name={icon} size={21} color={selected ? Colors.accent.primary : '#C0C5CE'} />
        </Animated.View>
        <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
          maxFontSizeMultiplier={1.2} style={[styles.label, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

const QuickEntryButton = React.memo(function QuickEntryButton({
  journal, onPress,
}: { journal: boolean; onPress?: () => void }) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.07 }, { translateY: pressed.get() * 2 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${pressed.get() * -12}deg` }] }));
  return (
    <Animated.View style={[styles.actionShadow, surfaceStyle]}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={journal ? 'New journal entry' : 'Log your mood'}
        onPress={onPress}
        onPressIn={() => pressed.set(withTiming(reduceMotion ? 0 : 1, { duration: 100 }))}
        onPressOut={() => pressed.set(withSpring(0, PRESS_SPRING))}
        style={styles.actionButton}>
        <LinearGradient pointerEvents="none"
          colors={['#E0FFB5', Colors.accent.primary, '#A3DE53']} locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.actionInnerRim} />
        <Animated.View pointerEvents="none" style={iconStyle}>
          <Feather name="plus" size={28} color="#1C300B" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

/** Each pair has its own highlight; crossing the action island crossfades them. */
const NavigationIsland = ({ selectedIndex, children }: {
  selectedIndex: number;
  children: React.ReactNode[];
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedPosition = useSharedValue(Math.max(0, selectedIndex));
  const selectionOpacity = useSharedValue(selectedIndex >= 0 ? 1 : 0);
  const slotWidth = children.length > 0 ? trackWidth / children.length : 0;
  useEffect(() => {
    if (selectedIndex >= 0) selectedPosition.set(withSpring(selectedIndex, SELECTION_SPRING));
    selectionOpacity.set(withTiming(selectedIndex >= 0 ? 1 : 0, { duration: 160 }));
  }, [selectedIndex, selectedPosition, selectionOpacity]);
  const selectionStyle = useAnimatedStyle(() => ({
    opacity: selectionOpacity.get(),
    transform: [{ translateX: selectedPosition.get() * slotWidth }],
  }));
  const measureTrack = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);
  // Opaque, neutral graphite stays distinct from the app's green backgrounds.
  // Separation comes from a defined rim and a dark contact shadow, not glow.
  return (
    <View style={styles.navigationShadow}>
      <LinearGradient
        colors={['#858A96', '#555A66', '#343843', '#252831']}
        locations={[0, 0.34, 0.7, 1]}
        start={{ x: 0.12, y: 0 }} end={{ x: 0.88, y: 1 }}
        style={styles.navigationRim}
      >
        <View style={styles.navigationIsland}>
          <LinearGradient pointerEvents="none"
            colors={['#202229', '#111217', '#090A0E']}
            locations={[0, 0.48, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill} />
          <View style={styles.track} onLayout={measureTrack}>
            {trackWidth > 0 && (
              <Animated.View pointerEvents="none"
                style={[styles.selection, { width: Math.max(0, slotWidth - 2) }, selectionStyle]}>
                <LinearGradient colors={['rgba(190, 255, 108, 0.22)', 'rgba(190, 255, 108, 0.08)']}
                  style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}
            {children}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state, navigation, descriptors, onFabPress,
}) => {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((route: any) => TAB_ICONS[route.name] !== undefined);
  const activeRoute = state.routes[state.index];
  const activeIndex = routes.findIndex((route: any) => route.key === activeRoute?.key);
  const tabs = routes.map((route: any, index: number) => {
    const selected = activeIndex === index;
    const options = descriptors?.[route.key]?.options;
    const label = typeof options?.tabBarLabel === 'string'
      ? options.tabBarLabel : options?.title ?? TAB_LABELS[route.name];
    return (
      <TabButton key={route.key} icon={TAB_ICONS[route.name]} label={label} selected={selected}
        accessibilityLabel={options?.tabBarAccessibilityLabel} testID={options?.tabBarButtonTestID}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
        }} />
    );
  });
  return (
    <View pointerEvents="box-none" style={[styles.container, {
      paddingBottom: Math.max(insets.bottom, 12),
      paddingLeft: Math.max(insets.left, TAB_BAR_MARGIN),
      paddingRight: Math.max(insets.right, TAB_BAR_MARGIN),
    }]}>
      <View pointerEvents="box-none" style={styles.dock}>
        <NavigationIsland selectedIndex={activeIndex < 2 ? activeIndex : -1}>
          {tabs.slice(0, 2)}
        </NavigationIsland>
        <QuickEntryButton journal={activeRoute?.name === 'journal'} onPress={onFabPress} />
        <NavigationIsland selectedIndex={activeIndex >= 2 ? activeIndex - 2 : -1}>
          {tabs.slice(2)}
        </NavigationIsland>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  dock: { width: '100%', maxWidth: 460, flexDirection: 'row', alignItems: 'center', gap: 8 },
  navigationShadow: {
    flex: 1, minWidth: 0, borderRadius: 37,
    backgroundColor: '#111217',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42, shadowRadius: 10, elevation: 10,
  },
  navigationRim: {
    height: 74, padding: 1, borderRadius: 37, borderCurve: 'continuous', overflow: 'hidden',
  },
  navigationIsland: {
    flex: 1, borderRadius: 36, borderCurve: 'continuous', overflow: 'hidden',
    backgroundColor: '#111217',
  },
  track: { flex: 1, flexDirection: 'row', margin: 6 },
  selection: {
    position: 'absolute', left: 1, top: 0, bottom: 0, borderRadius: 30,
    borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(205, 245, 171, 0.30)', backgroundColor: '#20271D',
  },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  tabContent: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  label: { fontFamily: Fonts.bodyMedium, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  actionShadow: {
    width: 68, height: 68, borderRadius: 26,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38, shadowRadius: 8, elevation: 8,
  },
  actionButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(233, 255, 207, 0.8)', backgroundColor: Colors.accent.primary,
  },
  actionInnerRim: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 21, borderCurve: 'continuous', borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
});
