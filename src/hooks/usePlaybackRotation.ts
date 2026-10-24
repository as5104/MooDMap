import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useReducedMotion, useSharedValue, type FrameInfo } from 'react-native-reanimated';

/** One revolution per 35 seconds; pausing preserves the current angle. */
export function usePlaybackRotation(playing: boolean) {
  const rotation = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const tick = useCallback(({ timeSincePreviousFrame }: FrameInfo) => {
    'worklet';
    // Do not catch up after backgrounding or a stalled frame: that looks like a spin burst.
    if (timeSincePreviousFrame === null || timeSincePreviousFrame > 100) return;
    rotation.set(angle => (angle + timeSincePreviousFrame * 360 / 35000) % 360);
  }, [rotation]);
  const frame = useFrameCallback(tick, false);

  useEffect(() => {
    const update = () => frame.setActive(playing && !reduceMotion && AppState.currentState === 'active');
    update();
    const subscription = AppState.addEventListener('change', update);
    return () => { frame.setActive(false); subscription.remove(); };
  }, [playing, reduceMotion, frame]);

  return rotation;
}
