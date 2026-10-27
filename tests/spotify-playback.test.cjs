/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Exercise the actual TypeScript service without loading Expo native modules.
function loadTS(file, overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require, console,
    setTimeout, clearTimeout, AbortController, URLSearchParams, process, ...overrides }, { filename: file });
  return module.exports;
}
const { createSpotifyPlaybackController, normalizePlaybackUris } = loadTS('src/services/spotifyPlayback.ts');
const { createSpotifyReadCoordinator } = loadTS('src/services/spotifyRequests.ts');
const nativeQueueModule = loadTS('src/services/spotifyNativeQueue.ts');
const A = 'spotify:track:' + 'A'.repeat(22);
const B = 'spotify:track:' + 'B'.repeat(22);
const C = 'spotify:track:' + 'C'.repeat(22);
const clone = value => JSON.parse(JSON.stringify(value));

function queueFeedbackFixture() {
  const messages = [];
  const cleanups = [];
  const { useQueueAdditionFeedback: createFeedback } = loadTS('src/hooks/useQueueAdditionFeedback.ts', {
    require: name => {
      assert.equal(name, 'react');
      return {
        useRef: current => ({ current }), useCallback: fn => fn,
        useEffect: effect => { cleanups.push(effect()); },
      };
    },
  });
  return {
    run: createFeedback((message, type) => messages.push({ message, type })),
    messages, unmount: () => cleanups.forEach(cleanup => cleanup()),
  };
}

test('queue feedback appears before the network result and confirms success only afterward', async () => {
  const f = queueFeedbackFixture();
  let finish;
  const adding = f.run(() => new Promise(resolve => { finish = resolve; }));
  assert.deepEqual(f.messages, [{ message: 'Adding to queue…', type: 'pending' }]);
  finish(true);
  await adding;
  assert.deepEqual(f.messages.at(-1), { message: 'Added to Queue', type: 'success' });
});

for (const failsByThrowing of [false, true]) {
  test(`queue feedback replaces pending with failure for ${failsByThrowing ? 'rejected' : 'unsuccessful'} additions`, async () => {
    const f = queueFeedbackFixture();
    await f.run(async () => {
      if (failsByThrowing) throw new Error('Offline');
      return false;
    });
    assert.deepEqual(f.messages.map(message => message.type), ['pending', 'error']);
  });
}

test('an older queue addition cannot replace the newer pending or failure message', async () => {
  const f = queueFeedbackFixture();
  let first;
  let second;
  const a = f.run(() => new Promise(resolve => { first = resolve; }));
  const b = f.run(() => new Promise(resolve => { second = resolve; }));
  first(true);
  await a;
  assert.deepEqual(f.messages.map(message => message.type), ['pending', 'pending']);
  second(false);
  await b;
  assert.deepEqual(f.messages.map(message => message.type), ['pending', 'pending', 'error']);
});

test('queue feedback does not update an unmounted screen when the network completes', async () => {
  const f = queueFeedbackFixture();
  let finish;
  const adding = f.run(() => new Promise(resolve => { finish = resolve; }));
  f.unmount();
  finish(true);
  await adding;
  assert.equal(f.messages.length, 1);
});

test('local additions keep immediate success feedback without a network-pending message', async () => {
  const f = queueFeedbackFixture();
  await f.run(async () => true, false);
  assert.deepEqual(f.messages, [{ message: 'Added to Queue', type: 'success' }]);
});

const state = (uri, playing = true) => ({ is_playing: playing, shuffle_state: false, progress_ms: 12000,
  device: { id: 'android-device' }, item: uri ? { uri } : null });

function fixture(options = {}) {
  const calls = [];
  const saved = new Map();
  const queueStates = new Map();
  const fallbacks = [];
  let current = state(C);
  let playlistUris = [];
  let description;
  let snapshot = 0;
  const deps = {
    delay: options.delay ?? (async () => {}),
    loadPlaylist: async user => saved.get(user) ?? null,
    savePlaylist: async (user, id) => saved.set(user, id),
    loadQueueState: async (user, id) => {
      const cached = queueStates.get(id);
      return cached?.ownerId === user ? clone(cached) : null;
    },
    saveQueueState: async (id, queue) => { queueStates.set(id, clone(queue)); },
    onQueueFallback: reason => { fallbacks.push(reason); },
    request: async (token, endpoint, method = 'GET', body) => {
      calls.push({ token, endpoint, method, body });
      if (options.request) {
        const result = await options.request({ token, endpoint, method, body });
        if (result !== undefined) return result;
      }
      if (endpoint === '/me/player') return clone(current);
      if (endpoint === '/me') return { id: token };
      if (endpoint === '/me/playlists') {
        description = body.description;
        return { id: 'queue-' + token };
      }
      if (endpoint.includes('?fields=')) return { id: 'queue-' + token, owner: { id: token }, description, snapshot_id: 'snapshot-' + snapshot };
      if (endpoint.endsWith('/items')) {
        if (body.range_start !== undefined) {
          const moved = playlistUris.splice(body.range_start, body.range_length ?? 1);
          const at = body.insert_before > body.range_start ? body.insert_before - moved.length : body.insert_before;
          playlistUris.splice(at, 0, ...moved);
        } else if (method === 'PUT') playlistUris = [...body.uris];
        else playlistUris.splice(body.position ?? playlistUris.length, 0, ...body.uris);
        return { snapshot_id: 'snapshot-' + (++snapshot) };
      }
      if (endpoint === '/me/player/queue') {
        const index = playlistUris.indexOf(current.item?.uri);
        return { currently_playing: current.item, queue: playlistUris.slice(index + 1).map(uri => ({ uri })) };
      }
      if (endpoint.startsWith('/me/player/play')) {
        if (body?.uris) current = options.broken === false ? state(body.uris[0]) : state(null, false);
        else if (body?.context_uri) current = options.recoveryFails ? state(null, false)
          : { ...state(playlistUris[body.offset?.position ?? 0] ?? A), context: { uri: body.context_uri } };
        else current.is_playing = true;
        if (body?.position_ms !== undefined) current.progress_ms = body.position_ms;
        return null; // 204 is deliberately indistinguishable from success data.
      }
      if (endpoint === '/me/player/pause') current.is_playing = false;
      if (endpoint.startsWith('/me/player/shuffle?state=false')) current.shuffle_state = false;
      return null;
    },
  };
  return { calls, saved, fallbacks, deps, controller: createSpotifyPlaybackController(deps),
    getCurrent: () => current, setCurrent: value => { current = value; }, getPlaylistUris: () => playlistUris };
}

test('healthy URI playback verifies the selected song without creating a playlist', async () => {
  const f = fixture({ broken: false });
  await f.controller.play('user', [A, B]);
  assert.equal(f.getCurrent().item.uri, A);
  assert.equal(f.calls.filter(c => c.endpoint === '/me/playlists').length, 0);
});

test('204 followed by silence recovers the entire ordered queue on Android', async () => {
  const f = fixture();
  await f.controller.play('user', [A, C, B, A], 42123);
  assert.deepEqual(f.getPlaylistUris(), [A, C, B, A]);
  const play = f.calls.filter(c => c.endpoint.startsWith('/me/player/play')).at(-1);
  assert.deepEqual(clone(play.body), { context_uri: 'spotify:playlist:queue-user', offset: { position: 0 }, position_ms: 42123 });
  assert.match(play.endpoint, /device_id=android-device/);
  assert.equal(f.calls.find(c => c.endpoint === '/me/playlists').body.public, false);
  assert.equal(f.getCurrent().item.uri, A);
});

test('known affected device skips the destructive URI path and reuses its private queue', async () => {
  const f = fixture();
  await f.controller.play('user', [A, B]);
  await f.controller.play('user', [B, A]);
  assert.equal(f.calls.filter(c => c.body?.uris && c.endpoint.startsWith('/me/player/play')).length, 1);
  assert.equal(f.calls.filter(c => c.endpoint === '/me/playlists').length, 1);
  assert.deepEqual(f.getPlaylistUris(), [B, A]);
});

test('long queues are written in order in batches of at most 100', async () => {
  const f = fixture();
  const uris = Array.from({ length: 251 }, (_, i) => [A, B, C][i % 3]);
  await f.controller.play('user', uris);
  assert.deepEqual(f.getPlaylistUris(), uris);
  assert.deepEqual(f.calls.filter(c => c.endpoint.endsWith('/items')).map(c => [c.method, c.body.uris.length]),
    [['PUT', 100], ['POST', 100], ['POST', 51]]);
});

test('invalid and empty lists are rejected before any playback mutation', async () => {
  const f = fixture();
  for (const uris of [[], [''], [A, 'https://cdn.deezer.com/preview.mp3'], ['spotify:episode:' + 'A'.repeat(22)]]) {
    await assert.rejects(f.controller.play('user', uris));
  }
  assert.equal(f.calls.length, 0);
  assert.deepEqual(clone(normalizePlaybackUris(['spotify_' + 'A'.repeat(22), 'https://open.spotify.com/track/' + 'B'.repeat(22) + '?si=test'])), [A, B]);
});

test('album/playlist context and resume retain their existing request shape', async () => {
  const f = fixture();
  await f.controller.play('user', undefined, 2000, 'spotify:album:album', { uri: A });
  await f.controller.play('user');
  assert.equal(f.calls.length, 2);
  assert.deepEqual(clone(f.calls[0].body), { context_uri: 'spotify:album:album', offset: { uri: A }, position_ms: 2000 });
  assert.deepEqual(clone(f.calls[1].body), {});
});

test('HTTP failure propagates and does not create a fallback playlist', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint.startsWith('/me/player/play')) throw new Error('No active device found');
  } });
  await assert.rejects(f.controller.play('user', [A]), /No active device/);
  assert.equal(f.saved.size, 0);
});

