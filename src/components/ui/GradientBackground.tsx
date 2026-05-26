/**
 * MoodMap — GradientBackground Component
 * Rich gradient with floating blurred orbs for color-mixing effect
 */

import React from 'react';
import { StyleSheet, View, Dimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Adds floating blurred gradient orbs for rich color mixing */
  variant?: 'default' | 'glow' | 'auth' | 'minimal';
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Base gradient */}
      <LinearGradient
        colors={['#000814', '#001233', '#003566', '#001D3D', '#000814']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating gradient orbs for color mixing */}
      {(variant === 'glow' || variant === 'auth') && (
        <View style={styles.orbLayer} pointerEvents="none">
          {/* Primary golden-yellow orb — top-right */}
          <View style={[styles.orb, styles.orbGold]} />

          {/* Teal accent orb — mid-left */}
          <View style={[styles.orb, styles.orbTeal]} />

          {/* Deep blue orb — bottom */}
          <View style={[styles.orb, styles.orbBlue]} />

          {/* Subtle warm orb — center */}
          {variant === 'auth' && (
            <View style={[styles.orb, styles.orbWarm]} />
          )}
        </View>
      )}

      {variant === 'default' && (
        <View style={styles.orbLayer} pointerEvents="none">
          {/* Subtle ambient glow */}
          <View style={[styles.orb, styles.orbSubtle]} />
        </View>
      )}

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000814',
  },
  orbLayer: {
    ...(StyleSheet.absoluteFill as object),
    overflow: 'hidden',
  },

  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },

  // Golden-yellow — top-right, large and soft
  orbGold: {
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
    top: -SCREEN_W * 0.15,
    right: -SCREEN_W * 0.3,
    backgroundColor: 'rgba(255, 214, 10, 0.07)',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 80,
    elevation: 0,
  },

  // Teal accent — mid-left
  orbTeal: {
    width: SCREEN_W * 0.7,
    height: SCREEN_W * 0.7,
    top: SCREEN_H * 0.35,
    left: -SCREEN_W * 0.35,
    backgroundColor: 'rgba(25, 199, 184, 0.06)',
    shadowColor: '#19C7B8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 60,
    elevation: 0,
  },

  // Deep blue — bottom-right
  orbBlue: {
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    bottom: -SCREEN_W * 0.2,
    right: -SCREEN_W * 0.2,
    backgroundColor: 'rgba(0, 53, 102, 0.15)',
    shadowColor: '#003566',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 0,
  },

  // Warm center glow — auth only
  orbWarm: {
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    top: SCREEN_H * 0.15,
    alignSelf: 'center',
    left: SCREEN_W * 0.2,
    backgroundColor: 'rgba(255, 214, 10, 0.04)',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 100,
    elevation: 0,
  },

  // Subtle ambient — default screens
  orbSubtle: {
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    top: SCREEN_H * 0.1,
    left: -SCREEN_W * 0.2,
    backgroundColor: 'rgba(0, 53, 102, 0.12)',
    shadowColor: '#003566',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 80,
    elevation: 0,
  },
});
