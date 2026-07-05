/**
 * MoodMap — Gradient Background
 */

import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

interface GradientBackgroundProps {
  children: ReactNode;
  variant?: 'default' | 'auth' | 'glow' | 'mood';
  moodColor?: string;
  style?: ViewStyle;
}

interface BlurCtx {
  ref: React.RefObject<View | null>;
  ready: boolean;
}

export const BlurTargetCtx = createContext<BlurCtx | null>(null);
export const useBlurTarget = () => useContext(BlurTargetCtx);

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  children,
  variant = 'default',
  moodColor,
  style,
}) => {
  const targetRef = useRef<View>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && targetRef.current && !ready) {
      setReady(true);
    }
  }, [ready]);

  const ctx: BlurCtx = { ref: targetRef, ready };
  const isAndroid = Platform.OS === 'android';

  /**
   * Smooth ambient mesh built from layered gradients.
   */
  const renderAmbientLayers = () => (
    <View style={StyleSheet.absoluteFill}>
      {/* Base: solid black */}
      <View style={[StyleSheet.absoluteFill as ViewStyle, { backgroundColor: '#000000' }]} />

      {/* Layer 1 — Top-left bright lime light flowing diagonally down-right */}
      <LinearGradient
        colors={['rgba(200, 255, 140, 0.70)', 'rgba(100, 200, 50, 0.30)', 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.35, 0.7]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />

      {/* Layer 2 — Center-left green glow flowing right */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(80, 180, 40, 0.40)', 'rgba(60, 160, 30, 0.25)', 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.3, 0.6, 1]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />

      {/* Layer 3 — Bottom teal/cyan glow flowing up */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(40, 180, 160, 0.35)', 'rgba(60, 200, 180, 0.50)']}
        locations={[0.3, 0.7, 1]}
        start={{ x: 0.3, y: 0.5 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />

      {/* Layer 4 — Dark vignette from right edge for depth */}
      <LinearGradient
        colors={['rgba(0, 10, 5, 0.80)', 'rgba(0, 0, 0, 0)', 'rgba(0, 10, 5, 0.60)']}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />

      {/* Layer 5 — Subtle mid-green wash across center for richness */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(90, 200, 70, 0.20)', 'rgba(0, 0, 0, 0)']}
        locations={[0.1, 0.5, 0.9]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />

      {/* Layer 6 — Top-left white highlight for that bright corner glow */}
      <LinearGradient
        colors={['rgba(255, 255, 240, 0.45)', 'rgba(180, 240, 120, 0.15)', 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.2, 0.5]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.5 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />
    </View>
  );

  // Mood variant
  if (variant === 'mood' && moodColor) {
    const moodBg = (
      <>
        <View style={[StyleSheet.absoluteFill as ViewStyle, { backgroundColor: moodColor }]} />
        <View style={[styles.topoCircle, styles.topoCircle1, { borderColor: `${moodColor}CC` }]} />
        <View style={[styles.topoCircle, styles.topoCircle2, { borderColor: `${moodColor}99` }]} />
        <View style={[styles.topoCircle, styles.topoCircle3, { borderColor: `${moodColor}66` }]} />
      </>
    );

    return (
      <BlurTargetCtx.Provider value={ctx}>
        <View style={[styles.container, { backgroundColor: moodColor }, style]}>
          {isAndroid ? (
            <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill as ViewStyle}>
              {moodBg}
            </BlurTargetView>
          ) : (
            moodBg
          )}
          {children}
        </View>
      </BlurTargetCtx.Provider>
    );
  }

  const defaultBg = renderAmbientLayers();

  return (
    <BlurTargetCtx.Provider value={ctx}>
      <View style={[styles.container, style]}>
        {isAndroid ? (
          <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill as ViewStyle}>
            {defaultBg}
          </BlurTargetView>
        ) : (
          defaultBg
        )}
        {children}
      </View>
    </BlurTargetCtx.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  topoCircle1: { width: 500, height: 500, top: '20%', left: -100 },
  topoCircle2: { width: 400, height: 400, top: '25%', left: -50 },
  topoCircle3: { width: 300, height: 300, top: '30%', left: 0 },
});