test('verification errors are not mistaken for empty playback', async () => {
  let reads = 0;
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player' && ++reads > 1) throw new Error('Rate limited');
  } });
  await assert.rejects(f.controller.play('user', [A]), /Rate limited/);
  assert.equal(f.saved.size, 0);
});

test('a playing relinked track counts as successful playback', async () => {
  let reads = 0;
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player' && ++reads > 1) return { ...state(B), item: { uri: B, linked_from: { uri: A } } };
  } });
  await f.controller.play('user', [A]);
  assert.equal(f.saved.size, 0);
});

test('a newer pause cancels recovery before it can restart playback', async () => {
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ delay: () => new Promise(resolve => { release = resolve; entered(); }) });
  const play = f.controller.play('user', [A]);
  await waiting;
  const pause = f.controller.command('user', '/me/player/pause');
  release();
  await Promise.all([play, pause]);
  assert.equal(f.saved.size, 0);
  assert.equal(f.calls.at(-1).endpoint, '/me/player/pause');
  assert.equal(f.getCurrent().is_playing, false);
});

test('rapid song taps discard obsolete queued play requests', async () => {
  const f = fixture({ broken: false });
  await Promise.all([f.controller.play('user', [A]), f.controller.play('user', [B])]);
  assert.equal(f.getCurrent().item.uri, B);
  assert.equal(f.calls.filter(c => c.endpoint.startsWith('/me/player/play')).length, 1);
});

test('starting another selection cancels recovery even before its search completes', async () => {
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ delay: () => new Promise(resolve => { release = resolve; entered(); }) });
  const play = f.controller.play('user', [A]);
  await waiting;
  f.controller.cancelPending();
  release();
  await play;
  assert.equal(f.saved.size, 0);
});

test('a deleted managed playlist is recreated without touching another playlist', async () => {
  let deleted = false;
  const f = fixture({ request: ({ endpoint }) => {
    if (deleted && endpoint.includes('?fields=')) throw Object.assign(new Error('Not found'), { status: 404 });
  } });
  await f.controller.play('user', [A]);
  deleted = true;
  await f.controller.play('user', [B]);
  assert.equal(f.calls.filter(c => c.endpoint === '/me/playlists').length, 2);
  assert.deepEqual(f.getPlaylistUris(), [B]);
});

test('failed playlist permissions surface instead of retrying destructive URI playback', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/playlists') throw Object.assign(new Error('Insufficient scope'), { status: 403 });
  } });
  await assert.rejects(f.controller.play('user', [A]), /Insufficient scope/);
  assert.equal(f.calls.filter(c => c.endpoint.startsWith('/me/player/play')).length, 1);
});

test('failed recovery surfaces an error instead of reporting playback success', async () => {
  const f = fixture({ recoveryFails: true });
  await assert.rejects(f.controller.play('user', [A]), /did not start/);
});

test('another externally playing song is not replaced by a fallback', async () => {
  let reads = 0;
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player' && ++reads > 1) return state(C);
  } });
  await assert.rejects(f.controller.play('user', [A]), /did not start/);
  assert.equal(f.saved.size, 0);
});

test('account changes never overwrite the previous account playback playlist', async () => {
  const f = fixture();
  await f.controller.play('alice', [A]);
  await f.controller.play('bob', [B]);
  assert.equal(f.saved.get('alice'), 'queue-alice');
  assert.equal(f.saved.get('bob'), 'queue-bob');
  assert.equal(f.calls.filter(c => c.endpoint === '/me/playlists').length, 2);
});

const queueTrack = uri => ({ id: 'spotify_' + uri.split(':')[2], url: uri, category: 'spotify',
  title: uri, artist: 'Artist', cover: '', duration: '3:00', durationSec: 180 });

// Run the actual provider's queue commands with initialized hook state and a
// simulated Spotify device. Mount effects/native audio are intentionally inert;
// these tests cover command behavior, not React rendering or device playback.
function musicQueueFixture({ playing = true, active = queueTrack(A), queue = [queueTrack(A), queueTrack(C)], playback = {} } = {}) {
  const f = fixture(playback);
  f.setCurrent({ ...state(active?.url ?? null, playing), progress_ms: 42000 });
  const stateValues = new Map([[0, active], [1, playing], [3, 42], [5, queue]]);
  let stateIndex = 0;
  let now = 100000;
  let spotifySession = 0;
  const alerts = [];
  const tracker = nativeQueueModule.createNativeQueueTracker({ load: async () => ({}), save: async () => {} });
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initial => {
      const index = stateIndex++;
      if (!stateValues.has(index)) stateValues.set(index, typeof initial === 'function' ? initial() : initial);
      return [stateValues.get(index), next => stateValues.set(index, typeof next === 'function' ? next(stateValues.get(index)) : next)];
    },
    useRef: current => ({ current }), useCallback: fn => fn,
    useMemo: fn => fn(), useEffect() {},
  };
  const spotify = {
    cancelPendingPlayback: () => f.controller.cancelPending(),
    play: (...args) => f.controller.play(...args),
    pause: token => f.controller.command(token, '/me/player/pause'),
    updatePlaybackQueue: (...args) => f.controller.updateQueue(...args),
    setShuffle: (token, enabled) => f.controller.command(token, '/me/player/shuffle?state=' + enabled),
    addToQueue: async (token, uri, origin) => {
      const entry = await tracker.reserve(token, uri, origin);
      try { await f.controller.addNative(token, uri); }
      catch (error) { if (error.status >= 400 && error.status < 500) await tracker.reject(token, entry); throw error; }
    },
    hasPendingNativeQueue: token => tracker.pending(token),
    nextTrack: token => f.controller.command(token, '/me/player/next', 'POST'),
    previousTrack: token => f.controller.command(token, '/me/player/previous', 'POST'),
    getQueue: async token => {
      const revision = tracker.revision();
      const data = await f.deps.request(token, '/me/player/queue');
      await tracker.observe(token, data, revision);
      return data;
    },
  };
  const { MusicProvider } = loadTS('src/context/MusicContext.tsx', {
    Date: class extends Date { static now() { return now; } },
    console: { log() {}, warn() {} },
    setTimeout: () => 0, clearTimeout() {},
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-file-system') return { File: class {}, Paths: { document: '' } };
      if (name === 'expo-haptics') return { impactAsync() {}, ImpactFeedbackStyle: { Light: 'light' } };
      if (name === 'expo-audio' || name === 'expo-secure-store' || name === '../utils/audioCache' || name === '../services/recommendationEngine') return {};
      if (name === '../services/spotifyPlayback') return { normalizePlaybackUris };
      if (name === '../services/spotifyNativeQueue') return nativeQueueModule;
      if (name === '../services/spotify') return spotify;
      if (name === '../stores/alertStore') return { useAlertStore: { getState: () => ({ showAlert: (...args) => alerts.push(args) }) } };
      if (name === '../stores/tierStore') return { getSpotifySessionGeneration: () => spotifySession,
        useTierStore: { getState: () => ({ getValidAccessToken: async () => 'user' }) } };
      throw new Error('Unexpected provider import: ' + name);
    },
  });
  const context = MusicProvider({ children: null }).props.value;
  return { ...f, context, alerts, queue: () => stateValues.get(5), active: () => stateValues.get(0),
    playing: () => stateValues.get(1), advance: ms => { now += ms; }, now: () => now,
    changeSession: () => { spotifySession++; } };
}

const remoteQueue = (current, upcoming) => {
  const track = uri => ({ id: uri.split(':')[2], uri, name: uri,
    artists: [{ name: 'Artist' }], album: { images: [] }, duration_ms: 180000 });
  return { currently_playing: track(current), queue: upcoming.map(track) };
};
const flushQueueRead = () => new Promise(resolve => setImmediate(resolve));
const queueUris = f => Array.from(f.queue(), track => track.url);

function nativeTrackerFixture() {
  let saved = {};
  const deps = { load: async () => clone(saved), save: async value => { saved = clone(value); } };
  const tracker = nativeQueueModule.createNativeQueueTracker(deps);
  return { tracker, restart: () => nativeQueueModule.createNativeQueueTracker(deps), saved: () => saved,
    observe: data => tracker.observe('user', data, tracker.revision()) };
}

test('native queue protection persists across restart, stays through playback, then unlocks after consumption', async () => {
  const f = nativeTrackerFixture();
  await f.tracker.reserve('user', B, A);
  assert.equal(await f.restart().pending('user'), true);
  assert.equal(await f.tracker.pending('other-account'), false);
  await f.observe(remoteQueue(A, [B, C]));
  await f.observe(remoteQueue(B, [C]));
  assert.equal(await f.tracker.pending('user'), true);
  await f.observe(remoteQueue(C, [A]));
  assert.equal(await f.tracker.pending('user'), false);
  assert.equal(await f.restart().pending('user'), false);
});

test('unseen additions and stale or malformed queue responses cannot unlock a rewrite', async () => {
  const f = nativeTrackerFixture();
  await f.tracker.reserve('user', B, A);
  await f.observe(remoteQueue(A, [C]));
  assert.equal(await f.tracker.pending('user'), true);
  await f.observe(remoteQueue(A, [B, C]));
  const older = f.tracker.revision();
  await f.tracker.reserve('user', C, A);
  await f.tracker.observe('user', remoteQueue(A, []), older);
  await f.observe(null);
  await f.observe({ currently_playing: { uri: A }, queue: [null] });
  assert.equal(f.saved().user.length, 2);
});

test('adding the currently playing song does not confuse its old playing copy with the new addition', async () => {
  const f = nativeTrackerFixture();
  await f.tracker.reserve('user', A, A);
  await f.observe(remoteQueue(A, [C]));
  await f.observe(remoteQueue(C, []));
  assert.equal(await f.tracker.pending('user'), true);
  await f.observe(remoteQueue(C, [A]));
  await f.observe(remoteQueue(A, []));
  assert.equal(await f.tracker.pending('user'), true);
  await f.observe(remoteQueue(C, []));
  assert.equal(await f.tracker.pending('user'), false);
});

