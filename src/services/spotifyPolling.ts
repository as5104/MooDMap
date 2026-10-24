/** One foreground poll loop shared by every mounted Spotify consumer. */
export function createSpotifyPoller<T>(load: () => Promise<T | null>) {
  const listeners = new Map<(value: T | null, requestedAt: number) => void, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | null = null;
  let foreground = true;
  let lastStarted = 0;
  let generation = 0;
  let failures = 0;
  let retryAt = 0;

  function schedule() {
    clearTimeout(timer);
    if (!foreground || !listeners.size) return;
    timer = setTimeout(() => { void refresh(); }, Math.max(Math.min(...listeners.values()), retryAt - Date.now()));
  }

  function refresh(): Promise<void> {
    if (!foreground || !listeners.size) return Promise.resolve();
    if (pending) return pending;
    if (Date.now() < retryAt) { schedule(); return Promise.resolve(); }
    if (Date.now() - lastStarted < 1000) { schedule(); return Promise.resolve(); }
    const startedGeneration = generation;
    lastStarted = Date.now();
    const requestedAt = lastStarted;
    pending = (async () => {
      try {
        const value = await Promise.resolve().then(load);
        if (foreground && generation === startedGeneration) {
          failures = 0;
          retryAt = 0;
          for (const listener of listeners.keys()) {
            try { listener(value, requestedAt); }
            catch (error) { console.warn('[Spotify] Playback subscriber failed:', error); }
          }
        }
      } catch (error) {
        if (generation === startedGeneration) {
          failures++;
          retryAt = Date.now() + Math.min(30_000, 5000 * 2 ** Math.min(failures - 1, 3));
        }
        console.warn('[Spotify] Shared playback poll failed:', error);
      } finally {
        pending = null;
        schedule();
      }
    })();
    return pending;
  }

  return {
    refresh,
    setForeground(active: boolean) {
      foreground = active;
      if (active) void refresh();
      else clearTimeout(timer);
    },
    subscribe(listener: (value: T | null, requestedAt: number) => void, intervalMs: number) {
      listeners.set(listener, intervalMs);
      void refresh();
      schedule();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { generation++; lastStarted = 0; failures = 0; retryAt = 0; }
        schedule();
      };
    },
  };
}
