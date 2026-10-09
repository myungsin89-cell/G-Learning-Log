import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleWorkspace } from '../src/lib/googleWorkspace.mjs';
import { foldWorkspace, makeObservation, mergeWorkspaceStudents, classifyConversations, verifiedChangeBins, EVENT_HEADERS, eventRow, parseWorkspaceEvents } from '../src/lib/liveWorkRecords.mjs';
import { unreadStudentReplies } from '../src/lib/workRecords.mjs';

const assignment = { id: 'source-sheet', name: '달 관찰', templateBaseline: { chars: 120, images: 1 } };
const student = { id: 'row-2', slideId: 'student-slide', number: 4, name: '학생', chars: 256, images: 0, slides: 2, records: [{ id: 'legacy', source: 'legacy_unverified', charCount: 256, charDelta: null }] };
const observation = (time, chars = 400) => ({ checkedAt: time, charCount: chars, imageCount: 3, slideCount: 4, pages: [{ id: 'page', number: 1, text: '달 관찰', notes: '', chars, images: 3 }] });
const event = (id, type, payload, key = 'slide:student-slide') => ({ id, type, studentId: key, createdAt: '2026-10-09T01:00:00Z', payload });

function mockGoogle({ existing = false, shared = false, badHeader = false, lostResponse = false } = {}) {
  const state = { created: existing, hasTab: existing, rows: existing ? [badHeader ? ['custom_notes'] : [...EVENT_HEADERS]] : [], calls: [], appendCount: 0, lostResponse };
  const file = () => ({ id: 'private-store', mimeType: 'application/vnd.google-apps.spreadsheet', ownedByMe: true, appProperties: { gbaeumStore: 'teacher-workspace-v2', sourceSheet: 'source-sheet' }, permissions: [{ type: 'user', role: 'owner' }, ...(shared ? [{ type: 'anyone', role: 'reader' }] : [])] });
  const fetcher = async (url, options) => {
    const parsed = new URL(url), path = decodeURIComponent(parsed.pathname), body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ path, method: options.method, body });
    if (path.includes('/spreadsheets/source-sheet') && options.method !== 'GET') assert.fail('Original assignment must not be written');
    let result;
    if (path === '/drive/v3/files' && options.method === 'GET') result = { files: state.created ? [file()] : [] };
    else if (path === '/drive/v3/files' && options.method === 'POST') { state.created = true; result = { id: 'private-store' }; assert.equal(body.appProperties.sourceSheet, assignment.id); }
    else if (path === '/drive/v3/files/private-store') result = file();
    else if (path === '/v4/spreadsheets/private-store') result = { sheets: [{ properties: { title: state.hasTab ? 'events' : 'Sheet1' } }] };
    else if (path === '/v4/spreadsheets/private-store:batchUpdate') { state.hasTab = true; result = {}; }
    else if (path.endsWith(':append')) {
      assert.equal(parsed.searchParams.get('valueInputOption'), 'RAW');
      state.rows.push(...body.values); state.appendCount++; result = {};
      if (state.lostResponse) { state.lostResponse = false; throw new Error('Lost response after append'); }
    } else if (path.includes('/values/') && options.method === 'PUT') { state.rows = body.values; result = {}; }
    else if (path.includes('/values/')) result = { values: state.rows };
    else if (path.endsWith('/comments')) result = { id: 'real-comment', content: body.content, author: { me: true }, replies: [] };
    else if (path.endsWith('/replies')) result = { id: 'real-reply', content: body.content, author: { me: true } };
    else assert.fail(`Unexpected request: ${options.method} ${path}`);
    return { ok: true, json: async () => result };
  };
  return { state, fetcher };
}