test('intentional native repeats stay protected while any matching occurrence remains visible', async () => {
  const f = nativeTrackerFixture();
  await f.tracker.reserve('user', B, A);
  await f.tracker.reserve('user', B, A);
  await f.observe(remoteQueue(A, [B, B]));
  await f.observe(remoteQueue(B, [B, C]));
  await f.observe(remoteQueue(B, [C]));
  assert.equal(f.saved().user.length, 2);
  await f.observe(remoteQueue(C, []));
  assert.equal(await f.tracker.pending('user'), false);
});

test('relinked native tracks count as observed and failed persistence prevents reserving an addition', async () => {
  const f = nativeTrackerFixture();
  await f.tracker.reserve('user', B, A);
  const data = remoteQueue(A, [C]);
  data.queue[0].linked_from = { uri: B };
  await f.observe(data);
  await f.observe(remoteQueue(A, []));
  assert.equal(await f.tracker.pending('user'), false);
  const failing = nativeQueueModule.createNativeQueueTracker({ load: async () => ({}), save: async () => { throw new Error('Disk full'); } });
  await assert.rejects(failing.reserve('user', B, A), /Disk full/);
  assert.equal(await failing.pending('user'), false);
});

test('queue view imports Spotify native order including repeats and unlocks reordering when additions finish', async () => {
  let data = remoteQueue(A, [B, B, C]);
  const f = musicQueueFixture({ playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue' ? data : undefined,
  } });
  await f.context.addToQueue(queueTrack(B));
  await f.context.addToQueue(queueTrack(B));
  await f.context.refreshSpotifyQueue();
  assert.deepEqual(queueUris(f), [A, B, B, C]);
  assert.equal(await f.context.syncReorderedQueue([A, C, B, B].map(queueTrack)), false);
  data = remoteQueue(C, []);
  f.setCurrent(state(C));
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(C));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [C]);
  assert.equal(await f.context.syncReorderedQueue([C, A].map(queueTrack)), true);
});

test('native next and previous remain usable while custom row playback is protected', async () => {
  const f = musicQueueFixture();
  await f.context.addToQueue(queueTrack(B));
  await f.context.play(queueTrack(C));
  assert.equal(f.active().url, A);
  await f.context.next();
  await f.context.prev();
  assert.deepEqual(f.calls.map(c => c.endpoint), [
    '/me/player/queue?uri=' + encodeURIComponent(B), '/me/player/queue', '/me/player/next', '/me/player/previous',
  ]);
});

test('native additions survive a newer pause but never cross an account change before sending', async () => {
  let release;
  const f = fixture({ request: ({ endpoint }) => endpoint.includes('/shuffle') ? new Promise(resolve => { release = resolve; }) : undefined });
  const busy = f.controller.command('user', '/me/player/shuffle?state=false');
  await flushQueueRead();
  const adding = f.controller.addNative('user', B);
  f.controller.cancelPending();
  const pause = f.controller.command('user', '/me/player/pause');
  release(null);
  await Promise.all([busy, adding, pause]);
  assert.equal(f.calls.filter(c => c.endpoint.includes('/queue?')).length, 1);
  assert.equal(f.getCurrent().is_playing, false);
  await assert.rejects(f.controller.addNative('old-account', C, () => false), /account changed/);
  assert.equal(f.calls.filter(c => c.token === 'old-account').length, 0);
});

test('automatic advance reads Spotify queue once without sending playback commands', async () => {
  const f = musicQueueFixture({ queue: [A, B].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue' ? remoteQueue(B, [C]) : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  assert.equal(f.active().id, queueTrack(B).id);
  assert.deepEqual(queueUris(f), [B]);
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
  f.context.updateSpotifyPlayback(2, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(f.calls.map(call => [call.endpoint, call.method]), [['/me/player/queue', 'GET']]);
  assert.equal(f.playing(), true);
});

test('automatic advance can reconcile an empty upcoming Spotify queue', async () => {
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue' ? remoteQueue(B, []) : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B]);
});

test('a queue response still describing the previous song cannot undo automatic advance', async () => {
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue' ? remoteQueue(A, [B, C]) : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
  assert.equal(f.active().id, queueTrack(B).id);
});

test('a second advance during a slow queue read fetches the latest song after discarding the old response', async () => {
  let finish;
  let reads = 0;
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => {
      if (endpoint !== '/me/player/queue') return;
      if (++reads === 1) return new Promise(resolve => { finish = resolve; });
      return remoteQueue(C, [A]);
    },
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(C));
  assert.equal(reads, 1, 'Queue reads remain serialized');
  finish(remoteQueue(B, [C]));
  await flushQueueRead();
  assert.equal(reads, 2);
  assert.deepEqual(queueUris(f), [C, A]);
  assert.equal(f.active().id, queueTrack(C).id);
});

test('automatic queue refresh cannot overwrite a newer local queue edit', async () => {
  let finish;
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue'
      ? new Promise(resolve => { finish = resolve; }) : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  f.context.setQueue([B, A, C].map(queueTrack));
  finish(remoteQueue(B, [C]));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, A, C]);
});

test('adding a song while an automatic queue read is pending keeps the completed addition', async () => {
  let finish;
  let firstRead = true;
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => {
      if (endpoint === '/me/player/queue' && firstRead) {
        firstRead = false;
        return new Promise(resolve => { finish = resolve; });
      }
    },
  } });
  f.setCurrent(state(B));
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.equal(await f.context.addToQueue(queueTrack(A)), true);
  finish(remoteQueue(B, [C]));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C], 'A stale read cannot supply the new queue; await the post-add refresh');
  assert.deepEqual(f.getPlaylistUris(), []);
  assert.equal(f.calls.filter(c => c.endpoint.includes('/queue?')).length, 1);
});

test('automatic queue refresh ignores a response from a disconnected or replaced session', async () => {
  let finish;
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue'
      ? new Promise(resolve => { finish = resolve; }) : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  f.changeSession();
  finish(remoteQueue(B, [A]));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
});

test('failed automatic queue reads preserve the accepted track and playback without retries', async () => {
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => { if (endpoint === '/me/player/queue') throw new Error('Offline'); },
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
  assert.equal(f.active().id, queueTrack(B).id);
  assert.equal(f.playing(), true);
  assert.equal(f.alerts.length, 0);
  assert.equal(f.calls.length, 1);
});

test('malformed automatic queue data leaves the current queue intact', async () => {
  const response = remoteQueue(B, [C]);
  response.queue.push(null);
  const f = musicQueueFixture({ queue: [A, B, C].map(queueTrack), playback: {
    request: ({ endpoint }) => endpoint === '/me/player/queue' ? response : undefined,
  } });
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
  assert.equal(f.playing(), true);
  assert.equal(f.alerts.length, 0);
});

test('automatic refresh preserves the unreported tail and intentional repeats of a custom queue', async () => {
  let advanced = false;
  const f = musicQueueFixture({ playback: {
    request: ({ endpoint }) => advanced && endpoint === '/me/player/queue' ? remoteQueue(B, [C]) : undefined,
  } });
  assert.equal(await f.context.syncReorderedQueue([A, B, C, B, C].map(queueTrack)), true);
  advanced = true;
  const before = f.calls.length;
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C, B, C]);
  assert.deepEqual(f.calls.slice(before).map(call => [call.endpoint, call.method]), [['/me/player/queue', 'GET']]);
});

test('a conflicting Spotify preview cannot replace the custom queue order on automatic advance', async () => {
  let advanced = false;
  const f = musicQueueFixture({ playback: {
    request: ({ endpoint }) => advanced && endpoint === '/me/player/queue' ? remoteQueue(B, [A, C]) : undefined,
  } });
  assert.equal(await f.context.syncReorderedQueue([A, B, C].map(queueTrack)), true);
  advanced = true;
  f.context.updateSpotifyPlayback(1, 180, true, queueTrack(B));
  await flushQueueRead();
  assert.deepEqual(queueUris(f), [B, C]);
});

