/**
 * MoodMap — Input (Premium)
 */

import React, { useCallback, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  Animated,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(
    (e: any) => {
      Animated.timing(focusAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onFocus?.(e);
    },
    [onFocus, focusAnim]
  );

  const handleBlur = useCallback(
    (e: any) => {
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onBlur?.(e);
    },
    [onBlur, focusAnim]
  );

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.08)', 'rgba(190, 255, 108, 0.5)'],
  });

  const bgColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.06)'],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View
        style={[
          styles.inputWrapper,
          { borderColor, backgroundColor: bgColor },
          error ? styles.inputError : undefined,
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={18}
            color="rgba(255, 255, 255, 0.30)"
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, icon ? { paddingLeft: 0 } : undefined, style]}
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          selectionColor={Colors.accent.primary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.50)',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  inputError: {
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  icon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    paddingVertical: Spacing.lg,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
