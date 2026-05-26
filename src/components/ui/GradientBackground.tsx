/**
 * MoodMap — Gradient Background (Freud-Inspired)
 * Warm charcoal base with earthy orbs (olive, brown, terracotta)
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientBackgroundProps {
  children: ReactNode;
  variant?: 'default' | 'auth' | 'glow' | 'mood';
  moodColor?: string;
  style?: ViewStyle;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  children,
  variant = 'default',
  moodColor,
  style,
}) => {
  // Full-screen mood color variant
  if (variant === 'mood' && moodColor) {
    return (
      <View style={[styles.container, { backgroundColor: moodColor }, style]}>
        {/* Subtle topographic-style overlays */}
        <View style={[styles.topoCircle, styles.topoCircle1, { borderColor: `${moodColor}CC` }]} />
        <View style={[styles.topoCircle, styles.topoCircle2, { borderColor: `${moodColor}99` }]} />
        <View style={[styles.topoCircle, styles.topoCircle3, { borderColor: `${moodColor}66` }]} />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={['#1A1612', '#211D17', '#191510']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill as ViewStyle}
      />
      {/* Warm earthy orbs */}
      <View style={styles.orbLayer}>
        {/* Olive orb — top right */}
        <View style={[styles.orb, styles.orbOlive]} />
        {/* Brown orb — left */}
        <View style={[styles.orb, styles.orbBrown]} />
        {/* Terracotta orb — bottom right (only on auth/glow) */}
        {(variant === 'auth' || variant === 'glow') && (
          <View style={[styles.orb, styles.orbTerracotta]} />
        )}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
  },
  orbLayer: {
    ...(StyleSheet.absoluteFill as object),
    overflow: 'hidden',
  },

  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOlive: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(168, 181, 114, 0.06)',
    top: -80,
    right: -60,
  },
  orbBrown: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(139, 115, 85, 0.05)',
    top: '40%',
    left: -80,
  },
  orbTerracotta: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(212, 132, 90, 0.04)',
    bottom: -60,
    right: -40,
  },

  // Topographic circles for mood variant
  topoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  topoCircle1: {
    width: 500,
    height: 500,
    top: '20%',
    left: -100,
  },
  topoCircle2: {
    width: 400,
    height: 400,
    top: '25%',
    left: -50,
  },
  topoCircle3: {
    width: 300,
    height: 300,
    top: '30%',
    left: 0,
  },
});
