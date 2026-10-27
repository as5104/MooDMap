/** Spotify can acknowledge URI playback with 204 while clearing the player.
 * Verify the result and recover through a private playlist context, preserving
 * the entire sequence (an album fallback would play unrelated album tracks).
 */
export interface PlaybackState {
  is_playing: boolean;
  shuffle_state?: boolean;
  progress_ms: number;
  device?: { id: string };
  context?: { uri: string } | null;
  item: { uri: string; linked_from?: { uri: string } } | null;
}

export interface ManagedQueue {
  ownerId: string;
  uris: string[];
  snapshotId: string;
}

export type QueueFallbackReason = 'unmanaged-context' | 'playback-not-active' | 'current-track-mismatch'
  | 'account-unavailable' | 'managed-state-unavailable' | 'ambiguous-current-track' | 'complex-edit'
  | 'playlist-deleted' | 'playlist-changed' | 'missing-snapshot' | 'device-queue-stale';

// Plan one insertion or contiguous move without replacing the playing item.
// Complex edits retain the full-context fallback instead of issuing many writes.
function planPlaylistEdit(previous: string[], desired: string[], anchor: number) {
  let index = anchor + 1;
  while (index < desired.length && previous[index] === desired[index]) index++;
  if (index === desired.length && previous.length === desired.length) return { method: 'NONE', body: {} };
  const extra = desired.length - previous.length;
  if (extra > 0 && extra <= 100 && previous.slice(index).every((uri, i) => uri === desired[index + extra + i])) {
    return { method: 'POST', body: { uris: desired.slice(index, index + extra), position: index } };
  }
  if (extra === 0) {
    for (let start = index + 1; start < previous.length; start++) {
      if (previous[start] !== desired[index]) continue;
      for (let length = 1; start + length <= previous.length; length++) {
        if (previous[start + length - 1] !== desired[index + length - 1]) break;
        const moved = [...previous.slice(0, index), ...previous.slice(start, start + length),
          ...previous.slice(index, start), ...previous.slice(start + length)];
        if (moved.every((uri, i) => uri === desired[i])) {
          return { method: 'PUT', body: { range_start: start, insert_before: index, range_length: length } };
        }
      }
    }
  }
  return null;
}

export interface PlaybackDependencies {
  request: <T>(token: string, path: string, method?: string, body?: unknown) => Promise<T | null>;
  loadPlaylist: (userId: string) => Promise<string | null>;
  savePlaylist: (userId: string, playlistId: string) => Promise<void>;
  loadQueueState?: (userId: string, playlistId: string) => Promise<ManagedQueue | null>;
  saveQueueState?: (playlistId: string, queue: ManagedQueue) => Promise<void>;
  onQueueFallback?: (reason: QueueFallbackReason) => void;
  delay: (ms: number) => Promise<void>;
}

