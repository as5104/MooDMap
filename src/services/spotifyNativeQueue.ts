/** Persist only pending song references, never tokens. Spotify does not expose
 * manual-queue provenance, so ambiguous/unobserved additions stay protected. */
export interface NativeQueueEntry { id: number; uri: string; seen: boolean; origin?: string }
export type NativeQueueState = Record<string, NativeQueueEntry[]>;

export function createNativeQueueTracker(deps: {
  load: () => Promise<NativeQueueState>;
  save: (state: NativeQueueState) => Promise<void>;
}) {
  let state: NativeQueueState = {};
  let loaded: Promise<void> | undefined;
  let revision = 0;
  let serial = 0;
  let writes: Promise<void> = Promise.resolve();
  const ready = () => loaded ??= deps.load().then(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved Spotify queue state.');
    for (const entries of Object.values(value)) {
      if (!Array.isArray(entries) || entries.some(e => !e || !Number.isFinite(e.id)
        || typeof e.uri !== 'string' || typeof e.seen !== 'boolean')) throw new Error('Invalid saved Spotify queue state.');
      for (const entry of entries) serial = Math.max(serial, entry.id);
    }
    state = value;
  });
  const save = () => {
    const snapshot = JSON.parse(JSON.stringify(state)) as NativeQueueState;
    const result = writes.catch(() => {}).then(() => deps.save(snapshot));
    writes = result;
    return result;
  };
  return {
    revision: () => revision,
    async anyPending() {
      await ready();
      return Object.values(state).some(entries => entries.length > 0);
    },
    async pending(owner: string) {
      await ready();
      return (state[owner]?.length ?? 0) > 0;
    },
    async reserve(owner: string, uri: string, origin?: string) {
      await ready();
      const entry = { id: ++serial, uri, seen: false, origin };
      state[owner] = [...(state[owner] ?? []), entry];
      revision++;
      // Persist before POST: an app restart must not unlock a native queue.
      try { await save(); } catch (error) {
        state[owner] = state[owner].filter(e => e.id !== entry.id);
        revision++;
        throw error;
      }
      return entry.id;
    },
    async reject(owner: string, id: number) {
      await ready();
      state[owner] = (state[owner] ?? []).filter(e => e.id !== id);
      revision++;
      await save();
    },
    async observe(owner: string, data: any, requestedRevision: number) {
      await ready();
      if (requestedRevision !== revision || !data?.currently_playing?.uri || !Array.isArray(data.queue)
        || data.queue.some((item: any) => !item?.uri)) return;
      const entries = state[owner] ?? [];
      if (!entries.length) return;
      const present = new Set<string>([data.currently_playing.uri,
        data.currently_playing.linked_from?.uri,
        ...data.queue.flatMap((item: any) => [item.uri, item.linked_from?.uri])].filter(Boolean));
      const upcoming = new Set<string>(data.queue.flatMap((item: any) => [item.uri, item.linked_from?.uri]).filter(Boolean));
      // An addition first has to be observed on Spotify. Missing entries in a
      // truncated/stale response cannot clear a reservation that was never seen.
      // Retain all occurrences while the URI remains visible: do not ID-deduplicate
      // intentional repeats or assume a currently playing copy is the queued copy.
      const next = entries.filter(entry => !entry.seen || present.has(entry.uri))
        .map(entry => ({ ...entry, seen: entry.seen || upcoming.has(entry.uri)
          || (!!entry.origin && entry.origin !== entry.uri && present.has(entry.uri)) }));
      if (JSON.stringify(next) === JSON.stringify(entries)) return;
      state[owner] = next;
      revision++;
      await save();
    },
  };
}

export const NATIVE_QUEUE_REORDER_MESSAGE = 'Spotify is playing your added songs first. Reordering is available after those songs leave the queue.';
