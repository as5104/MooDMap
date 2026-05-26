/**
 * MoodMap — Input Component
 * Styled text input for dark theme
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          error ? styles.inputError : undefined,
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={18}
            color={isFocused ? Colors.accent.teal : Colors.text.tertiary}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, icon ? { paddingLeft: 0 } : undefined, style]}
          placeholderTextColor={Colors.text.tertiary}
          selectionColor={Colors.accent.teal}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
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
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.input,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.border.subtle,
    paddingHorizontal: Spacing.lg,
  },
  inputFocused: {
    borderColor: Colors.accent.teal,
  },
  inputError: {
    borderColor: Colors.error,
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