test('pause icon updates immediately and rejects pre-command and lagging Spotify observations', async () => {
  const f = musicQueueFixture();
  const startedAt = f.now();
  const pausing = f.context.pause();
  assert.equal(f.playing(), false);
  f.context.updateSpotifyPlayback(42, 180, true, queueTrack(A), startedAt);
  assert.equal(f.playing(), false);
  await pausing;
  f.advance(1500);
  f.context.updateSpotifyPlayback(42, 180, true, queueTrack(A), f.now());
  assert.equal(f.playing(), false);
  f.context.updateSpotifyPlayback(42, 180, false, queueTrack(A), f.now());
  assert.equal(f.playing(), false);
  // Once confirmed, subsequent changes made in Spotify remain authoritative.
  f.advance(1000);
  f.context.updateSpotifyPlayback(43, 180, true, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
});

test('resume icon does not bounce back to play while Spotify still reports paused', async () => {
  const f = musicQueueFixture({ playing: false });
  const resuming = f.context.resume();
  assert.equal(f.playing(), true);
  f.context.updateSpotifyPlayback(42, 180, false, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
  await resuming;
  f.advance(1500);
  f.context.updateSpotifyPlayback(42, 180, false, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
  f.context.updateSpotifyPlayback(44, 180, true, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
});

test('unconfirmed playback intent expires and cannot hide a real remote pause forever', async () => {
  const f = musicQueueFixture({ playing: false });
  await f.context.resume();
  f.advance(6000);
  f.context.updateSpotifyPlayback(42, 180, false, queueTrack(A), f.now());
  assert.equal(f.playing(), false);
});

test('a delayed poll started before the command cannot overwrite it even after the grace period', async () => {
  const f = musicQueueFixture();
  const startedAt = f.now();
  await f.context.pause();
  f.advance(8000);
  f.context.updateSpotifyPlayback(42, 180, true, queueTrack(A), startedAt);
  assert.equal(f.playing(), false);
  f.context.updateSpotifyPlayback(42, 180, true, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
});

test('failed playback commands roll the optimistic icon back and allow remote reconciliation', async () => {
  for (const playing of [true, false]) {
    const f = musicQueueFixture({ playing, playback: { request: ({ endpoint }) => {
      if (endpoint === '/me/player/pause' || endpoint.startsWith('/me/player/play')) throw new Error('Offline');
    } } });
    await (playing ? f.context.pause() : f.context.resume());
    assert.equal(f.playing(), playing);
    f.advance(2000);
    f.context.updateSpotifyPlayback(42, 180, !playing, queueTrack(A), f.now());
    assert.equal(f.playing(), !playing);
  }
});

test('rapid pause then resume keeps the latest intent and ignores the cancelled pause', async () => {
  const f = musicQueueFixture();
  const pausing = f.context.pause();
  const resuming = f.context.resume();
  await Promise.all([pausing, resuming]);
  f.advance(1500);
  f.context.updateSpotifyPlayback(42, 180, false, queueTrack(A), f.now());
  assert.equal(f.playing(), true);
});

test('track selection does not flash a play icon before successful Spotify playback', async () => {
  const f = musicQueueFixture({ playback: { broken: false } });
  const playing = f.context.play(queueTrack(B), 'spotify:album:example');
  assert.equal(f.playing(), true);
  await playing;
  f.advance(1500);
  f.context.updateSpotifyPlayback(0, 180, false, queueTrack(B), f.now());
  assert.equal(f.playing(), true);
});

function rotationFixture({ playing = true, reducedMotion = false } = {}) {
  let tick;
  let cleanup;
  let onState;
  let active = false;
  let removed = false;
  const rotation = { value: 0, set(fn) { this.value = fn(this.value); } };
  const frame = { setActive(value) { active = value; } };
  const AppState = { currentState: 'active', addEventListener(_event, fn) {
    onState = fn;
    return { remove() { removed = true; } };
  } };
  const { usePlaybackRotation: renderRotation } = loadTS('src/hooks/usePlaybackRotation.ts', { require: name => {
    if (name === 'react') return { useCallback: fn => fn, useEffect: fn => { cleanup = fn(); } };
    if (name === 'react-native') return { AppState };
    if (name === 'react-native-reanimated') return {
      useSharedValue: () => rotation, useReducedMotion: () => reducedMotion,
      useFrameCallback(fn) { tick = fn; return frame; },
    };
    throw new Error('Unexpected rotation import: ' + name);
  } });
  renderRotation(playing);
  return {
    rotation, active: () => active, removed: () => removed,
    frame: elapsed => { if (active) tick({ timeSincePreviousFrame: elapsed }); },
    render: nextPlaying => { cleanup(); renderRotation(nextPlaying); },
    appState: state => { AppState.currentState = state; onState(); },
    cleanup: () => cleanup(),
  };
}

test('cover rotation has the same speed at 30, 60 and 120 FPS and wraps smoothly', () => {
  for (const fps of [30, 60, 120]) {
    const f = rotationFixture();
    for (let i = 0; i < fps * 10; i++) f.frame(1000 / fps);
    assert.ok(Math.abs(f.rotation.value - 360 * 10000 / 35000) < 0.00001);
    f.rotation.value = 359.9;
    f.frame(20);
    assert.ok(Math.abs(f.rotation.value - (359.9 + 20 * 360 / 35000) % 360) < 0.00001);
    f.cleanup();
  }
});

test('cover pauses at its current angle and resumes without a jump or catching up', () => {
  const f = rotationFixture();
  f.frame(40);
  const before = f.rotation.value;
  f.render(false);
  f.frame(40);
  assert.equal(f.rotation.value, before);
  f.render(true);
  f.frame(null);
  f.frame(5000);
  assert.equal(f.rotation.value, before);
  f.frame(40);
  assert.ok(Math.abs(f.rotation.value - before * 2) < 0.00001);
  f.appState('background');
  assert.equal(f.active(), false);
  f.appState('active');
  assert.equal(f.active(), true);
  f.cleanup();
  assert.equal(f.active(), false);
  assert.equal(f.removed(), true);
});

test('cover rotation respects reduced motion and initially paused playback', () => {
  for (const options of [{ reducedMotion: true }, { playing: false }]) {
    const f = rotationFixture(options);
    f.frame(40);
    assert.equal(f.rotation.value, 0);
    assert.equal(f.active(), false);
    f.appState('active');
    assert.equal(f.active(), false);
    f.cleanup();
  }
});

test('native add followed by reorder blocks the conflicting rewrite without changing playback', async () => {
  const f = musicQueueFixture();
  const before = clone(f.getCurrent());
  assert.equal(await f.context.addToQueue(queueTrack(B)), true);
  assert.equal(await f.context.syncReorderedQueue([A, C, B].map(queueTrack)), false);
  assert.deepEqual(queueUris(f), [A, C]);
  assert.deepEqual(f.getPlaylistUris(), []);
  assert.deepEqual(f.getCurrent(), before);
  assert.equal(f.calls.filter(c => c.method !== 'GET').length, 1);
  assert.equal(f.calls[0].endpoint, '/me/player/queue?uri=' + encodeURIComponent(B));
});

test('rapid queue additions send native commands in tap order', async () => {
  const f = musicQueueFixture();
  await Promise.all([f.context.addToQueue(queueTrack(B)), f.context.addToQueue(queueTrack(A))]);
  assert.deepEqual(f.getPlaylistUris(), []);
  assert.deepEqual(f.calls.map(c => c.endpoint), [B, A].map(uri => '/me/player/queue?uri=' + encodeURIComponent(uri)));
});

test('intentional repeated additions send one native command per tap', async () => {
  const f = musicQueueFixture();
  await f.context.addToQueue(queueTrack(B));
  await f.context.addToQueue(queueTrack(B));
  assert.deepEqual(f.calls.map(c => c.endpoint), [B, B].map(uri => '/me/player/queue?uri=' + encodeURIComponent(uri)));
  assert.equal(await f.context.syncReorderedQueue([A, B, C, B].map(queueTrack)), false);
  assert.deepEqual(f.getPlaylistUris(), []);
});

test('native additions while paused do not start playback and resume uses the existing context', async () => {
  const f = musicQueueFixture({ playing: false });
  await f.context.addToQueue(queueTrack(B));
  assert.equal(f.calls.length, 1);
  assert.equal(f.getCurrent().is_playing, false);
  await f.context.resume();
  assert.deepEqual(f.getPlaylistUris(), []);
  assert.deepEqual(clone(f.calls.find(c => c.endpoint.startsWith('/me/player/play')).body), {});
});

test('failed native queue command reports failure to the add button without replaying it', async () => {
  const f = musicQueueFixture({ playback: { request: ({ endpoint }) => {
    if (endpoint.includes('/queue?')) throw Object.assign(new Error('Spotify is rate limited'), { status: 429 });
  } } });
  f.getCurrent().shuffle_state = true;
  assert.equal(await f.context.addToQueue(queueTrack(B)), false);
  assert.equal(f.alerts.length, 1);
  assert.equal(f.calls.filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
});

test('invalid Spotify additions leave the existing queue and playback untouched', async () => {
  const f = musicQueueFixture();
  assert.equal(await f.context.addToQueue({ ...queueTrack(B), url: 'not-a-spotify-track' }), false);
  assert.deepEqual(f.queue().map(t => t.url), [A, C]);
  assert.equal(f.calls.length, 0);
});

test('local queue additions retain their existing behavior without Spotify requests', async () => {
  const local = { ...queueTrack(A), category: 'local', url: 'file:///song-a.mp3' };
  const added = { ...queueTrack(B), category: 'local', url: 'file:///song-b.mp3' };
  const f = musicQueueFixture({ active: local, queue: [local] });
  assert.equal(await f.context.addToQueue(added), true);
  assert.deepEqual(Array.from(f.queue(), t => t.url), [local.url, added.url]);
  assert.equal(f.calls.length, 0);
});

test('custom queue edits without native additions still update the managed playlist in place', async () => {
  const f = musicQueueFixture();
  await f.context.syncReorderedQueue([A, B, C].map(queueTrack));
  const start = f.calls.length;
  const before = clone(f.getCurrent());
  await f.context.syncReorderedQueue([A, B, B, C].map(queueTrack));
  await f.context.syncReorderedQueue([A, B, C, B].map(queueTrack));
  assert.deepEqual(f.getPlaylistUris(), [A, B, C, B]);
  assert.deepEqual(f.getCurrent(), before);
  const edits = f.calls.slice(start);
  assert.equal(edits.filter(c => c.method !== 'GET' && c.endpoint.startsWith('/me/player/') && !c.endpoint.includes('/shuffle')).length, 0);
  assert.deepEqual(edits.filter(c => c.endpoint.endsWith('/items')).map(c => clone(c.body)), [
    { uris: [B], position: 2 },
    { range_start: 3, insert_before: 2, range_length: 1, snapshot_id: 'snapshot-2' },
  ]);
});

test('editing after native track advance preserves the already-played playlist prefix', async () => {
  const f = fixture();
  await f.controller.play('user', [A, B, C]);
  f.setCurrent({ ...state(B), context: { uri: 'spotify:playlist:queue-user' } });
  const start = f.calls.length;
  await f.controller.updateQueue('user', [B, A, C], 1000);
  assert.deepEqual(f.getPlaylistUris(), [A, B, A, C]);
  assert.equal(f.getCurrent().item.uri, B);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.deepEqual(clone(f.calls.slice(start).find(c => c.endpoint.endsWith('/items')).body), { uris: [A], position: 2 });
});

test('an unchanged queue causes no playlist write or player restart', async () => {
  const f = fixture();
  await f.controller.play('user', [A, B, C]);
  const start = f.calls.length;
  await f.controller.updateQueue('user', [A, B, C], 1000);
  assert.equal(f.calls.slice(start).filter(c => c.method !== 'GET').length, 0);
});

test('native additions preserve shuffle without extra playback reads or playlist writes', async () => {
  const f = musicQueueFixture();
  f.getCurrent().shuffle_state = true;
  await f.context.addToQueue(queueTrack(B));
  const start = f.calls.length;
  await f.context.addToQueue(queueTrack(C));
  const edits = f.calls.slice(start);
  assert.equal(edits.filter(c => c.endpoint.includes('/shuffle')).length, 0);
  assert.equal(edits.filter(c => c.endpoint === '/me/player').length, 0);
  assert.equal(f.getCurrent().shuffle_state, true);
  assert.deepEqual(f.getPlaylistUris(), []);
});

for (const shuffle of [true, undefined]) {
  test(`queue edits disable shuffle when the live shuffle state is ${shuffle}`, async () => {
    const f = fixture();
    await f.controller.play('user', [A, C]);
    f.getCurrent().shuffle_state = shuffle;
    const start = f.calls.length;
    await f.controller.updateQueue('user', [A, B, C]);
    const edits = f.calls.slice(start);
    const shuffleIndex = edits.findIndex(c => c.endpoint.includes('/shuffle'));
    const writeIndex = edits.findIndex(c => c.endpoint.endsWith('/items'));
    assert.ok(shuffleIndex >= 0 && shuffleIndex < writeIndex);
    assert.equal(edits[shuffleIndex].endpoint, '/me/player/shuffle?state=false&device_id=android-device');
    assert.equal(edits.filter(c => c.endpoint.includes('/shuffle')).length, 1);
    assert.equal(f.getCurrent().shuffle_state, false);
    assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  });
}

test('a newer pause while disabling shuffle prevents playlist writes and restarts', async () => {
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint.includes('/shuffle')) {
      entered();
      return new Promise(resolve => { release = () => resolve(null); });
    }
  } });
  await f.controller.play('user', [A, C]);
  f.getCurrent().shuffle_state = true;
  const start = f.calls.length;
  const edit = f.controller.updateQueue('user', [A, B, C]);
  await waiting;
  const pause = f.controller.command('user', '/me/player/pause');
  release();
  await Promise.all([edit, pause]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items')).length, 0);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.equal(f.getCurrent().is_playing, false);
});

test('a device with stale queue contents uses one context fallback at its live position', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player/queue') return { currently_playing: { uri: A }, queue: [{ uri: C }] };
  } });
  await f.controller.play('user', [A, C]);
  f.getCurrent().progress_ms = 55000;
  const start = f.calls.length;
  await f.controller.updateQueue('user', [A, B, C], 1000);
  const restarts = f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play'));
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].body.position_ms, 55000);
  assert.equal(restarts[0].body.context_uri, 'spotify:playlist:queue-user');
  assert.equal(restarts[0].body.uris, undefined);
  assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  assert.deepEqual(f.fallbacks, ['device-queue-stale']);
  assert.deepEqual(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items')).map(c => clone(c.body)), [
    { uris: [B], position: 1 },
  ]); // No second playlist replacement after the insertion succeeded.
});

