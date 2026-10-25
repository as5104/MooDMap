import { useCallback, useEffect, useRef } from 'react';

export type MusicToastType = 'success' | 'warning' | 'error' | 'pending';

/** Keep feedback tied to the latest tap while Spotify confirms the queue. */
export function useQueueAdditionFeedback(showToast: (message: string, type?: MusicToastType) => void) {
  const lifecycle = useRef({ latest: 0, mounted: true });
  useEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    return () => { state.mounted = false; state.latest++; };
  }, []);

  return useCallback(async (add: () => Promise<boolean>, remote = true) => {
    const state = lifecycle.current;
    const request = ++state.latest;
    if (remote) showToast('Adding to queue…', 'pending');
    try {
      const added = await add();
      if (state.mounted && request === state.latest) {
        showToast(added ? 'Added to Queue' : 'Could not update the queue', added ? 'success' : 'error');
      }
    } catch {
      if (state.mounted && request === state.latest) showToast('Could not update the queue', 'error');
    }
  }, [showToast]);
}
