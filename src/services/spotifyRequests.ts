/** Share identical reads across screens and pace catalog traffic independently
 * of player controls. The spacing is a local precaution, not Spotify's quota.
 */
export function createSpotifyReadCoordinator(
  now = () => Date.now(),
  delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
) {
  const pending = new Map<string, Promise<unknown>>();
  const cache = new Map<string, { value: unknown; expires: number }>();
  let catalogChain: Promise<unknown> = Promise.resolve();
  let nextCatalogRequest = 0;
  let generation = 0;
  let cacheRevision = 0;
  return {
    invalidate() { cacheRevision++; cache.clear(); pending.clear(); },
    clear() { generation++; cacheRevision++; cache.clear(); pending.clear(); },
    read<T>(token: string, endpoint: string, task: () => Promise<T | null>): Promise<T | null> {
      const key = `${token}:${endpoint}`;
      const player = ['/me/player', '/me/player/currently-playing', '/me/player/queue'].includes(endpoint.split('?')[0]);
      // Never reuse old playback/queue state for command verification.
      const ttl = player ? 0 : endpoint.startsWith('/me') || endpoint.startsWith('/playlists/') ? 15_000 : 120_000;
      const cached = cache.get(key);
      if (cached && cached.expires > now()) return Promise.resolve(cached.value as T);
      const existing = pending.get(key);
      if (existing) return existing as Promise<T | null>;
      const requestedGeneration = generation;
      const requestedCacheRevision = cacheRevision;
      const run = async () => {
        if (generation !== requestedGeneration) return null;
        if (!player) {
          await delay(Math.max(0, nextCatalogRequest - now()));
          nextCatalogRequest = now() + 300;
        }
        if (generation !== requestedGeneration) return null;
        const value = await task();
        if (generation !== requestedGeneration) return null;
        if (value !== null && ttl > 0 && cacheRevision === requestedCacheRevision) {
          if (cache.size >= 200) cache.delete(cache.keys().next().value!);
          cache.set(key, { value, expires: now() + ttl });
        }
        return value;
      };
      const result = player ? run() : catalogChain.then(run);
      if (!player) catalogChain = result.catch(() => {});
      pending.set(key, result);
      const cleanup = () => { if (pending.get(key) === result) pending.delete(key); };
      void result.then(cleanup, cleanup);
      return result;
    },
  };
}
