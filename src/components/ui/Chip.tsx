/**
 * MoodMap — Chip Component
 * Selectable tags/chips with animated feedback
 */

import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';

interface ChipProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected = false,
  onPress,
  color = Colors.accent.primary,
  style,
  size = 'md',
}) => {
  const isSmall = size === 'sm';

  return (
    <AnimatedPressable
      onPress={onPress}
      pressScale={0.92}
      style={[
        styles.chip,
        isSmall && styles.chipSmall,
        selected && {
          backgroundColor: color + '25',
          borderColor: color + '60',
        },
        style,
      ]}
    >
      {icon && (
        <Feather
          name={icon}
          size={isSmall ? 14 : 16}
          color={selected ? color : Colors.text.secondary}
          style={[styles.icon, isSmall && styles.iconSmall]}
        />
      )}
      <Text
        style={[
          styles.label,
          isSmall && styles.labelSmall,
          selected && { color },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.background.card,
  },
  chipSmall: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  iconSmall: {
    marginRight: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  labelSmall: {
    fontSize: FontSizes.caption,
  },
});
