import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';

const SignalBar = React.memo(({ playing, duration, restingScale }: { playing: boolean; duration: number; restingScale: number }) => {
  const scale = useSharedValue(restingScale);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    cancelAnimation(scale);
    if (playing && !reduceMotion) {
      scale.value = restingScale;
      scale.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      scale.value = withTiming(restingScale, { duration: 180 });
    }
    return () => cancelAnimation(scale);
  }, [playing, reduceMotion, duration, restingScale, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, animatedStyle]} />;
});
SignalBar.displayName = 'SignalBar';

export const NowPlayingSignal = React.memo(({ playing }: { playing: boolean }) => (
  <View style={styles.signal} accessible={false} pointerEvents="none">
    <SignalBar playing={playing} duration={480} restingScale={0.4} />
    <SignalBar playing={playing} duration={650} restingScale={0.65} />
    <SignalBar playing={playing} duration={550} restingScale={0.3} />
  </View>
));
NowPlayingSignal.displayName = 'NowPlayingSignal';

const styles = StyleSheet.create({
  signal: { height: 14, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 2, height: 12, borderRadius: 1, backgroundColor: Colors.accent.primary },
});