test('first observation, continuous interval, tab return and long gaps have distinct provenance', () => {
  const first = makeObservation(observation('2026-10-09T01:00:00Z'), null, { sessionId: 'a' });
  const short = makeObservation(observation('2026-10-09T01:00:30Z', 700), first, { sessionId: 'a', continuous: true, keywords: ['달'] });
  assert.equal(first.source, 'first_snapshot'); assert.equal(first.charDelta, null);
  assert.equal(short.source, 'continuous_poll'); assert.equal(short.charDelta, 300); assert.deepEqual(short.keywordsUsed, ['달']);
  assert.equal(makeObservation(observation('2026-10-09T01:00:30Z', 700), first, { sessionId: 'new', continuous: true }).source, 'gap_comparison');
  assert.equal(makeObservation(observation('2026-10-12T01:00:30Z', 700), first, { sessionId: 'a', continuous: true }).source, 'gap_comparison');
  assert.throws(() => makeObservation(observation(first.checkedAt), first, { sessionId: 'a' }), /확인 시각/);
});

test('new snapshots preserve old records and use the original template baseline once', () => {
  const record = makeObservation(observation('2026-10-09T01:00:00Z'), null, { sessionId: 'a' });
  const state = foldWorkspace([event('one', 'snapshot', record)]);
  const input = { assignment, students: [student] }, before = JSON.stringify(input);
  const merged = mergeWorkspaceStudents(input, state)[0];
  assert.equal(JSON.stringify(input), before); assert.equal(merged.number, 4); assert.equal(merged.chars, 280); assert.equal(merged.images, 2);
  assert.equal(merged.records[0].id, 'legacy'); assert.equal(merged.records.length, 2);
  assert.equal(mergeWorkspaceStudents({ ...input, assignment: { ...assignment, templateBaseline: null } }, state)[0].chars, 256);
  const reordered = mergeWorkspaceStudents({ assignment, students: [{ ...student, id: 'row-7' }] }, state)[0];
  assert.equal(reordered.records.length, 2);
});

test('saved notes, read cursors and keyword settings survive reconstruction and duplicate delivery', () => {
  const events = [event('m1', 'memo', { text: '첫 메모' }), event('m2', 'memo', { text: '다시 저장한 메모' }), event('r', 'read', { at: '2026-10-09T01:00:00Z' }), event('settings', 'settings', { keywords: ['달', '위치'] }, '')];
  const parsed = parseWorkspaceEvents([EVENT_HEADERS, ...events.map(eventRow), eventRow(events[0]), ['bad']]);
  assert.equal(parsed.events.length, 4); assert.equal(parsed.invalidRows.length, 1);
  const state = foldWorkspace(parsed.events);
  assert.equal(state.memos['slide:student-slide'], '다시 저장한 메모'); assert.deepEqual(state.settings.keywords, ['달', '위치']);
});

test('teacher replies never become student replies, even after an incorrect actor mapping', () => {
  const state = foldWorkspace([event('teacher-map', 'identity', { authorId: 'teacher', role: 'student' }), event('student-map', 'identity', { authorId: 'child', role: 'student' })]);
  const threads = classifyConversations([{ id: 'thread', role: 'teacher', authorId: 'teacher', replies: [{ id: 'own', role: 'teacher', authorId: 'teacher', createdAt: '2026-10-09T01:00:30Z' }, { id: 'child-reply', role: 'other', authorId: 'child', createdAt: '2026-10-09T01:00:30Z' }, { id: 'unknown', role: 'unknown', createdAt: '2026-10-09T01:00:30Z' }] }], student, state);
  assert.equal(threads[0].role, 'teacher'); assert.equal(threads[0].replies[0].role, 'teacher');
  assert.equal(unreadStudentReplies(threads, null), 1); assert.equal(unreadStudentReplies(threads, '2026-10-09T01:01:00Z'), 0);
});

test('two hours of 30-second observations become six 20-minute bins without filling a three-day gap', () => {
  let previous = makeObservation(observation('2026-10-09T00:00:00Z', 100), null, { sessionId: 'lesson' });
  const records = [];
  for (let index = 1; index <= 239; index++) {
    const next = makeObservation(observation(new Date(Date.parse('2026-10-09T00:00:00Z') + index * 30000).toISOString(), 100 + index), previous, { sessionId: 'lesson', continuous: true });
    records.push({ ...next, id: `r${index}` }); previous = next;
  }
  const bins = verifiedChangeBins(records);
  assert.equal(bins.length, 6); assert.equal(bins.reduce((sum, bin) => sum + bin.added, 0), 239);
  const gap = makeObservation(observation('2026-10-12T00:00:00Z', 700), previous, { sessionId: 'new' });
  const all = verifiedChangeBins([...records, { ...gap, id: 'gap' }]);
  assert.equal(all.length, 7); assert.equal(all.at(-1).gap, true); assert.equal(all.at(-1).records.length, 1);
});

