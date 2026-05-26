/**
 * MoodMap — Chip Component
 * Selectable tags/chips with animated feedback
 */

import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';

interface ChipProps {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  emoji,
  selected = false,
  onPress,
  color = Colors.accent.teal,
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
      {emoji && (
        <Text style={[styles.emoji, isSmall && styles.emojiSmall]}>
          {emoji}
        </Text>
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
  emoji: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  emojiSmall: {
    fontSize: 14,
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
