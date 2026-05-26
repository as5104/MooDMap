/**
 * MoodMap — AnimatedPressable Component
 * Touch-responsive pressable with scale animation and haptic feedback
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale factor on press (default: 0.96) */
  pressScale?: number;
  /** Enable haptic feedback on press */
  haptic?: boolean;
  /** Haptic feedback type */
  hapticType?: Haptics.ImpactFeedbackStyle;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  pressScale = 0.96,
  haptic = true,
  hapticType = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(pressScale, {
        damping: 15,
        stiffness: 400,
      });
      onPressIn?.(e);
    },
    [pressScale, onPressIn, scale]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 400,
      });
      onPressOut?.(e);
    },
    [onPressOut, scale]
  );

  const handlePress = useCallback(
    (e: any) => {
      if (haptic) {
        Haptics.impactAsync(hapticType);
      }
      onPress?.(e);
    },
    [haptic, hapticType, onPress]
  );

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
};