test('a slow Connect queue can catch up without restarting the song or retrying the insertion', async () => {
  let queueReads = 0;
  const waits = [];
  const f = fixture({
    delay: async ms => { waits.push(ms); },
    request: ({ endpoint }) => {
      if (endpoint === '/me/player/queue' && ++queueReads < 3) {
        return { currently_playing: { uri: A }, queue: [{ uri: C }] };
      }
    },
  });
  await f.controller.play('user', [A, C]);
  const start = f.calls.length;
  waits.length = 0;
  const before = clone(f.getCurrent());
  await f.controller.updateQueue('user', [A, B, C]);
  assert.equal(queueReads, 3);
  assert.deepEqual(waits, [300, 700, 2000]);
  assert.deepEqual(f.getCurrent(), before);
  assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items')).length, 1);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.deepEqual(f.fallbacks, []);
});

test('a necessary context refresh preserves the played prefix and uses the active playlist row', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player/queue') return { currently_playing: { uri: B }, queue: [{ uri: C }] };
  } });
  await f.controller.play('user', [A, B, C]);
  f.setCurrent({ ...state(B), progress_ms: 58000, context: { uri: 'spotify:playlist:queue-user' } });
  const start = f.calls.length;
  await f.controller.updateQueue('user', [B, A, C], 1000);
  assert.deepEqual(f.getPlaylistUris(), [A, B, A, C]);
  const commands = f.calls.slice(start);
  const restart = commands.filter(c => c.endpoint.startsWith('/me/player/play'));
  assert.equal(restart.length, 1);
  assert.deepEqual(clone(restart[0].body), {
    context_uri: 'spotify:playlist:queue-user', offset: { position: 1 }, position_ms: 58000,
  });
  assert.equal(commands.filter(c => c.endpoint.endsWith('/items')).length, 1);
  assert.equal(f.getCurrent().item.uri, B);
});

test('reopening the app restores a validated managed queue without replaying the current song', async () => {
  const f = fixture();
  await f.controller.play('user', [A, C]);
  const reopened = createSpotifyPlaybackController(f.deps);
  const start = f.calls.length;
  const before = clone(f.getCurrent());
  await reopened.updateQueue('user', [A, B, C]);
  assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  assert.deepEqual(f.getCurrent(), before);
  const edits = f.calls.slice(start);
  assert.equal(edits.filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.deepEqual(edits.filter(c => c.endpoint.endsWith('/items')).map(c => clone(c.body)), [
    { uris: [B], position: 1 },
  ]);
  assert.equal(edits.filter(c => c.method === 'GET').length, 4); // State, owner, snapshot, queue; no catalog scan.
});

test('an external playlist edit during settling prevents a restart at an obsolete row', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player/queue') return { currently_playing: { uri: A }, queue: [{ uri: C }] };
    if (endpoint.endsWith('?fields=snapshot_id')) return { snapshot_id: 'external-edit' };
  } });
  await f.controller.play('user', [A, C]);
  const start = f.calls.length;
  await assert.rejects(f.controller.updateQueue('user', [A, B, C]), /playlist changed/);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.equal(f.getCurrent().is_playing, true);
});

test('a restored queue with an outdated snapshot is never used for a positional insertion', async () => {
  const f = fixture();
  await f.controller.play('user', [A, C]);
  const reopened = createSpotifyPlaybackController({
    ...f.deps,
    loadQueueState: async (...args) => ({ ...await f.deps.loadQueueState(...args), snapshotId: 'old-snapshot' }),
  });
  const start = f.calls.length;
  await reopened.updateQueue('user', [A, B, C]);
  const writes = f.calls.slice(start).filter(c => c.endpoint.endsWith('/items'));
  assert.equal(writes.length, 1);
  assert.deepEqual(clone(writes[0].body), { uris: [A, B, C] });
});

test('a restored queue belonging to another account cannot be edited using its cached positions', async () => {
  const f = fixture();
  await f.controller.play('user', [A, C]);
  const reopened = createSpotifyPlaybackController({
    ...f.deps,
    loadQueueState: async (...args) => ({ ...await f.deps.loadQueueState(...args), ownerId: 'another-user' }),
  });
  const start = f.calls.length;
  await reopened.updateQueue('user', [A, B, C]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items') && c.method === 'POST').length, 0);
});

test('failure to save the optional queue cache does not retry a successful insertion', async () => {
  const f = fixture();
  await f.controller.play('user', [A, C]);
  f.deps.saveQueueState = async () => { throw new Error('Storage unavailable'); };
  const start = f.calls.length;
  await f.controller.updateQueue('user', [A, B, C]);
  assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items')).length, 1);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
});

test('Pause interrupts the queue-settling delay immediately instead of waiting for its timer', async () => {
  let block = false;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ delay: () => {
    if (!block) return Promise.resolve();
    entered();
    return new Promise(() => {}); // Deliberately never release the timer.
  } });
  await f.controller.play('user', [A, C]);
  block = true;
  const start = f.calls.length;
  const editing = f.controller.updateQueue('user', [A, B, C]);
  await waiting;
  await f.controller.command('user', '/me/player/pause');
  await editing;
  assert.equal(f.getCurrent().is_playing, false);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
});

test('rapid additions replace pending verification and keep each requested occurrence exactly once', async () => {
  let block = false;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ delay: () => {
    if (!block) return Promise.resolve();
    block = false;
    entered();
    return new Promise(() => {});
  } });
  await f.controller.play('user', [A, C]);
  block = true;
  const start = f.calls.length;
  const first = f.controller.updateQueue('user', [A, B, C]);
  await waiting;
  const second = f.controller.updateQueue('user', [A, B, B, C]);
  await Promise.all([first, second]);
  assert.deepEqual(f.getPlaylistUris(), [A, B, B, C]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/queue') && c.method === 'POST').length, 0);
});

test('externally edited playlist snapshots cannot be used for positional edits', async () => {
  let changed = false;
  const f = fixture({ request: ({ endpoint }) => {
    if (changed && endpoint.includes('snapshot_id')) return { owner: { id: 'user' }, description: 'changed externally', snapshot_id: 'external' };
  } });
  await f.controller.play('user', [A, C]);
  changed = true;
  const start = f.calls.length;
  await f.controller.updateQueue('user', [A, B, C]);
  const writes = f.calls.slice(start).filter(c => c.endpoint.endsWith('/items'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'PUT');
  assert.deepEqual(clone(writes[0].body), { uris: [A, B, C] });
});

test('failed in-place insertion is not retried and does not restart music', async () => {
  let failInsert = false;
  const f = fixture({ request: ({ endpoint, method }) => {
    if (failInsert && endpoint.endsWith('/items') && method === 'POST') throw new Error('Rate limited');
  } });
  await f.controller.play('user', [A, C]);
  failInsert = true;
  const start = f.calls.length;
  await assert.rejects(f.controller.updateQueue('user', [A, B, C]), /Rate limited/);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.endsWith('/items')).length, 1);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.equal(f.getCurrent().is_playing, true);
});

