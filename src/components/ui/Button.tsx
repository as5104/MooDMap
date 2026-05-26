/**
 * MoodMap — Button Component
 * Primary and secondary button styles with animations
 */

import React from 'react';
import { StyleSheet, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = false,
}) => {
  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, fontSize: FontSizes.bodySmall },
    md: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xxl, fontSize: FontSizes.body },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxxl, fontSize: FontSizes.body },
  };

  const currentSize = sizeStyles[size];

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#5A5A3A', '#4A4A30'] : ['#FFD60A', '#F4C542']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            {
              paddingVertical: currentSize.paddingVertical,
              paddingHorizontal: currentSize.paddingHorizontal,
            },
            isDisabled && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.text.onAccent} />
          ) : (
            <>
              {icon && <>{icon}</>}
              <Text
                style={[
                  styles.primaryText,
                  { fontSize: currentSize.fontSize },
                  icon ? { marginLeft: Spacing.sm } : undefined,
                ]}
              >
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const variantStyles = {
    secondary: {
      bg: 'transparent',
      border: Colors.accent.teal,
      textColor: Colors.accent.teal,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      textColor: Colors.text.secondary,
    },
    teal: {
      bg: Colors.accent.tealMuted,
      border: Colors.accent.teal,
      textColor: Colors.accent.teal,
    },
  };

  const v = variantStyles[variant];

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === 'ghost' ? 0 : 1.5,
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
        },
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.textColor} />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.text,
              { color: v.textColor, fontSize: currentSize.fontSize },
              icon ? { marginLeft: Spacing.sm } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    overflow: 'hidden',
  },
  primaryText: {
    color: Colors.text.onAccent,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
  },
  text: {
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});