export function normalizePlaybackUris(input: string | string[]): string[] {
  const uris = (Array.isArray(input) ? input : [input]).map(value => {
    const raw = typeof value === 'string' ? value.trim() : '';
    const id = raw.match(/^spotify:track:([a-zA-Z0-9]{22})$/)?.[1]
      ?? raw.match(/^https:\/\/open\.spotify\.com\/(?:intl-[^/]+\/)?track\/([a-zA-Z0-9]{22})(?:[/?#].*)?$/)?.[1]
      ?? raw.match(/^(?:spotify_)?([a-zA-Z0-9]{22})$/)?.[1];
    if (!id) throw new Error('This song does not have a playable Spotify track URI. Refresh the song list and try again.');
    return `spotify:track:${id}`;
  });
  if (!uris.length) throw new Error('The Spotify playback queue is empty.');
  return uris;
}

export function createSpotifyPlaybackController(deps: PlaybackDependencies) {
  let chain: Promise<unknown> = Promise.resolve();
  let revision = 0;
  let cancellationGeneration = 0;
  let releaseQueueWait: (() => void) | undefined;
  const contextDevices = new Set<string>();
  const playlists = new Map<string, string>();
  const managedQueues = new Map<string, ManagedQueue>();

  function invalidateVerification() {
    revision++;
    releaseQueueWait?.();
    return revision;
  }

  async function waitForQueueUpdate(ms: number) {
    let release!: () => void;
    const cancelled = new Promise<void>(resolve => { release = resolve; });
    releaseQueueWait = release;
    try { await Promise.race([deps.delay(ms), cancelled]); }
    finally { if (releaseQueueWait === release) releaseQueueWait = undefined; }
  }

  async function rememberQueue(playlistId: string, queue: ManagedQueue) {
    managedQueues.set(playlistId, queue);
    // This is only an optimization hint. Spotify ownership and snapshot checks
    // remain authoritative, including after an app restart or uncertain write.
    try { await deps.saveQueueState?.(playlistId, queue); }
    catch { /* Cache failure must not turn a successful playlist edit into a retry. */ }
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = chain.then(task);
    chain = result.catch(() => {});
    return result;
  }

  async function getQueuePlaylist(token: string): Promise<{ id: string; ownerId: string }> {
    const user = await deps.request<{ id: string }>(token, '/me');
    if (!user?.id) throw new Error('Unable to identify your Spotify account. Please reconnect Spotify.');
    const cachedId = playlists.get(user.id) ?? await deps.loadPlaylist(user.id);
    if (cachedId) {
      try {
        const playlist = await deps.request<{ id: string; owner: { id: string }; description: string }>(
          token, `/playlists/${encodeURIComponent(cachedId)}?fields=id,owner(id),description`,
        );
        // Only ever overwrite the private queue this app created for this user.
        if (playlist?.owner.id === user.id && playlist.description === QUEUE_DESCRIPTION) {
          playlists.set(user.id, cachedId);
          return { id: cachedId, ownerId: user.id };
        }
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
    }
    const playlist = await deps.request<{ id: string }>(token, '/me/playlists', 'POST', {
      name: 'MooDMap Playback Queue', public: false, description: QUEUE_DESCRIPTION,
    });
    if (!playlist?.id) throw new Error('Spotify could not create the playback queue.');
    playlists.set(user.id, playlist.id);
    await deps.savePlaylist(user.id, playlist.id);
    return { id: playlist.id, ownerId: user.id };
  }

  async function editActivePlaylist(token: string, uris: string[], before: PlaybackState | null, expectedRevision: number,
    onFallback: (reason: QueueFallbackReason) => void): Promise<boolean | { playlistId: string; offset: number; snapshotId: string }> {
    const fallback = (reason: QueueFallbackReason) => { onFallback(reason); return false; };
    const playlistId = before?.context?.uri?.match(/^spotify:playlist:(.+)$/)?.[1];
    if (!playlistId) return fallback('unmanaged-context');
    if (!before?.is_playing) return fallback('playback-not-active');
    if (before.item?.uri !== uris[0] && before.item?.linked_from?.uri !== uris[0]) return fallback('current-track-mismatch');
    let known = managedQueues.get(playlistId);
    const user = await deps.request<{ id: string }>(token, '/me');
    if (expectedRevision !== revision) return true;
    if (!user?.id) return fallback('account-unavailable');
    if (!known && deps.loadQueueState) {
      const savedId = playlists.get(user.id) ?? await deps.loadPlaylist(user.id);
      if (expectedRevision !== revision) return true;
      if (savedId === playlistId) {
        try { known = await deps.loadQueueState(user.id, playlistId) ?? undefined; }
        catch { /* Fall back normally if the optional local cache is unavailable. */ }
      }
      if (expectedRevision !== revision) return true;
    }
    if (!known || known.ownerId !== user.id || !known.snapshotId || !Array.isArray(known.uris)
      || !known.uris.every(uri => typeof uri === 'string' && /^spotify:track:[A-Za-z0-9]{22}$/.test(uri))) return fallback('managed-state-unavailable');
    const anchor = known.uris.indexOf(uris[0]);
    // The Web API has no playlist-occurrence index. Ambiguous repeated current
    // tracks must use the reliable context reset rather than edit the wrong row.
    if (anchor < 0 || known.uris.lastIndexOf(uris[0]) !== anchor) return fallback('ambiguous-current-track');
    const desired = [...known.uris.slice(0, anchor), ...uris];
    const edit = planPlaylistEdit(known.uris, desired, anchor);
    if (!edit) return fallback('complex-edit');
    let metadata;
    try {
      metadata = await deps.request<{ owner?: { id: string }; description: string; snapshot_id: string }>(
        token, `/playlists/${encodeURIComponent(playlistId)}?fields=owner(id),description,snapshot_id`,
      );
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
      managedQueues.delete(playlistId);
      return fallback('playlist-deleted'); // The existing recovery path recreates a deleted queue.
    }
    if (expectedRevision !== revision) return true;
    if (metadata?.owner?.id !== known.ownerId || metadata.description !== QUEUE_DESCRIPTION || metadata.snapshot_id !== known.snapshotId) {
      managedQueues.delete(playlistId);
      return fallback('playlist-changed');
    }
    managedQueues.set(playlistId, known);
    if (edit.method !== 'NONE') {
      // A timed-out write may still reach Spotify. Never reuse its old indexes
      // or automatically retry an insertion after an uncertain result.
      managedQueues.delete(playlistId);
      const result = await deps.request<{ snapshot_id: string }>(token, `/playlists/${playlistId}/items`, edit.method, {
        ...edit.body, ...(edit.method === 'PUT' ? { snapshot_id: known.snapshotId } : {}),
      });
      if (result?.snapshot_id) await rememberQueue(playlistId, { ...known, uris: desired, snapshotId: result.snapshot_id });
    }
    // Updating playlist contents does not guarantee every Connect device has
    // refreshed its playback queue. Confirm the visible upcoming sequence.
    // Allow slow Connect devices to catch up: three reads at most, with no
    // write retries. A newer command still cancels before another read/restart.
    for (const wait of [300, 700, 2000]) {
      if (expectedRevision !== revision) return true;
      await waitForQueueUpdate(wait);
      if (expectedRevision !== revision) return true;
      const queue = await deps.request<{ currently_playing: PlaybackState['item']; queue: NonNullable<PlaybackState['item']>[] }>(token, '/me/player/queue');
      if (expectedRevision !== revision) return true;
      if (queue?.currently_playing && queue.currently_playing.uri !== uris[0] && queue.currently_playing.linked_from?.uri !== uris[0]) {
        throw new Error('Spotify changed songs during the queue edit. Please try again.');
      }
      const count = Math.min(20, uris.length - 1);
      if (queue?.currently_playing && queue.queue?.length >= count && uris.slice(1, count + 1).every((uri, i) =>
        queue.queue[i].uri === uri || queue.queue[i].linked_from?.uri === uri)) return true;
    }
    // The playlist is already correct. If the device still needs a context
    // refresh, reuse it at the current row instead of replacing its contents.
    const updated = managedQueues.get(playlistId);
    return updated ? { playlistId, offset: anchor, snapshotId: updated.snapshotId } : fallback('missing-snapshot');
  }

  async function verify(token: string, expectedUri: string, expectedRevision: number) {
    let state: PlaybackState | null = null;
    for (const wait of [400, 800, 1200]) {
      await deps.delay(wait);
      if (expectedRevision !== revision) return { cancelled: true, playing: false, state };
      state = await deps.request<PlaybackState>(token, '/me/player');
      if (state?.is_playing && (state.item?.uri === expectedUri || state.item?.linked_from?.uri === expectedUri)) {
        return { cancelled: false, playing: true, state };
      }
    }
    return { cancelled: false, playing: false, state };
  }

  return {
    cancelPending() { invalidateVerification(); cancellationGeneration++; },
    // Native additions do not restart playback or cancel its verification. A
    // subsequent pause/skip must not silently discard an acknowledged add tap.
    addNative(token: string, uri: string, isCurrent: () => boolean = () => true) {
      return enqueue(() => {
        if (!isCurrent()) throw Object.assign(new Error('Spotify account changed. Please try again.'), { notSent: true });
        return deps.request(token, `/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
      });
    },
    // Pause/skip/seek invalidate any pending fallback before entering the same
    // command queue. A slow verification must never restart a paused song.
    command(token: string, path: string, method = 'PUT', body?: unknown) {
      if (/^\/me\/player\/(pause|next|previous|seek)(?:\?|$)/.test(path)) invalidateVerification();
      const generation = cancellationGeneration;
      return enqueue(() => generation === cancellationGeneration ? deps.request(token, path, method, body) : Promise.resolve(null));
    },

    updateQueue(token: string, input: string[], positionMs?: number): Promise<void> {
      return this.play(token, input, positionMs, undefined, undefined, true);
    },

    play(token: string, input?: string | string[], positionMs?: number, contextUri?: string,
      offset?: { position: number } | { uri: string }, queueEdit = false): Promise<void> {
      const requestRevision = invalidateVerification();
      return enqueue(async () => {
        if (requestRevision !== revision) return;
        if (contextUri || input === undefined) {
          await deps.request(token, '/me/player/play', 'PUT', {
            ...(contextUri ? { context_uri: contextUri, ...(offset ? { offset } : {}) } : {}),
            ...(positionMs !== undefined ? { position_ms: Math.max(0, Math.floor(positionMs)) } : {}),
          });
          return;
        }

        // Validate BEFORE issuing a command that can replace current playback.
        const uris = normalizePlaybackUris(input);
        const before = await deps.request<PlaybackState>(token, '/me/player');
        if (requestRevision !== revision) return;
        // Reuse this required live read: do not add a second state request just
        // to check shuffle. Missing state is treated conservatively, never as off.
        if (queueEdit && before?.shuffle_state !== false) {
          const device = before?.device?.id;
          await deps.request(token, '/me/player/shuffle?state=false'
            + (device ? `&device_id=${encodeURIComponent(device)}` : ''), 'PUT');
          if (requestRevision !== revision) return;
        }
        let fallbackReason: QueueFallbackReason = 'device-queue-stale';
        const edited = queueEdit ? await editActivePlaylist(token, uris, before, requestRevision,
          reason => { fallbackReason = reason; }) : false;
        if (edited === true) return;
        if (requestRevision !== revision) return;
        const deviceId = before?.device?.id;
        const path = '/me/player/play' + (deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '');
        let position = Math.max(0, Math.floor(positionMs ?? 0));

        if (!queueEdit && (!deviceId || !contextDevices.has(deviceId))) {
          await deps.request(token, path, 'PUT', { uris, position_ms: position });
          const result = await verify(token, uris[0], requestRevision);
          if (result.cancelled || result.playing) return;
          // Do not replace music the user started externally during verification.
          if (result.state?.item) {
            throw new Error('Spotify did not start the selected song. Please try again.');
          }
        }

        if (requestRevision !== revision) return;
        let playlistId: string;
        let playlistOffset = 0;
        if (edited) {
          playlistId = edited.playlistId;
          playlistOffset = edited.offset;
          // An external edit during the settling window invalidates row offsets.
          const metadata = await deps.request<{ snapshot_id: string }>(token,
            `/playlists/${encodeURIComponent(playlistId)}?fields=snapshot_id`);
          if (requestRevision !== revision) return;
          if (metadata?.snapshot_id !== edited.snapshotId) {
            managedQueues.delete(playlistId);
            throw new Error('Spotify playlist changed during the queue edit. Please try again.');
          }
        } else {
          const playlist = await getQueuePlaylist(token);
          if (requestRevision !== revision) return;
          playlistId = playlist.id;
          managedQueues.delete(playlistId);
          let snapshotId: string | undefined;
          // Spotify accepts at most 100 playlist items per write. Keep duplicates
          // and ordering, and never silently truncate a long recommendation list.
          for (let i = 0; i < uris.length; i += 100) {
            if (requestRevision !== revision) return;
            const result = await deps.request<{ snapshot_id: string }>(token, `/playlists/${playlistId}/items`, i === 0 ? 'PUT' : 'POST', { uris: uris.slice(i, i + 100) });
            snapshotId = result?.snapshot_id;
          }
          if (snapshotId) await rememberQueue(playlistId, { ownerId: playlist.ownerId, uris, snapshotId });
        }
        if (requestRevision !== revision) return;
        if (queueEdit) {
          // A necessary context switch must use the live position, not the
          // position captured before network requests and queue verification.
          const latest = await deps.request<PlaybackState>(token, '/me/player');
          if (requestRevision !== revision) return;
          if (!latest?.is_playing || (latest.item?.uri !== uris[0] && latest.item?.linked_from?.uri !== uris[0])
            || latest.device?.id !== before?.device?.id || latest.context?.uri !== before?.context?.uri) {
            throw new Error('Spotify playback changed during the queue edit. Please try again.');
          }
          position = Math.max(0, Math.floor(latest.progress_ms));
          // Only record real restart attempts; omit account, song, and device IDs.
          try { deps.onQueueFallback?.(fallbackReason); } catch { /* Diagnostics cannot affect playback. */ }
        }
        await deps.request(token, path, 'PUT', {
          context_uri: `spotify:playlist:${playlistId}`, offset: { position: playlistOffset }, position_ms: position,
        });
        const recovered = await verify(token, uris[0], requestRevision);
        if (recovered.cancelled) return;
        if (!recovered.playing) throw new Error('Spotify accepted playback but did not start the selected song. Please open Spotify and try again.');
        const recoveredDeviceId = recovered.state?.device?.id ?? deviceId;
        if (recoveredDeviceId) contextDevices.add(recoveredDeviceId);
      });
    },
  };
}

const QUEUE_DESCRIPTION = 'Managed by MooDMap for reliable custom playback. Its songs are replaced when you change your playback queue.';