test('queue editing still recovers when the managed playlist was deleted', async () => {
  let deleted = false;
  const f = fixture({ request: ({ endpoint }) => {
    if (deleted && endpoint.includes('?fields=')) throw Object.assign(new Error('Not found'), { status: 404 });
  } });
  await f.controller.play('user', [A, C]);
  deleted = true;
  await f.controller.updateQueue('user', [A, B, C]);
  assert.deepEqual(f.getPlaylistUris(), [A, B, C]);
  assert.equal(f.calls.filter(c => c.endpoint === '/me/playlists').length, 2);
  assert.equal(f.getCurrent().is_playing, true);
});

test('pausing during queue verification cancels fallback without restarting playback', async () => {
  let release;
  let entered;
  let block = false;
  const waiting = new Promise(resolve => { entered = resolve; });
  const f = fixture({ delay: () => block ? new Promise(resolve => { release = resolve; entered(); }) : Promise.resolve() });
  await f.controller.play('user', [A, C]);
  block = true;
  const start = f.calls.length;
  const editing = f.controller.updateQueue('user', [A, B, C]);
  await waiting;
  const pausing = f.controller.command('user', '/me/player/pause');
  release();
  await Promise.all([editing, pausing]);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
  assert.equal(f.getCurrent().is_playing, false);
});

test('a song changing during the edit is not rewound by fallback', async () => {
  const f = fixture({ request: ({ endpoint }) => {
    if (endpoint === '/me/player/queue') return { currently_playing: { uri: B }, queue: [{ uri: C }] };
  } });
  await f.controller.play('user', [A, C]);
  const start = f.calls.length;
  await assert.rejects(f.controller.updateQueue('user', [A, B, C]), /changed songs/);
  assert.equal(f.calls.slice(start).filter(c => c.endpoint.startsWith('/me/player/play')).length, 0);
});

function serviceWithFetch(fetch, timeoutMs, files = new Map()) {
  const network = loadTS('src/services/spotifyNetwork.ts', { fetch });
  return loadTS('src/services/spotify.ts', { fetch, console: { warn() {}, log() {} }, require: name => {
    if (name === './spotifyNetwork') return { fetchWithDeadline: (url, options, consume) => network.fetchWithDeadline(url, options, consume, timeoutMs) };
    if (name === 'expo-auth-session') return { makeRedirectUri: () => 'moodmap://spotify-callback' };
    if (name === 'expo-web-browser') return { maybeCompleteAuthSession() {} };
    if (name === 'expo-file-system') return { File: class {
      constructor(_root, filename) { this.filename = filename; }
      get exists() { return files.has(this.filename); }
      async text() { return files.get(this.filename); }
      write(text) { files.set(this.filename, text); }
    }, Paths: { document: '/mock' } };
    if (name === './spotifyPlayback') return { createSpotifyPlaybackController, normalizePlaybackUris };
    if (name === './spotifyRequests') return { createSpotifyReadCoordinator };
    if (name === './spotifyNativeQueue') return nativeQueueModule;
    throw new Error('Unexpected import: ' + name);
  } });
}

test('service native additions persist protection and block both URI playback and managed rewrites', async () => {
  const calls = [];
  const files = new Map();
  let data = remoteQueue(A, [B, C]);
  const fetch = async (url, options) => {
    calls.push([url.replace('https://api.spotify.com/v1', ''), options.method]);
    const body = url.endsWith('/me') ? { id: 'user' } : data;
    return { status: options.method === 'GET' ? 200 : 204, ok: true, text: async () => JSON.stringify(body) };
  };
  const service = serviceWithFetch(fetch, undefined, files);
  await service.addToQueue('token', B, A);
  assert.deepEqual(calls, [['/me', 'GET'], ['/me/player/queue?uri=' + encodeURIComponent(B), 'POST']]);
  assert.equal(await service.hasPendingNativeQueue('token'), true);
  await assert.rejects(service.play('token', [A, B, C]), /Reordering/);
  await assert.rejects(service.updatePlaybackQueue('token', [A, C, B]), /Reordering/);
  const restarted = serviceWithFetch(fetch, undefined, files);
  assert.equal(await restarted.hasPendingNativeQueue('token'), true);
  await restarted.getQueue('token');
  data = remoteQueue(B, [C]);
  await restarted.getQueue('token');
  assert.equal(await restarted.hasPendingNativeQueue('token'), true);
  data = remoteQueue(C, []);
  await restarted.getQueue('token');
  assert.equal(await restarted.hasPendingNativeQueue('token'), false);
  assert.equal(calls.filter(([, method]) => method !== 'GET').length, 1);
});

for (const status of [401, 403, 404, 429]) {
  test(`rejected native additions (${status}) release protection and are never retried`, async () => {
    let posts = 0;
    const service = serviceWithFetch(async (url, options) => {
      if (url.endsWith('/me')) return { status: 200, ok: true, text: async () => JSON.stringify({ id: 'user' }) };
      if (options.method === 'POST') posts++;
      return { status, ok: false, headers: { get: () => '1' }, text: async () => '{}' };
    });
    await assert.rejects(service.addToQueue('token', B, A));
    assert.equal(await service.hasPendingNativeQueue('token'), false);
    assert.equal(posts, 1);
  });
}

test('a timed-out native addition stays protected and is never automatically resent', async () => {
  let posts = 0;
  const service = serviceWithFetch(async url => {
    if (url.endsWith('/me')) return { status: 200, ok: true, text: async () => JSON.stringify({ id: 'user' }) };
    posts++;
    return new Promise(() => {});
  }, 10);
  await assert.rejects(service.addToQueue('token', B, A), /timed out/);
  assert.equal(await service.hasPendingNativeQueue('token'), true);
  await assert.rejects(service.updatePlaybackQueue('token', [A, B]), /Reordering/);
  assert.equal(posts, 1);
});

test('post-add queue confirmation does not reuse an in-flight pre-add response', async () => {
  let finish;
  let reads = 0;
  const service = serviceWithFetch(async url => {
    if (url.endsWith('/me')) return { status: 200, ok: true, text: async () => JSON.stringify({ id: 'user' }) };
    if (url.endsWith('/me/player/queue')) {
      if (++reads === 1) return new Promise(resolve => { finish = () => resolve({ status: 200, ok: true, text: async () => JSON.stringify(remoteQueue(A, [C])) }); });
      return { status: 200, ok: true, text: async () => JSON.stringify(remoteQueue(A, [B, C])) };
    }
    return { status: 204, ok: true };
  });
  const old = service.getQueue('token');
  await flushQueueRead();
  await service.addToQueue('token', B, A);
  const current = await service.getQueue('token');
  assert.equal(current.queue[0].uri, B);
  finish();
  await old;
  assert.equal(await service.hasPendingNativeQueue('token'), true);
  assert.equal(reads, 2);
});

test('a pending provider read cannot swallow the refresh requested after an addition', async () => {
  let finish;
  let reads = 0;
  const f = musicQueueFixture({ playback: { request: ({ endpoint }) => {
    if (endpoint !== '/me/player/queue') return;
    if (++reads === 1) return new Promise(resolve => { finish = resolve; });
    return remoteQueue(A, [B, C]);
  } } });
  const old = f.context.refreshSpotifyQueue();
  await flushQueueRead();
  await f.context.addToQueue(queueTrack(B));
  await f.context.refreshSpotifyQueue();
  finish(remoteQueue(A, [C]));
  await old;
  await flushQueueRead();
  assert.equal(reads, 2);
  assert.deepEqual(queueUris(f), [A, B, C]);
});

test('a newer pause cancels custom playback still waiting for its native-queue check', async () => {
  const calls = [];
  const service = serviceWithFetch(async url => {
    calls.push(url);
    return { status: 204, ok: true };
  });
  const playing = service.play('token', [A, B]);
  const pausing = service.pause('token');
  await Promise.all([playing, pausing]);
  assert.deepEqual(calls, ['https://api.spotify.com/v1/me/player/pause']);
});

test('service distinguishes 204 success from 401/403/404/429 command failures', async () => {
  for (const status of [204, 401, 403, 404, 429]) {
    const service = serviceWithFetch(async () => ({ status, ok: status < 400,
      headers: { get: () => '120' }, text: async () => JSON.stringify({ error: { message: 'Player command failed' } }) }));
    if (status === 204) await service.pause('token');
    else await assert.rejects(service.pause('token'));
  }
});

test('service honors the complete Retry-After and reports cooldown failures', async () => {
  let requests = 0;
  const service = serviceWithFetch(async () => {
    requests++;
    return { status: 429, ok: false, headers: { get: () => '120' } };
  });
  await assert.rejects(service.pause('token'), /120 seconds/);
  await assert.rejects(service.pause('token'), /rate limited/);
  assert.equal(requests, 1);
});

test('network failures propagate from playback commands', async () => {
  const service = serviceWithFetch(async () => { throw new Error('Network disconnected'); });
  await assert.rejects(service.pause('token'), /Network disconnected/);
});

test('request deadline aborts lost connections even when fetch never settles', async () => {
  let signal;
  const { fetchWithDeadline } = loadTS('src/services/spotifyNetwork.ts', { fetch: (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } });
  await assert.rejects(fetchWithDeadline('https://api.spotify.com/v1/me', {}, async response => response.json(), 10), /connection timed out/);
  assert.equal(signal.aborted, true);
});

test('deadline includes a stalled response body and releases the next player request', async () => {
  let requests = 0;
  let signal;
  const service = serviceWithFetch(async (_url, options) => {
    requests++;
    signal = options.signal;
    return requests === 1
      ? { status: 503, ok: false, text: () => new Promise(() => {}) }
      : { status: 204, ok: true };
  }, 10);
  await assert.rejects(service.pause('user'), /connection timed out/);
  assert.equal(signal.aborted, true);
  assert.equal(requests, 1, 'A timed-out player mutation is never automatically replayed');
  await service.pause('user');
  assert.equal(requests, 2);
});

