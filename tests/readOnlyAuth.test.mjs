import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { signInTeacher, signInReadOnly, signInWorkspace, signInClassroom, currentReadOnlySession, currentWorkspaceSession, clearReadOnlySession, saveReadOnlyClientId, TEACHER_SCOPES } from '../src/lib/readOnlyAuth.js';

const originalWindow = globalThis.window, originalStorage = globalThis.localStorage;
const originalClientId = process.env.NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID, originalNow = Date.now;
function setup({ manual = false, partial = false, lifetime = 3600 } = {}) {
  clearReadOnlySession();
  delete process.env.NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID;
  const storage = new Map([['gbaeum_readonly_client_id', 'test.apps.googleusercontent.com']]);
  const calls = [], writes = [];
  globalThis.localStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => { writes.push(key); storage.set(key, value); } };
  globalThis.window = { google: { accounts: { oauth2: {
    hasGrantedAllScopes: (response, ...scopes) => scopes.every((scope) => response.scope.split(' ').includes(scope)),
    initTokenClient: (config) => ({ requestAccessToken: (options) => {
      const respond = () => config.callback({ access_token: `test-token-${calls.length}`, expires_in: lifetime, scope: partial ? config.scope.split(' ').slice(0, -1).join(' ') : config.scope });
      calls.push({ config, options, respond }); if (!manual) respond();
    } }),
  } } } };
  return { calls, writes };
}
afterEach(() => {
  clearReadOnlySession(); Date.now = originalNow;
  globalThis.window = originalWindow; globalThis.localStorage = originalStorage;
  if (originalClientId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID;
  else process.env.NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID = originalClientId;
});

test('first teacher login grants every current feature scope and reuses the same token for all later actions', async () => {
  const { calls, writes } = setup();
  const login = await signInTeacher();
  assert.deepEqual(calls[0].config.scope.split(' '), TEACHER_SCOPES);
  assert.equal(currentReadOnlySession(), login); assert.equal(currentWorkspaceSession(), login);
  for (let index = 0; index < 3; index++) {
    assert.equal(await signInWorkspace(), login); assert.equal(await signInClassroom(), login);
  }
  assert.equal(calls.length, 1); assert.deepEqual(writes, []);
});

test('expired connection obtains a new token without forcing account selection or reusing the expired token', async () => {
  const { calls } = setup(); let now = 100000; Date.now = () => now;
  const first = await signInTeacher(); now += 3600000;
  assert.equal(currentWorkspaceSession(), null);
  const next = await signInClassroom();
  assert.notEqual(next.accessToken, first.accessToken); assert.equal(calls.length, 2);
  assert.equal(calls[1].options.prompt, ''); assert.equal(await signInWorkspace(), next);
});

test('a partial grant never enables classroom creation or monitoring', async () => {
  const { calls } = setup({ partial: true });
  await assert.rejects(signInTeacher(), /권한을 모두 허용/);
  assert.equal(calls.length, 1); assert.equal(currentWorkspaceSession(), null); assert.equal(currentReadOnlySession(), null);
});

test('logout rejects an outstanding OAuth response and cannot restore a stale account', async () => {
  const { calls } = setup({ manual: true });
  const pending = signInTeacher(); clearReadOnlySession(); calls[0].respond();
  await assert.rejects(pending, /연결이 변경/);
  assert.equal(currentWorkspaceSession(), null); assert.equal(currentReadOnlySession(), null);
});

test('explicit account selection replaces both sessions, and a changed client cannot reuse prior grants', async () => {
  const { calls } = setup();
  const old = await signInTeacher(), next = await signInTeacher();
  assert.notEqual(old.accessToken, next.accessToken); assert.equal(currentReadOnlySession(), next); assert.equal(currentWorkspaceSession(), next);
  saveReadOnlyClientId('other.apps.googleusercontent.com');
  assert.equal(currentWorkspaceSession(), null);
  await signInClassroom(); assert.equal(calls.length, 3); assert.equal(calls[2].config.client_id, 'other.apps.googleusercontent.com');
});

test('the separate read-only flow requests no write access and does not retain an earlier write session', async () => {
  const { calls } = setup(); await signInTeacher();
  const read = await signInReadOnly();
  assert.equal(read.scopes.length, 2); assert.ok(read.scopes.every((scope) => scope.endsWith('.readonly')));
  assert.equal(currentWorkspaceSession(), null); assert.equal(currentReadOnlySession(), read); assert.equal(calls.length, 2);
});
