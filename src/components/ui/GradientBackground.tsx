/**
 * MoodMap — GradientBackground Component
 * Dark navy-to-blue gradient used as main app background
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Add a subtle teal glow in the middle */
  withGlow?: boolean;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  children,
  style,
  withGlow = false,
}) => {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[
          Colors.gradient.top,
          Colors.gradient.middle,
          Colors.gradient.bottom,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {withGlow && (
        <View style={styles.glowContainer}>
          <View style={styles.glowCircle} />
        </View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  glowContainer: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.gradient.glow,
    position: 'absolute',
    top: '30%',
  },
});
