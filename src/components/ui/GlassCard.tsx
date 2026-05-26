/**
 * MoodMap — GlassCard (Freud-Inspired)
 * Warm translucent surface with earthy tint + colored metric variant
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle, Pressable } from 'react-native';
import { Radius, Spacing } from '@/constants/layout';

type Intensity = 'subtle' | 'medium' | 'strong';
type MetricVariant = 'green' | 'orange' | 'brown' | 'olive';

interface GlassCardProps {
  children: ReactNode;
  intensity?: Intensity;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  glowColor?: string;
  onPress?: () => void;
  /** Colored metric card variant */
  metric?: MetricVariant;
}

const INTENSITY_BG: Record<Intensity, string> = {
  subtle: 'rgba(240, 235, 227, 0.03)',
  medium: 'rgba(240, 235, 227, 0.05)',
  strong: 'rgba(240, 235, 227, 0.07)',
};

const INTENSITY_BORDER: Record<Intensity, string> = {
  subtle: 'rgba(240, 235, 227, 0.04)',
  medium: 'rgba(240, 235, 227, 0.08)',
  strong: 'rgba(240, 235, 227, 0.10)',
};

const METRIC_COLORS: Record<MetricVariant, string> = {
  green: '#5A7D5A',
  orange: '#D4845A',
  brown: '#6B5E50',
  olive: '#7D9B5A',
};

const PADDING_MAP = {
  none: 0,
  sm: Spacing.md,
  md: Spacing.lg,
  lg: Spacing.xxl,
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 'medium',
  padding = 'md',
  style,
  glowColor,
  onPress,
  metric,
}) => {
  const cardStyle: ViewStyle[] = [
    styles.card,
    {
      backgroundColor: metric ? METRIC_COLORS[metric] : INTENSITY_BG[intensity],
      borderColor: metric ? 'transparent' : INTENSITY_BORDER[intensity],
      padding: PADDING_MAP[padding],
    },
    glowColor ? {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 4,
    } : {},
    style ?? {},
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