test('a timed-out response arriving late is not consumed or retried', async () => {
  let resolveFetch;
  let consumed = 0;
  const { fetchWithDeadline } = loadTS('src/services/spotifyNetwork.ts', { fetch: () => new Promise(resolve => { resolveFetch = resolve; }) });
  await assert.rejects(fetchWithDeadline('https://api.spotify.com/v1/me', {}, async () => { consumed++; }, 10), /timed out/);
  resolveFetch({ ok: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(consumed, 0);
});

test('read timeout releases deduplication lock and a later request recovers', async () => {
  let count = 0;
  const service = serviceWithFetch(async () => {
    count++;
    return { status: 200, ok: true, text: () => count === 1 ? new Promise(() => {}) : Promise.resolve(JSON.stringify({ is_playing: false, progress_ms: 0, item: null })) };
  }, 10);
  await assert.rejects(service.getCurrentlyPlaying('user', true), /timed out/);
  const current = await service.getCurrentlyPlaying('user', true);
  assert.equal(current.is_playing, false);
  assert.equal(count, 2);
});

test('Spotify playback ignores malformed data before it reaches native progress UI', async () => {
  const item = { id: 'A'.repeat(22), uri: A, name: 'Song', duration_ms: 180000, artists: [{ name: 'Artist' }], album: { images: [] } };
  for (const payload of [
    {}, { is_playing: 'true', progress_ms: 0, item },
    { is_playing: true, progress_ms: 'bad', item },
    { is_playing: true, progress_ms: -1, item },
    { is_playing: true, progress_ms: 0, item: { ...item, duration_ms: null } },
    { is_playing: true, progress_ms: 0, item: { ...item, artists: [null] } },
    { is_playing: true, progress_ms: 0, item: { ...item, album: null } },
  ]) {
    const service = serviceWithFetch(async () => ({ status: 200, ok: true, text: async () => JSON.stringify(payload) }));
    assert.equal(await service.getCurrentlyPlaying('user'), null);
    await assert.rejects(service.getCurrentlyPlaying('user', true), /incomplete playback information/);
  }
  const service = serviceWithFetch(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ is_playing: true, progress_ms: null, item }) }));
  assert.equal((await service.getCurrentlyPlaying('user', true)).progress_ms, 0);
  assert.equal(service.getBestImage([null, { url: 'cover', width: 300 }]), 'cover');
  assert.equal(service.getBestImage({ length: 1 }), null);
});

test('network and proxy failures during token refresh do not revoke a connected account', async () => {
  const scenarios = [
    async () => { throw new Error('Network request failed'); },
    async () => ({ status: 502, ok: false }),
    async () => ({ status: 400, ok: false, json: async () => { throw new Error('HTML response'); } }),
    async () => ({ status: 401, ok: false, json: async () => ({ error: 'invalid_client' }) }),
    async () => ({ status: 200, ok: true, json: async () => ({}) }),
    async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) }),
  ];
  for (const fetch of scenarios) {
    const service = serviceWithFetch(fetch, 10);
    const result = await service.refreshSpotifyToken('saved-refresh');
    assert.equal(result.tokens, null);
    assert.equal(result.isRevoked, false);
    const f = tierFixture(() => service.refreshSpotifyToken('saved-refresh'));
    await f.store.setSpotifyTokens({ accessToken: 'expired', refreshToken: 'saved-refresh', expiresAt: 0 });
    assert.equal(await f.store.getValidAccessToken(), null);
    assert.equal(f.store.spotifyConnected, true);
    assert.equal(f.store.spotifyTokens.refreshToken, 'saved-refresh');
    assert.equal(f.stored.get('moodmap_spotify_refresh'), 'saved-refresh');
  }
});

test('only explicit invalid_grant revokes saved Spotify credentials', async () => {
  const service = serviceWithFetch(async () => ({ status: 400, ok: false, json: async () => ({ error: 'invalid_grant' }) }));
  const f = tierFixture(() => service.refreshSpotifyToken('saved-refresh'));
  await f.store.setSpotifyTokens({ accessToken: 'expired', refreshToken: 'saved-refresh', expiresAt: 0 });
  assert.equal(await f.store.getValidAccessToken(), null);
  assert.equal(f.store.spotifyConnected, false);
  assert.equal(f.stored.size, 0);
});

test('a still-valid token remains usable if proactive refresh loses connection', async () => {
  let requests = 0;
  const f = tierFixture(async () => { requests++; return { tokens: null, isRevoked: false }; });
  await f.store.setSpotifyTokens({ accessToken: 'still-valid', refreshToken: 'saved-refresh', expiresAt: Date.now() + 40000 });
  assert.equal(await f.store.getValidAccessToken(), 'still-valid');
  assert.equal(await f.store.getValidAccessToken(), 'still-valid');
  assert.equal(requests, 1);
});

test('token refresh resumes normally after the connection returns and cooldown expires', async () => {
  let online = false;
  let clock = 1000;
  const f = tierFixture(async () => online
    ? { tokens: { accessToken: 'new', refreshToken: 'saved-refresh', expiresAt: clock + 3600000 } }
    : { tokens: null, isRevoked: false }, undefined, { Date: { now: () => clock } });
  await f.store.setSpotifyTokens({ accessToken: 'old', refreshToken: 'saved-refresh', expiresAt: 0 });
  assert.equal(await f.store.getValidAccessToken(), null);
  online = true;
  clock += 31000;
  assert.equal(await f.store.getValidAccessToken(), 'new');
  assert.equal(f.store.spotifyConnected, true);
});

test('successful player commands do not require a JSON response body', async () => {
  for (const status of [200, 202, 204]) {
    let bodyReads = 0;
    const service = serviceWithFetch(async url => url.endsWith('/me')
      ? { status: 200, ok: true, text: async () => JSON.stringify({ id: 'user' }) }
      : { status, ok: true, text: async () => { bodyReads++; return 'OK'; } });
    await service.pause('token');
    await service.play('token');
    await service.nextTrack('token');
    await service.previousTrack('token');
    await service.seekToPosition('token', 12000);
    await service.setShuffle('token', false);
    await service.setRepeat('token', 'off');
    await service.addToQueue('token', A);
    assert.equal(bodyReads, 0);
  }
});

test('queue reorder proceeds past a text shuffle acknowledgment and preserves order and position', async () => {
  let current = state(A);
  let sentQueue;
  let sentPosition;
  const calls = [];
  const service = serviceWithFetch(async (url, options) => {
    const endpoint = url.replace('https://api.spotify.com/v1', '');
    calls.push(endpoint);
    if (options.method === 'GET') {
      assert.equal(endpoint, '/me/player');
      return { status: 200, ok: true, text: async () => JSON.stringify(current) };
    }
    if (endpoint.startsWith('/me/player/play')) {
      const body = JSON.parse(options.body);
      sentQueue = body.uris;
      sentPosition = body.position_ms;
      current = state(body.uris[0]);
    }
    return { status: 200, ok: true, text: async () => 'OK' };
  });
  // The same awaited sequence used by MusicContext.syncReorderedQueue.
  await service.setShuffle('token', false);
  await service.play('token', [A, C, B], 42123);
  assert.deepEqual(sentQueue, [A, C, B]);
  assert.equal(sentPosition, 42123);
  assert.equal(calls[0], '/me/player/shuffle?state=false');
  assert.equal(calls.filter(endpoint => endpoint === '/me/player').length, 2);
});

test('malformed playback-state JSON still fails verification instead of triggering recovery', async () => {
  const service = serviceWithFetch(async () => ({ status: 200, ok: true, text: async () => 'not JSON' }));
  await assert.rejects(service.play('token', [A]), /unreadable response/);
});

test('identical catalog reads share a request, cache results, and isolate tokens', async () => {
  let clock = 1;
  let calls = 0;
  const reads = createSpotifyReadCoordinator(() => clock, async ms => { clock += ms; });
  const load = async () => { calls++; return [A]; };
  await Promise.all(Array.from({ length: 8 }, () => reads.read('alice', '/search?q=test', load)));
  await reads.read('alice', '/search?q=test', load);
  assert.equal(calls, 1);
  await reads.read('bob', '/search?q=test', load);
  assert.equal(calls, 2);
  clock += 120001;
  await reads.read('alice', '/search?q=test', load);
  assert.equal(calls, 3);
});

