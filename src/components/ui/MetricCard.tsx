/**
 * MoodMap — MetricCard Component
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
  green: { bg: '#5A7D5A', text: '#E8F0E8' },
  orange: { bg: '#D4845A', text: '#FFF0E8' },
  brown: { bg: '#6B5E50', text: '#F0EBE3' },
  olive: { bg: '#7D9B5A', text: '#F0F5E8' },
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
