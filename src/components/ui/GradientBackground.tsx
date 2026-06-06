/**
 * MoodMap — Gradient Background
 */

import React, { type ReactNode, useRef, useState, useEffect, createContext, useContext } from 'react';
import { StyleSheet, View, type ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView } from 'expo-blur';

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

  // Mark ready after mount so children re-render with the ref
  useEffect(() => {
    if (Platform.OS === 'android' && targetRef.current && !ready) {
      setReady(true);
    }
  }, [ready]);

  const ctx: BlurCtx = { ref: targetRef, ready };
  const isAndroid = Platform.OS === 'android';

  // Shared background orbs
  const renderOrbs = (isGlow: boolean) => (
    <View style={styles.orbLayer}>
      <View style={[styles.orb, styles.orbLime]} />
      <View style={[styles.orb, styles.orbLavender]} />
      <View style={[styles.orb, styles.orbTeal]} />
      {isGlow && (
        <>
          <View style={[styles.orb, styles.orbAmber]} />
          <View style={[styles.orb, styles.orbLimeBottom]} />
        </>
      )}
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

  // Default / Auth / Glow variants
  const isGlow = variant === 'glow' || variant === 'auth';

  const defaultBg = (
    <>
      <LinearGradient
        colors={['#0A0A0C', '#0F0F14', '#0A0A0C']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill as ViewStyle}
      />
      {renderOrbs(isGlow)}
    </>
  );

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
    backgroundColor: '#0A0A0C',
  },
  orbLayer: {
    ...(StyleSheet.absoluteFill as object),
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbLime: {
    width: 350,
    height: 350,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    top: -100,
    right: -80,
  },
  orbLavender: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(184, 169, 255, 0.09)',
    top: '35%',
    left: -100,
  },
  orbTeal: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(78, 205, 196, 0.07)',
    bottom: -40,
    left: '20%',
  },
  orbAmber: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(255, 190, 106, 0.10)',
    bottom: -80,
    right: -60,
  },
  orbLimeBottom: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(190, 255, 108, 0.08)',
    bottom: '15%',
    left: -50,
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
