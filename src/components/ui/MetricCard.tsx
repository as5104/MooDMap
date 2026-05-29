/**
 * MoodMap — MetricCard Component (Premium)
 * Colored rounded card for dashboard metrics (score, mood, tracker)
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing, Shadows } from '@/constants/layout';

type MetricVariant = 'green' | 'orange' | 'brown' | 'olive';

interface MetricCardProps {
  variant: MetricVariant;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  subtitle?: string;
  children?: ReactNode;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<MetricVariant, { bg: string; text: string }> = {
  green: { bg: '#2D7D46', text: '#E8FFE8' },
  orange: { bg: '#E87040', text: '#FFF5F0' },
  brown: { bg: '#2A2A35', text: '#FFFFFF' },
  olive: { bg: '#3D8B5A', text: '#F0FFF5' },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  variant,
  icon,
  label,
  value,
  subtitle,
  children,
  style,
}) => {
  const colors = VARIANT_COLORS[variant];

  return (
    <View style={[styles.card, { backgroundColor: colors.bg }, style]}>
      <View style={styles.header}>
        <Feather name={icon} size={16} color={colors.text} />
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: `${colors.text}AA` }]}>{subtitle}</Text>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: Spacing.lg,
    flex: 1,
    minHeight: 120,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
  },
  value: {
    fontFamily: Fonts.heading,
    fontSize: 36,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
  },
});
