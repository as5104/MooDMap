/**
 * MoodMap — GlassCard
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Radius, Spacing } from '@/constants/layout';
import { Colors } from '@/constants/colors';
import { useBlurTarget } from './GradientBackground';

type Intensity = 'subtle' | 'medium' | 'strong';
type MetricVariant = 'green' | 'orange' | 'brown' | 'olive';

interface GlassCardProps {
  children: ReactNode;
  intensity?: Intensity;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  onPress?: () => void;
  metric?: MetricVariant;
}

const IOS_BLUR: Record<Intensity, number> = {
  subtle: 60,
  medium: 78,
  strong: 95,
};

const ANDROID_BLUR: Record<Intensity, number> = {
  subtle: 20,
  medium: 30,
  strong: 42,
};

const FROSTED_TINT: Record<Intensity, string> = {
  subtle: 'rgba(14, 16, 22, 0.44)',
  medium: 'rgba(14, 16, 22, 0.52)',
  strong: 'rgba(14, 16, 22, 0.62)',
};

const ANDROID_FALLBACK: Record<Intensity, string> = {
  subtle: 'rgba(18, 20, 28, 0.78)',
  medium: 'rgba(18, 20, 28, 0.84)',
  strong: 'rgba(18, 20, 28, 0.90)',
};

const BORDER: Record<Intensity, string> = {
  subtle: 'rgba(255, 255, 255, 0.08)',
  medium: 'rgba(255, 255, 255, 0.10)',
  strong: 'rgba(255, 255, 255, 0.14)',
};

const METRIC_COLORS: Record<MetricVariant, string> = {
  green: Colors.metric.green,
  orange: Colors.metric.orange,
  brown: Colors.metric.brown,
  olive: Colors.metric.olive,
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
  const blurCtx = useBlurTarget();
  const isMetric = !!metric;

  // Metric card: solid color, no blur
  if (isMetric) {
    const metricStyle: StyleProp<ViewStyle> = [
      styles.card,
      {
        backgroundColor: METRIC_COLORS[metric],
        borderColor: 'transparent',
        padding: PADDING_MAP[padding],
      },
      style,
    ];
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: METRIC_COLORS[metric],
              borderColor: 'transparent',
              padding: PADDING_MAP[padding],
            },
            style,
            pressed && styles.pressed,
          ]}
        >
          {children}
        </Pressable>
      );
    }
    return <View style={metricStyle}>{children}</View>;
  }

  // Frosted glass card
  const outerStyle: StyleProp<ViewStyle> = [
    styles.card,
    { borderColor: BORDER[intensity] },
    glowColor
      ? {
          borderColor: `${glowColor}40`,
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 4,
        }
      : {},
    style,
  ];

  const canUseAndroidBlur = Platform.OS === 'android' && blurCtx?.ready;

  const renderBlurLayer = () => {
    if (Platform.OS === 'ios') {
      return (
        <BlurView
          intensity={IOS_BLUR[intensity]}
          tint="systemMaterialDark"
          style={StyleSheet.absoluteFill}
        />
      );
    }

    if (canUseAndroidBlur) {
      return (
        <BlurView
          intensity={ANDROID_BLUR[intensity]}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurReductionFactor={2}
          blurTarget={blurCtx!.ref}
          style={StyleSheet.absoluteFill}
        />
      );
    }

    // Fallback: solid frosted bg
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: ANDROID_FALLBACK[intensity] }]} />
    );
  };

  const cardContent = (
    <>
      {/* Layer 1: Blur */}
      {renderBlurLayer()}
      {/* Layer 2: Dark frosted tint */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: FROSTED_TINT[intensity] }]} />
      {/* Layer 3: Content */}
      <View style={{ padding: PADDING_MAP[padding] }}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { borderColor: BORDER[intensity] },
          glowColor
            ? {
                borderColor: `${glowColor}40`,
                shadowColor: glowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 4,
              }
            : {},
          style,
          pressed && styles.pressed,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={outerStyle}>{cardContent}</View>;
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