test('catalog reads are paced but player reads bypass the catalog backlog', async () => {
  let release;
  const reads = createSpotifyReadCoordinator(() => 1, async () => {});
  const slow = reads.read('user', '/search?q=slow', () => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  const state = await reads.read('user', '/me/player', async () => 'fresh');
  assert.equal(state, 'fresh');
  release([]);
  await slow;
  let calls = 0;
  await reads.read('user', '/me/player', async () => ++calls);
  await reads.read('user', '/me/player', async () => ++calls);
  assert.equal(calls, 2);
});

test('recent history is briefly cached while distinct catalog requests remain spaced', async () => {
  let clock = 1000;
  const started = [];
  const reads = createSpotifyReadCoordinator(() => clock, async ms => { clock += ms; });
  const load = async () => { started.push(clock); return [A]; };
  await reads.read('user', '/me/player/recently-played?limit=20', load);
  await reads.read('user', '/me/player/recently-played?limit=20', load);
  await reads.read('user', '/search?q=other', load);
  assert.deepEqual(started, [1000, 1300]);
  clock += 15000;
  await reads.read('user', '/me/player/recently-played?limit=20', load);
  assert.equal(started.length, 3);
});

test('a playlist write invalidates both cached and in-flight pre-write reads', async () => {
  let release;
  const reads = createSpotifyReadCoordinator(() => 1, async () => {});
  const beforeWrite = reads.read('user', '/me/playlists', () => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  reads.invalidate();
  const afterWrite = reads.read('user', '/me/playlists', async () => [B]);
  release([A]);
  assert.deepEqual(await beforeWrite, [A]);
  assert.deepEqual(await afterWrite, [B]);
  assert.deepEqual(await reads.read('user', '/me/playlists', async () => assert.fail('must use fresh cache')), [B]);
});

test('disconnect cancels queued reads and prevents stale cache repopulation', async () => {
  let release;
  let queuedCalls = 0;
  const reads = createSpotifyReadCoordinator(() => 1, async () => {});
  const slow = reads.read('user', '/search?q=slow', () => new Promise(resolve => { release = resolve; }));
  const queued = reads.read('user', '/search?q=queued', async () => ++queuedCalls);
  await new Promise(resolve => setImmediate(resolve));
  reads.clear();
  release([A]);
  assert.equal(await slow, null);
  assert.equal(await queued, null);
  assert.equal(queuedCalls, 0);
});

test('a search 429 stops player and playlist requests for the full cooldown', async () => {
  let calls = 0;
  const service = serviceWithFetch(async () => {
    calls++;
    return { status: 429, ok: false, headers: { get: () => '120' } };
  });
  await service.searchTracks('user', 'test');
  await assert.rejects(service.pause('user'), /rate limited/);
  assert.equal(await service.createPlaylist('user', 'id', 'Test'), null);
  const added = await service.addTracksToPlaylist('user', 'P'.repeat(22), [A]);
  assert.equal(added.success, false);
  assert.equal(added.statusCode, 429);
  service.clearSpotifyRequestCache();
  await assert.rejects(service.play('user'), /rate limited/);
  assert.equal(calls, 1);
});

test('playlist creation uses one current endpoint without blind POST retries', async () => {
  const paths = [];
  const service = serviceWithFetch(async url => {
    paths.push(url);
    return { status: 503, ok: false, text: async () => 'Unavailable' };
  });
  assert.equal(await service.createPlaylist('user', 'legacy-user-id', 'Test'), null);
  assert.deepEqual(paths, ['https://api.spotify.com/v1/me/playlists']);
});

test('shared polling uses one request for eight consumers and stops in the background', async () => {
  let clock = 10000;
  let id = 0;
  const timers = new Map();
  let loads = 0;
  const { createSpotifyPoller } = loadTS('src/services/spotifyPolling.ts', {
    Date: { now: () => clock },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: timer => timers.delete(timer),
  });
  const poller = createSpotifyPoller(async () => { loads++; return state(A); });
  let deliveries = 0;
  const unsubscribe = Array.from({ length: 8 }, () => poller.subscribe(() => { deliveries++; }, 5000));
  await poller.refresh();
  assert.equal(loads, 1);
  assert.equal(deliveries, 8);
  assert.equal(timers.size, 1);
  clock += 5000;
  await poller.refresh();
  assert.equal(loads, 2);
  poller.setForeground(false);
  assert.equal(timers.size, 0);
  clock += 5000;
  await poller.refresh();
  assert.equal(loads, 2);
  poller.setForeground(true);
  await poller.refresh();
  assert.equal(loads, 3);
  unsubscribe.forEach(stop => stop());
  assert.equal(timers.size, 0);
});

test('polling backs off during outages, retains its last delivery, and recovers at normal cadence', async () => {
  let clock = 10000;
  let id = 0;
  let requests = 0;
  let offline = false;
  const timers = new Map();
  const received = [];
  const { createSpotifyPoller } = loadTS('src/services/spotifyPolling.ts', {
    Date: { now: () => clock }, console: { warn() {} },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: timer => timers.delete(timer),
  });
  const poller = createSpotifyPoller(() => {
    requests++;
    if (offline) throw new Error('Network lost');
    return Promise.resolve(state(A));
  });
  const stop = poller.subscribe(value => received.push(value), 5000);
  await poller.refresh();
  assert.equal(received.length, 1);
  offline = true;
  clock += 5000;
  for (const delay of [5000, 10000, 20000, 30000, 30000]) {
    await poller.refresh();
    assert.equal([...timers.values()][0].ms, delay);
    const before = requests;
    await Promise.all(Array.from({ length: 8 }, () => poller.refresh()));
    assert.equal(requests, before);
    assert.equal(received.length, 1);
    assert.equal(timers.size, 1);
    clock += delay;
  }
  poller.setForeground(false);
  assert.equal(timers.size, 0);
  await poller.refresh();
  offline = false;
  poller.setForeground(true);
  await poller.refresh();
  assert.equal(received.length, 2);
  assert.equal([...timers.values()][0].ms, 5000);
  stop();
  assert.equal(timers.size, 0);
});

test('one failing playback subscriber cannot stop delivery to other screens', async () => {
  const { createSpotifyPoller } = loadTS('src/services/spotifyPolling.ts', { console: { warn() {} } });
  const poller = createSpotifyPoller(async () => state(A));
  let delivered = 0;
  const stopBroken = poller.subscribe(() => { throw new Error('Bad subscriber'); }, 5000);
  const stopWorking = poller.subscribe(() => { delivered++; }, 5000);
  await poller.refresh();
  assert.equal(delivered, 1);
  stopBroken();
  stopWorking();
});

function tierFixture(refreshSpotifyToken, supabase, globals = {}) {
  const stored = new Map();
  let state;
  const { useTierStore } = loadTS('src/stores/tierStore.ts', { ...globals, require: name => {
    if (name === 'zustand') return { create: setup => {
      state = setup(update => Object.assign(state, update), () => state);
      return { getState: () => state };
    } };
    if (name === 'expo-secure-store') return {
      getItemAsync: async key => stored.get(key) ?? null,
      setItemAsync: async (key, value) => stored.set(key, value),
      deleteItemAsync: async key => stored.delete(key),
    };
    if (name === '../services/spotify') return { refreshSpotifyToken, cancelPendingPlayback() {}, clearSpotifyRequestCache() {} };
    if (name === '../lib/supabase') return { supabase };
    throw new Error('Unexpected module: ' + name);
  } });
  return { store: useTierStore.getState(), stored };
}

test('a token refresh completing after disconnect cannot reconnect the account', async () => {
  let release;
  const f = tierFixture(() => new Promise(resolve => { release = resolve; }));
  await f.store.setSpotifyTokens({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 });
  const refreshing = f.store.getValidAccessToken();
  await f.store.clearSpotifyTokens();
  release({ tokens: { accessToken: 'new', refreshToken: 'refresh-new', expiresAt: Date.now() + 3600000 } });
  assert.equal(await refreshing, null);
  assert.equal(f.store.spotifyConnected, false);
  assert.equal(f.stored.size, 0);
});

test('token persistence cannot race disconnect and leave saved credentials behind', async () => {
  const f = tierFixture(async () => ({ tokens: null }));
  const saving = f.store.setSpotifyTokens({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 });
  const clearing = f.store.clearSpotifyTokens();
  await Promise.all([saving, clearing]);
  assert.equal(f.stored.size, 0);
  assert.equal(f.store.spotifyConnected, false);
});

test('repeated callers do not hammer a failing token refresh endpoint', async () => {
  let calls = 0;
  const f = tierFixture(async () => { calls++; return { tokens: null, retryAfterMs: 120000 }; });
  await f.store.setSpotifyTokens({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 });
  await f.store.getValidAccessToken();
  await Promise.all(Array.from({ length: 8 }, () => f.store.getValidAccessToken()));
  assert.equal(calls, 1);
});

test('a late VIP approval cannot restore account state after sign-out', async () => {
  let release;
  const query = { select: () => query, eq: () => query, maybeSingle: () => new Promise(resolve => { release = resolve; }) };
  const f = tierFixture(async () => ({ tokens: null }), { from: () => query });
  const checking = f.store.checkVIPStatus('old-user');
  await f.store.deactivateVIP();
  release({ data: { status: 'approved', updated_at: '2026-10-23' }, error: null });
  await checking;
  assert.equal(f.store.isVIP, false);
  assert.equal(f.store.vipStatus, 'none');
  assert.equal(f.stored.size, 0);
});

test('VIP approval still persists normally in the current session', async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { status: 'approved', updated_at: '2026-10-23' }, error: null }) };
  const f = tierFixture(async () => ({ tokens: null }), { from: () => query });
  await f.store.checkVIPStatus('current-user');
  assert.equal(f.store.isVIP, true);
  assert.equal(f.store.vipStatus, 'approved');
  assert.equal(f.stored.get('moodmap_is_vip'), 'true');
});

test('cancelling a session also drops queued player commands with its old token', async () => {
  let release;
  const calls = [];
  const controller = createSpotifyPlaybackController({
    request: async (_, endpoint) => {
      calls.push(endpoint);
      if (endpoint.includes('shuffle')) await new Promise(resolve => { release = resolve; });
      return null;
    },
    loadPlaylist: async () => null, savePlaylist: async () => {}, delay: async () => {},
  });
  const active = controller.command('old-token', '/me/player/shuffle?state=false');
  await new Promise(resolve => setImmediate(resolve));
  const queued = controller.command('old-token', '/me/player/pause');
  controller.cancelPending();
  release();
  await Promise.all([active, queued]);
  assert.deepEqual(calls, ['/me/player/shuffle?state=false']);
});

test('avatar extension input cannot construct a path outside its intended filename', async () => {
  const { saveCustomAvatar } = loadTS('src/services/profileService.ts', { require: name => {
    if (name === 'expo-file-system') return { File: class {}, Paths: {} };
    if (name === 'expo-file-system/legacy' || name === 'expo-image-picker') return {};
    if (name === './settingsService') return {};
    throw new Error('Unexpected import: ' + name);
  } });
  for (const ext of ['.jpg/../../outside', '/../outside', '.html', '.exe']) {
    const result = await saveCustomAvatar('file:///photo.jpg', 'image/jpeg', ext);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Unsupported avatar extension.');
  }
});