test('private store initialization and appends never write the original sheet', async () => {
  const { fetcher, state } = mockGoogle();
  const api = createGoogleWorkspace('token', assignment, [student], fetcher);
  assert.equal((await api.initialize()).storeId, 'private-store');
  const result = await api.append([event('memo', 'memo', { text: '=수식을 실행하지 않는 메모' })]);
  assert.equal(result.events.length, 1); assert.equal((await api.load()).events[0].payload.text, '=수식을 실행하지 않는 메모');
  assert.ok(!state.calls.some((call) => call.path.includes('permissions') || call.method === 'DELETE'));
});

test('shared or unknown-format stores stop before any writes', async () => {
  for (const options of [{ existing: true, shared: true }, { existing: true, badHeader: true }]) {
    const { fetcher, state } = mockGoogle(options);
    const api = createGoogleWorkspace('token', assignment, [student], fetcher);
    await assert.rejects(api.initialize());
    assert.ok(state.calls.every((call) => call.method === 'GET'));
  }
});

test('a teacher memo can be saved independently with no snapshots or student-facing writes', async () => {
  const { fetcher, state } = mockGoogle({ existing: true });
  const api = createGoogleWorkspace('token', assignment, [student], fetcher);
  await api.initialize();
  const result = await api.append([event('private-note', 'memo', { text: '다음에는 관찰 이유를 확인하기' })]);
  const restored = foldWorkspace(result.events);
  assert.equal(restored.memos['slide:student-slide'], '다음에는 관찰 이유를 확인하기');
  assert.deepEqual(restored.snapshots, {});
  assert.equal(state.appendCount, 1);
  assert.ok(state.calls.every(({ path }) => !path.includes('student-slide') && !path.includes('source-sheet') && !path.includes('comments')));
  const writes = state.calls.filter(({ method }) => method !== 'GET');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/v4/spreadsheets/private-store/values/\'events\'!A:F:append');
});

test('a lost append response is confirmed by reading and does not create duplicate events', async () => {
  const { fetcher, state } = mockGoogle({ existing: true, lostResponse: true });
  const api = createGoogleWorkspace('token', assignment, [student], fetcher);
  await api.initialize();
  const records = [event('same-id', 'memo', { text: '한 번만 기록' })];
  assert.equal((await api.append(records)).events.length, 1);
  assert.equal((await api.append(records)).events.length, 1); assert.equal(state.appendCount, 1);
});

test('feedback targets registered Slides comments and teacher replies; foreign files are rejected', async () => {
  const { fetcher, state } = mockGoogle();
  const api = createGoogleWorkspace('token', assignment, [student], fetcher);
  assert.equal((await api.feedback(student.slideId, '실제 댓글 테스트')).role, 'teacher');
  assert.equal((await api.feedback(student.slideId, '교사 답글', 'thread')).id, 'real-reply');
  await assert.rejects(api.feedback('foreign', '보내면 안 되는 글'));
  assert.equal(state.calls.length, 2);
});

test('missing saved headers stop further appends without overwriting existing rows', async () => {
  const { fetcher, state } = mockGoogle({ existing: true });
  const api = createGoogleWorkspace('token', assignment, [student], fetcher);
  await api.initialize(); state.rows = [];
  await assert.rejects(api.append([event('memo', 'memo', { text: '보존' })]), /헤더/);
  assert.equal(state.appendCount, 0);
});

test('read-only deployment blocks all new write clients before fetching', () => {
  const previous = process.env.NEXT_PUBLIC_APP_MODE;
  try {
    process.env.NEXT_PUBLIC_APP_MODE = 'readonly';
    assert.throws(() => createGoogleWorkspace('token', assignment, [student], () => assert.fail('Must not fetch')), /읽기 전용/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
    else process.env.NEXT_PUBLIC_APP_MODE = previous;
  }
});
