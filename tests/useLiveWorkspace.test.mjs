import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { act, createElement, StrictMode } from 'react';
import { foldWorkspace } from '../src/lib/liveWorkRecords.mjs';
import { pendingCommentActivity } from '../src/lib/workRecords.mjs';

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT, mode: process.env.NEXT_PUBLIC_APP_MODE };
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
delete process.env.NEXT_PUBLIC_APP_MODE;
const { createRoot } = await import('react-dom/client');
// Node does not resolve Next's @ alias. Load the actual JSX-free hook unchanged,
// replacing only its module paths with file URLs for these React lifecycle tests.
const require = createRequire(import.meta.url);
const source = (await readFile(new URL('../src/components/useLiveWorkspace.js', import.meta.url), 'utf8'))
  .replace(/from '@\/lib\/([^']+)'/g, (_, file) => `from '${new URL(`../src/lib/${file}`, import.meta.url).href}'`)
  .replace("from 'react'", `from '${pathToFileURL(require.resolve('react')).href}'`);
const { default: useLiveWorkspace } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
after(() => {
  dom.window.close(); globalThis.window = previous.window; globalThis.document = previous.document; globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  if (previous.mode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE; else process.env.NEXT_PUBLIC_APP_MODE = previous.mode;
});

const control = (id, type, payload, studentId = '') => ({ id, type, studentId, payload, createdAt: '2026-10-12T00:00:00Z' });
function fixture(t, { events = [], waitForSetup = null, failSetup = false, twoStudents = false, newAssignment = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-12T01:00:00Z') });
  const data = { assignment: { id: 'test-assignment', ...(newAssignment ? { creationId: 'new-assignment-job' } : {}), templateBaseline: { chars: 120, images: 1 } }, keywords: [], students: [
    { id: 'a', slideId: 'a', number: 1, name: '테스트A', records: [], chars: 0, images: 0, slides: 1 },
    ...(twoStudents ? [{ id: 'b', slideId: 'b', number: 4, name: '테스트B', records: [], chars: 0, images: 0, slides: 1 }] : []),
  ] };
  const saved = { events: structuredClone(events), storeId: 'test-private-store', invalidRows: [] };
  const audit = { authorization: [], setups: 0, reads: [], comments: 0, commentThreads: [], posts: [], chars: 120, failSetup, failReads: false };
  const api = {
    initialize: async () => { audit.setups++; if (waitForSetup) await waitForSetup; return structuredClone(saved); },
    append: async (items, { shouldInclude = () => true } = {}) => {
      const state = foldWorkspace(saved.events);
      saved.events.push(...items.filter((item) => shouldInclude(item) && (item.type !== 'snapshot' || (!state.settings.monitoringEnded && !state.collectionPaused[item.studentId]))));
      return structuredClone(saved);
    },
    feedback: async (slideId, content, commentId) => {
      audit.posts.push({ slideId, content, commentId });
      return { id: 'teacher-reply', content, createdTime: new Date().toISOString(), author: { permissionId: 'teacher' } };
    },
  };
  const callbacks = {
    authorize: async (options) => { audit.authorization.push(options); if (audit.failSetup) throw new Error('연결 만료'); return api; },
    loadWorkspace: async () => structuredClone(saved),
    loadPresentation: async (id) => {
      audit.reads.push(id);
      if (audit.failReads) throw new Error('접근할 수 없음');
      return { checkedAt: new Date().toISOString(), charCount: audit.chars, imageCount: 1, slideCount: 1, pages: [{ id: 'page', number: 1, chars: audit.chars, images: 1, text: '가'.repeat(audit.chars), notes: '' }] };
    },
    loadComments: async () => { audit.comments++; return structuredClone(audit.commentThreads); },
  };
  let current, root;
  const container = document.createElement('div'); document.body.append(container);
  function Harness() { current = useLiveWorkspace(data, callbacks); return null; }
  const mount = async () => { root = createRoot(container); await act(async () => { root.render(createElement(StrictMode, null, createElement(Harness))); }); };
  const unmount = async () => { if (root) { await act(async () => root.unmount()); root = null; } };
  t.after(async () => { await unmount(); container.remove(); });
  return { audit, saved, mount, unmount, current: () => current, tick: async (ms) => { await act(async () => { t.mock.timers.tick(ms); }); } };
}

test('opening a new assignment initializes once, checks immediately and records an edit on the next automatic cycle', async (t) => {
  const f = fixture(t); await f.mount();
  assert.equal(f.audit.setups, 1); assert.equal(f.audit.authorization.length, 1); assert.equal(f.audit.authorization[0].interactive, false);
  assert.equal(f.current().enabled, true); assert.equal(f.current().running, true); assert.deepEqual(f.audit.reads, ['a']);
  assert.equal(f.current().students[0].records[0].source, 'first_snapshot');
  f.audit.chars += 20; await f.tick(30000);
  assert.equal(f.current().students[0].records.at(-1).charDelta, 20);
  assert.equal(f.current().students[0].records.at(-1).source, 'continuous_poll');
  assert.equal(f.audit.authorization.length, 1);
  await f.unmount(); await f.tick(120000); assert.equal(f.audit.reads.length, 2);
});

test('created assignment waits for a teacher start, saves current baselines, then records only later changes', async (t) => {
  const f = fixture(t, { newAssignment: true, twoStudents: true }); await f.mount();
  assert.equal(f.current().monitoringPending, true);
  assert.equal(f.current().running, false);
  assert.deepEqual(f.audit.reads, []);
  await f.tick(86400000);
  assert.deepEqual(f.audit.reads, []);
  await act(async () => { assert.equal(await f.current().startMonitoring(), true); });
  assert.equal(f.current().monitoringPending, false);
  assert.deepEqual(f.audit.reads, ['a', 'b']);
  assert.equal(f.audit.comments, 2);
  assert.equal(f.current().commentsLoaded.length, 2);
  assert.deepEqual(f.current().students.map((student) => student.records.map((record) => record.source)), [['first_snapshot'], ['first_snapshot']]);
  assert.ok(foldWorkspace(f.saved.events).settings.monitoringStartedAt);
  f.audit.chars += 20; await f.tick(30000);
  assert.equal(f.current().students[0].records.at(-1).charDelta, 20);
  assert.equal(f.current().students[0].records.at(-1).source, 'continuous_poll');
  await f.unmount(); await f.mount();
  assert.equal(f.current().monitoringPending, false);
});

test('posting a reply clears an anonymous question even when the next comment read is stale', async (t) => {
  const f = fixture(t); await f.mount();
  f.audit.commentThreads = [{ id: 'question', role: 'other', authorName: '익명', createdAt: '2026-10-12T00:00:00Z', origin: 'google_slides', content: '도움이 필요해요', replies: [] }];
  const student = f.current().students[0];
  await act(async () => { await f.current().refreshComments(student); });
  assert.equal(pendingCommentActivity(f.current().conversations.a).total, 1);
  await act(async () => { assert.equal(await f.current().feedback(student, '함께 살펴볼게요', 'question'), true); });
  assert.deepEqual(f.audit.posts, [{ slideId: 'a', content: '함께 살펴볼게요', commentId: 'question' }]);
  assert.equal(foldWorkspace(f.saved.events).messageRoles['slide:a:teacher-reply'], 'teacher');
  assert.equal(f.current().conversations.a[0].replies[0].role, 'teacher');
  assert.equal(pendingCommentActivity(f.current().conversations.a).total, 0);
});

test('reviewing an unanswered comment saves privately and survives reopening', async (t) => {
  const f = fixture(t); await f.mount();
  f.audit.commentThreads = [{ id: 'question', role: 'other', createdAt: '2026-10-12T00:00:00Z', origin: 'google_slides', content: '실수로 보낸 글', replies: [] }];
  const student = f.current().students[0];
  await act(async () => { await f.current().refreshComments(student); });
  const visibleComments = () => f.current().classify(f.current().conversations.a, f.current().students[0]);
  assert.equal(pendingCommentActivity(visibleComments()).total, 1);
  await act(async () => { assert.equal(await f.current().reviewComment(student, f.current().conversations.a[0], true), true); });
  assert.equal(foldWorkspace(f.saved.events).commentReviews['slide:a:question'], true);
  assert.equal(pendingCommentActivity(visibleComments()).total, 0);
  await f.unmount(); await f.mount();
  await act(async () => { await f.current().refreshComments(f.current().students[0]); });
  assert.equal(visibleComments()[0].reviewed, true);
  await act(async () => { assert.equal(await f.current().reviewComment(f.current().students[0], f.current().conversations.a[0], false), true); });
  assert.equal(pendingCommentActivity(visibleComments()).total, 1);
});

test('a failed first baseline keeps the assignment in the not-started state', async (t) => {
  const f = fixture(t, { newAssignment: true }); await f.mount();
  f.audit.failReads = true;
  await act(async () => { assert.equal(await f.current().startMonitoring(), false); });
  assert.equal(f.current().monitoringPending, true);
  assert.equal(f.current().running, false);
  assert.equal(foldWorkspace(f.saved.events).settings.monitoringStartedAt, undefined);
  assert.match(f.current().monitoringError, /접근할 수 없음/);
});

test('starting an older created assignment resets the lesson comparison without deleting old events', async (t) => {
  const old = control('old', 'snapshot', { source: 'first_snapshot', checkedAt: '2026-10-11T01:00:00Z', charCount: 120, imageCount: 1, slideCount: 1, pages: [] }, 'slide:a');
  const f = fixture(t, { newAssignment: true, events: [old] }); await f.mount();
  assert.equal(f.current().monitoringPending, true);
  assert.equal(f.current().students[0].records.length, 0);
  await act(async () => { await f.current().startMonitoring(); });
  assert.equal(f.current().students[0].records.length, 1);
  assert.equal(f.current().students[0].records[0].source, 'first_snapshot');
  assert.ok(f.saved.events.some((event) => event.id === 'old'));
  f.audit.chars += 5; await f.tick(30000);
  assert.equal(f.current().students[0].records.at(-1).charDelta, 5);
});

test('restarting a running lesson takes a fresh baseline and continues after thirty seconds', async (t) => {
  const f = fixture(t); await f.mount();
  assert.equal(f.current().running, true);
  f.audit.chars += 15;
  await act(async () => { assert.equal(await f.current().startMonitoring(), true); });
  assert.equal(f.current().students[0].records.length, 1);
  assert.equal(f.current().students[0].records[0].source, 'first_snapshot');
  f.audit.chars += 7;
  await f.tick(30000);
  assert.equal(f.current().students[0].records.at(-1).charDelta, 7);
});

test('an ended assignment restores without any student reads and explicit resume does not silently start a cycle', async (t) => {
  const f = fixture(t, { events: [control('end', 'settings', { monitoringEnded: true })] }); await f.mount();
  assert.equal(f.current().monitoringEnded, true); assert.equal(f.current().running, false); assert.equal(f.audit.reads.length, 0);
  await act(async () => { await f.current().setMonitoringEnded(false); }); await f.tick(60000);
  assert.equal(f.current().running, false); assert.equal(f.audit.reads.length, 0);
  await act(async () => { f.current().toggleLive(); }); assert.equal(f.audit.reads.length, 1);
});

test('student pause survives automatic setup, and assignment end survives closing and reopening', async (t) => {
  const f = fixture(t, { twoStudents: true, events: [control('pause-a', 'collection', { paused: true }, 'slide:a')] }); await f.mount();
  assert.deepEqual(f.audit.reads, ['b']);
  await act(async () => { await f.current().setMonitoringEnded(true); });
  const before = f.audit.reads.length; await f.unmount(); await f.mount(); await f.tick(60000);
  assert.equal(f.current().monitoringEnded, true); assert.equal(f.current().running, false); assert.equal(f.audit.reads.length, before);
  assert.equal(f.current().students[1].records.length, 1);
});

test('ending while automatic setup is pending blocks the first read and shares one private-store initialization', async (t) => {
  let release; const waiting = new Promise((resolve) => { release = resolve; });
  const f = fixture(t, { waitForSetup: waiting }); await f.mount();
  await act(async () => { const ending = f.current().setMonitoringEnded(true); release(); await ending; });
  assert.equal(f.current().monitoringEnded, true); assert.equal(f.current().running, false);
  assert.equal(f.audit.reads.length, 0); assert.equal(f.audit.setups, 1); assert.equal(f.audit.authorization.length, 1);
  assert.equal(foldWorkspace(f.saved.events).settings.monitoringEnded, true);
});

test('failed background connection shows an error and a user retry starts monitoring', async (t) => {
  const f = fixture(t, { failSetup: true }); await f.mount();
  assert.match(f.current().error, /모니터링을 시작하지 못했습니다/); assert.equal(f.current().running, false);
  f.audit.failSetup = false;
  await act(async () => { assert.equal(await f.current().connect(), true); });
  assert.equal(f.current().running, true); assert.equal(f.current().error, ''); assert.equal(f.audit.reads.length, 1);
  assert.equal(f.audit.authorization.at(-1).interactive, true);
});

test('hidden tabs make no source requests; returning captures the gap without pretending it was continuous work', async (t) => {
  const f = fixture(t); await f.mount(); let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  t.after(() => { delete document.visibilityState; });
  await act(async () => { visibility = 'hidden'; document.dispatchEvent(new window.Event('visibilitychange')); });
  await f.tick(60000); assert.equal(f.audit.reads.length, 1);
  f.audit.chars += 40;
  await act(async () => { visibility = 'visible'; document.dispatchEvent(new window.Event('visibilitychange')); });
  assert.equal(f.audit.reads.length, 2); assert.equal(f.current().students[0].records.at(-1).charDelta, 40);
  assert.equal(f.current().students[0].records.at(-1).source, 'gap_comparison');
});

test('read-only deployment restores stored data without requesting a writer or starting monitoring', async (t) => {
  process.env.NEXT_PUBLIC_APP_MODE = 'readonly';
  t.after(() => { delete process.env.NEXT_PUBLIC_APP_MODE; });
  const f = fixture(t, { events: [control('memo', 'memo', { text: '이전 메모' }, 'slide:a')] }); await f.mount();
  assert.equal(f.audit.authorization.length, 0); assert.equal(f.audit.setups, 0); assert.equal(f.audit.reads.length, 0);
  assert.equal(f.current().memos.a, '이전 메모'); assert.equal(f.current().running, false);
});
