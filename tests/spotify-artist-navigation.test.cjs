/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the screen's real handlers with controlled network timing, without native UI modules.
const source = fs.readFileSync(path.join(__dirname, '../src/app/music.tsx'), 'utf8');
const ast = ts.createSourceFile('music.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['handleArtistSelect', 'handleArtistProfileBack', 'handleInternalBack'];
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) {
    declarations.set(node.name.getText(ast), node.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.size, names.length);
const code = ts.transpileModule(
  names.map(name => `const ${declarations.get(name)};`).join('\n') + `\nmodule.exports = { ${names.join(', ')} };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const artist = letter => ({ id: letter.repeat(22), name: letter });
const A = artist('A');
const B = artist('B');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}, token = async () => 'token') {
  const state = { profile: null, tracks: [], albums: [], loading: false, refreshing: false };
  const cache = {};
  const services = {
    getArtistTopTracksResult: async () => ({ tracks: [{ id: 'song' }], isLatestFallback: false }),
    getArtistAlbums: async () => [{ id: 'album', release_date: '2026' }],
    getArtist: async (_, id) => ({ id, images: [{ url: 'https://example.com/art.jpg' }] }),
    searchArtists: async () => [],
    ...overrides,
  };
  const sandbox = {
    module: { exports: {} }, console,
    useCallback: fn => fn,
    artistProfileRequestRef: { current: 0 },
    artistProfileCacheRef: { current: cache },
    spotifyArtistCache: {}, ARTIST_PROFILE_TTL: 60000,
    SPOTIFY_ARTIST_CACHE_FILE: { write() {} },
    useTierStore: { getState: () => ({ getValidAccessToken: token }) },
    Haptics: { impactAsync() {}, notificationAsync() {}, ImpactFeedbackStyle: {}, NotificationFeedbackType: {} },
    require: () => services,
    isDeezerImage: () => false,
    isSpotifyId: id => /^[A-Za-z0-9]{22}$/.test(id),
    normalizeArtistKey: name => name.toLowerCase(),
    selectedAlbumDetail: null, selectedPlaylist: null, isSearchOpen: false,
    setSelectedArtistProfile: value => { state.profile = value; },
    setArtistProfileTopTracks: value => { state.tracks = value; },
    setArtistProfileAlbums: value => { state.albums = value; },
    setArtistProfileTrackHeading: value => { state.heading = value; },
    setLoadingArtistProfile: value => { state.loading = value; },
    setRefreshingArtistProfile: value => { state.refreshing = value; },
  };
  Object.defineProperty(sandbox, 'selectedArtistProfile', { get: () => state.profile });
  vm.runInNewContext(code, sandbox);
  return { ...sandbox.module.exports, state, cache };
}

test('a normal artist visit still loads its profile and catalog', async () => {
  const f = fixture();
  await f.handleArtistSelect(A);
  assert.equal(f.state.profile.id, A.id);
  assert.equal(f.state.tracks[0].id, 'song');
  assert.equal(f.state.albums[0].id, 'album');
  assert.equal(f.state.loading, false);
});

test('Back while waiting for credentials prevents subsequent profile requests', async () => {
  const pending = deferred();
  let calls = 0;
  const f = fixture({ getArtist: async () => { calls++; } }, () => pending.promise);
  const visit = f.handleArtistSelect(A);
  f.handleArtistProfileBack();
  pending.resolve('token');
  await visit;
  assert.equal(f.state.profile, null);
  assert.equal(f.state.loading, false);
  assert.equal(calls, 0);
});

for (const back of ['handleArtistProfileBack', 'handleInternalBack']) {
  test(`${back} prevents late catalog results from reopening the artist`, async () => {
    const pending = deferred();
    const f = fixture({ getArtist: () => pending.promise });
    const visit = f.handleArtistSelect(A);
    await tick();
    f[back]();
    const before = JSON.stringify(f.state);
    pending.resolve({ ...A, images: [{ url: 'late-art.jpg' }] });
    await visit;
    assert.equal(f.state.profile, null);
    assert.equal(JSON.stringify(f.state), before);
  });
}

test('an older visit cannot replace a newer artist or clear its loading state', async () => {
  const first = deferred();
  const second = deferred();
  const f = fixture({ getArtist: (_, id) => id === A.id ? first.promise : second.promise });
  const visitA = f.handleArtistSelect(A);
  await tick();
  const visitB = f.handleArtistSelect(B);
  await tick();
  first.resolve({ ...A, images: [{ url: 'a.jpg' }] });
  await visitA;
  assert.equal(f.state.profile.id, B.id);
  assert.equal(f.state.loading, true);
  second.resolve({ ...B, images: [{ url: 'b.jpg' }] });
  await visitB;
  assert.equal(f.state.profile.id, B.id);
  assert.equal(f.state.loading, false);
});

test('Back during artist-name resolution prevents reopening and follow-up requests', async () => {
  const pending = deferred();
  let trackCalls = 0;
  const f = fixture({
    getArtistTopTracksResult: async () => { trackCalls++; return { tracks: [] }; },
    getArtistAlbums: async () => [],
    getArtist: async () => null,
    searchArtists: () => pending.promise,
  });
  const visit = f.handleArtistSelect(A);
  await tick();
  f.handleArtistProfileBack();
  pending.resolve([B]);
  await visit;
  assert.equal(f.state.profile, null);
  assert.equal(trackCalls, 1);
});

test('Back also ignores a late fallback catalog when credentials are unavailable', async () => {
  const pending = deferred();
  const f = fixture({ getArtistTopTracksResult: () => pending.promise }, async () => null);
  const visit = f.handleArtistSelect(A);
  await tick();
  f.handleArtistProfileBack();
  pending.resolve({ tracks: [{ id: 'late-song' }], isLatestFallback: true });
  await visit;
  assert.equal(f.state.profile, null);
  assert.equal(f.state.tracks.length, 0);
});

test('a cached visit invalidates pending work and starts without a stale spinner', async () => {
  const pending = deferred();
  const f = fixture({ getArtist: () => pending.promise });
  f.cache[B.id] = { topTracks: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }], albums: [{ id: 'b-album' }], updatedAt: Date.now() };
  const visitA = f.handleArtistSelect(A);
  await tick();
  await f.handleArtistSelect(B);
  assert.equal(f.state.loading, false);
  pending.resolve({ ...A, images: [{ url: 'a.jpg' }] });
  await visitA;
  assert.equal(f.state.profile.id, B.id);
  assert.equal(f.state.tracks[0].id, 'b1');
});
