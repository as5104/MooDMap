/**
 * MoodMap — GlassCard Component
 * Frosted glass card with translucent background and subtle border
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/layout';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Glass intensity: how visible the frost is */
  intensity?: 'subtle' | 'medium' | 'strong';
  /** Accent border glow color */
  glowColor?: string;
  /** Make the card pressable */
  onPress?: () => void;
  /** Padding preset */
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 'medium',
  glowColor,
  onPress,
  padding = 'md',
}) => {
  const paddingMap = {
    none: 0,
    sm: Spacing.md,
    md: Spacing.lg + 4,
    lg: Spacing.xxl,
  };

  const intensityStyles: Record<string, ViewStyle> = {
    subtle: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    medium: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.10)',
    },
    strong: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
  };

  const glassStyle: ViewStyle = {
    ...styles.glass,
    padding: paddingMap[padding],
    ...intensityStyles[intensity],
    ...(glowColor
      ? {
          borderColor: glowColor + '30',
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 0,
        }
      : {}),
  };

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} style={[glassStyle, style]}>
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[glassStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  glass: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
