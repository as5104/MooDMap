/**
 * MoodMap — Card Component
 * Dark premium card with optional border glow and press animation
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, Shadows } from '@/constants/layout';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Add a subtle colored border glow */
  glowColor?: string;
  /** Make the card pressable */
  onPress?: () => void;
  /** Padding preset */
  padding?: 'sm' | 'md' | 'lg';
  /** Disable default background */
  transparent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  glowColor,
  onPress,
  padding = 'md',
  transparent = false,
}) => {
  const paddingMap = {
    sm: Spacing.md,
    md: Spacing.lg,
    lg: Spacing.xxl,
  };

  const cardStyle: ViewStyle = {
    ...styles.card,
    padding: paddingMap[padding],
    ...(transparent ? { backgroundColor: 'transparent' } : {}),
    ...(glowColor
      ? {
          borderColor: glowColor + '30',
          borderWidth: 1,
          ...Shadows.glow(glowColor),
        }
      : {}),
  };

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} style={[cardStyle, style]}>
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.md,
  },
});
