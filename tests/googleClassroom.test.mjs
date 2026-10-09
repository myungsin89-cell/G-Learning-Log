import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleClassroom, classroomName, classroomKeywords } from '../src/lib/googleClassroom.mjs';
import { createGoogleReader } from '../src/lib/googleReadOnly.mjs';
import { createGoogleWorkspace } from '../src/lib/googleWorkspace.mjs';
import { foldWorkspace } from '../src/lib/liveWorkRecords.mjs';

const mime = 'application/vnd.google-apps.spreadsheet';
const deck = { slides: [{ objectId: 'page', pageElements: [{ shape: { text: { textElements: [{ textRun: { content: '기본 틀' } }] } } }, { image: {} }] }] };
const roster = [{ number: 1, name: '김누리' }, { number: 4, name: '송명신' }];
const assignmentInput = { className: '4학년 4반', name: '달 관찰', templateUrl: 'https://docs.google.com/presentation/d/template/edit', roster, keywordsText: '달, 위치\n달', shareSlides: true, jobId: 'assignment-job' };

test('explicit keyword items remain intact through creation, reload, and resume', async () => {
  const { fetcher, state } = mockGoogle();
  const api = createGoogleClassroom('test', fetcher);
  const input = { ...assignmentInput, keywords: [' 달의 모양 ', '빛, 그림자', '달의 모양'] };
  const created = await api.createAssignment(input);
  const reader = createGoogleReader('another-device', fetcher);
  const plan = await reader.loadCreationPlan({ ...created.assignment, creationId: input.jobId });
  assert.deepEqual(plan.keywords, ['달의 모양', '빛, 그림자']);
  const fileCount = state.sequence;
  await api.createAssignment(plan);
  assert.equal(state.sequence, fileCount);
  const saved = foldWorkspace((await reader.loadWorkspace(created.assignment.id)).events);
  assert.deepEqual(saved.settings.keywords, ['달의 모양', '빛, 그림자']);
});

function mockGoogle() {
  const files = new Map([['original-roster', { id: 'original-roster', name: 'G배움로그_학급명단_저장소', mimeType: mime, ownedByMe: true, permissions: [{ type: 'user', role: 'owner' }], appProperties: {}, tabs: { '기존 반': [['number', 'name'], [9, '원래 학생']] } }], ['template', { id: 'template', mimeType: 'application/vnd.google-apps.presentation', capabilities: { canCopy: true }, deck }]]);
  const state = { files, calls: [], sequence: 0, lostCopy: false, failStudent: null, sharingFails: false };
  const fetcher = async (address, options) => {
    const url = new URL(address), path = decodeURIComponent(url.pathname), method = options.method;
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ path, method, body });
    const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });
    assert.ok(!(method !== 'GET' && (path === '/drive/v3/files/template' || path.includes('/spreadsheets/original-roster'))), 'Original files must not be changed');
    if (path === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q');
      const job = q.match(/key='gbaeumCreation' and value='([^']+)'/)?.[1];
      const found = [...files.values()].filter((file) => job ? file.appProperties?.gbaeumCreation === job : q.includes('teacher-workspace-v2') ? file.appProperties?.gbaeumStore === 'teacher-workspace-v2' : q.includes('학급명단') ? file.name === 'G배움로그_학급명단_저장소' : file.name?.startsWith('SlideSight_DB_'));
      return response({ files: found });
    }
    if ((path === '/drive/v3/files' || path.endsWith('/copy')) && method === 'POST') {
      if (body.appProperties?.gbaeumCreation === state.failStudent) { state.failStudent = null; return response({}, 500); }
      const source = path.endsWith('/copy') ? files.get(path.split('/')[4]) : null;
      const file = { id: `new-${++state.sequence}`, name: body.name, mimeType: source?.mimeType || body.mimeType, ownedByMe: true, permissions: [{ type: 'user', role: 'owner' }], appProperties: body.appProperties, tabs: source ? {} : { Sheet1: [] }, ...(source ? { deck: structuredClone(source.deck) } : {}) };
      files.set(file.id, file);
      if (state.lostCopy && body.appProperties?.gbaeumStore === 'student-copy-v2') { state.lostCopy = false; throw new Error('Lost copy response'); }
      return response(file);
    }
    const driveId = path.match(/^\/drive\/v3\/files\/([^/]+)/)?.[1];
    if (driveId) {
      const file = files.get(driveId); assert.ok(file, `Unknown file ${driveId}`);
      if (path.endsWith('/permissions')) {
        if (method === 'POST') { if (state.sharingFails) return response({}, 403); file.permissions.push(body); return response({}); }
        return response({ permissions: file.permissions });
      }
      if (method === 'PATCH') { Object.assign(file.appProperties, body.appProperties); return response(file); }
      return response(file);
    }
    const slideId = path.match(/^\/v1\/presentations\/([^/]+)$/)?.[1];
    if (slideId) return response(files.get(slideId).deck);
    const sheetId = path.match(/^\/v4\/spreadsheets\/([^/:]+)/)?.[1];
    if (sheetId) {
      const file = files.get(sheetId); assert.ok(file, `Unknown sheet ${sheetId}`);
      if (path.endsWith(':batchUpdate')) { for (const request of body.requests) file.tabs[request.addSheet.properties.title] = []; return response({}); }
      if (path.endsWith('values:batchGet')) return response({ valueRanges: url.searchParams.getAll('ranges').map((range) => ({ values: file.tabs[range.replaceAll("'", '')] })) });
      const address = path.split('/values/')[1];
      if (address) {
        const title = address.match(/^'((?:[^']|'')+)'!/)?.[1].replaceAll("''", "'");
        assert.ok(title in file.tabs, `Missing tab ${title}`);
        if (method === 'POST') { assert.equal(url.searchParams.get('valueInputOption'), 'RAW'); file.tabs[title].push(...body.values); return response({}); }
        if (method === 'PUT') {
          assert.equal(url.searchParams.get('valueInputOption'), 'RAW');
          const start = Number(address.match(/!A(\d+)/)?.[1]) - 1;
          body.values.forEach((row, offset) => { file.tabs[title][start + offset] = row; });
          return response({});
        }
        return response({ values: file.tabs[title] });
      }
      return response({ sheets: Object.keys(file.tabs).map((title) => ({ properties: { title } })) });
    }
    assert.fail(`Unexpected request ${method} ${path}`);
  };
  return { fetcher, state };
}

test('class creation persists actual attendance numbers in a new RAW private sheet and excludes internal tabs', async () => {
  const { fetcher, state } = mockGoogle(), before = structuredClone(state.files.get('original-roster'));
  const api = createGoogleClassroom('test', fetcher);
  const input = { name: '4학년 4반', rosterText: '4 송명신\n1 김누리', jobId: 'class-job' };
  const created = await api.createClass(input);
  assert.notEqual(created.rosterId, 'original-roster');
  assert.deepEqual(state.files.get(created.rosterId).tabs['4학년 4반'].slice(1), [[1, '김누리'], [4, '송명신']]);
  assert.deepEqual(state.files.get('original-roster'), before);
  assert.deepEqual(await api.createClass(input), created);
  assert.equal(state.sequence, 1);
  assert.deepEqual((await createGoogleReader('test', fetcher).listClasses()).map((item) => item.name), ['기존 반', '4학년 4반']);
  await assert.rejects(api.createClass({ ...input, rosterText: '1 바꾼 이름' }), /입력 내용이 다릅니다/);
});

test('assignment copies preserve template, exclude its baseline, save keywords, and reopen on another reader', async () => {
  const { fetcher, state } = mockGoogle(), api = createGoogleClassroom('test', fetcher);
  state.lostCopy = true;
  const original = structuredClone(state.files.get('template'));
  const created = await api.createAssignment(assignmentInput);
  assert.deepEqual(created.students.map((student) => student.number), [1, 4]);
  assert.deepEqual(created.warnings, []);
  assert.deepEqual(state.files.get('template'), original);
  assert.equal(state.sequence, 6); // DB, frozen template, two student copies, private settings, public picker.
  const sheet = state.files.get(created.assignment.id);
  assert.equal(sheet.appProperties.setupStatus, 'ready');
  assert.ok(sheet.permissions.every((permission) => permission.role === 'owner'));
  const secondDevice = createGoogleReader('second-device', fetcher);
  const loaded = await secondDevice.loadAssignment(created.assignment, assignmentInput.className);
  assert.deepEqual([loaded.assignment.templateBaseline.chars, loaded.assignment.templateBaseline.slides, loaded.assignment.templateBaseline.images], [3, 1, 1]);
  assert.ok(loaded.students.every((student) => student.chars === 0 && student.images === 0 && student.records.length === 0));
  assert.deepEqual(foldWorkspace((await secondDevice.loadWorkspace(created.assignment.id)).events).settings.keywords, ['달', '위치']);
  sheet.tabs.students[1][6] = 200; sheet.tabs.students[1][13] = '보존할 피드백';
  await api.createAssignment(assignmentInput);
  assert.equal(state.sequence, 6); assert.equal(sheet.tabs.students[1][6], 200); assert.equal(sheet.tabs.students[1][13], '보존할 피드백');
  assert.equal(sheet.tabs.activity_logs.length, 2);
});

test('partial distribution resumes from a saved plan without duplicating successful copies', async () => {
  const { fetcher, state } = mockGoogle(); state.failStudent = 'assignment-job:4';
  await assert.rejects(createGoogleClassroom('test', fetcher).createAssignment(assignmentInput));
  assert.equal(state.sequence, 3);
  const reader = createGoogleReader('test', fetcher);
  const [assignment] = await reader.listAssignments(assignmentInput.className);
  assert.equal(assignment.setupStatus, 'creating');
  const plan = await reader.loadCreationPlan(assignment);
  assert.equal(plan.jobId, assignmentInput.jobId);
  assert.deepEqual(plan.roster, roster);
  const created = await createGoogleClassroom('test', fetcher).createAssignment(plan);
  assert.equal(created.students.length, 2); assert.equal(state.sequence, 6);
});

test('a sharing failure remains explicit and can be retried without creating more slides', async () => {
  const { fetcher, state } = mockGoogle(); state.sharingFails = true;
  const api = createGoogleClassroom('test', fetcher), created = await api.createAssignment(assignmentInput);
  assert.equal(created.warnings.length, 3);
  const sheet = state.files.get(created.assignment.id);
  assert.equal(sheet.appProperties.setupStatus, 'needs-sharing'); assert.equal(sheet.tabs.students[1][15], 'sharing-failed');
  state.sharingFails = false;
  assert.equal((await api.createAssignment(assignmentInput)).warnings.length, 0);
  assert.equal(state.sequence, 6); assert.equal(sheet.appProperties.setupStatus, 'ready');
});

test('validation and readonly deployment fail before creating files', async () => {
  const { fetcher, state } = mockGoogle(), api = createGoogleClassroom('test', fetcher);
  await assert.rejects(api.createClass({ name: '학급', rosterText: '1 학생\n1 중복', jobId: 'invalid' }));
  await assert.rejects(api.createAssignment({ ...assignmentInput, templateUrl: 'https://other.invalid/test' }));
  await assert.rejects(api.createClass({ name: '학급', rosterText: '1 학생' }));
  await assert.rejects(api.createClass({ name: '_setup', rosterText: '1 학생', jobId: 'invalid' }));
  assert.equal(state.calls.length, 0);
  assert.throws(() => classroomName('[학급]')); assert.deepEqual(classroomKeywords(' 달, 위치\n달 '), ['달', '위치']);
  const original = process.env.NEXT_PUBLIC_APP_MODE;
  process.env.NEXT_PUBLIC_APP_MODE = 'readonly';
  try { assert.throws(() => createGoogleClassroom('test', fetcher), /읽기 전용/); }
  finally { if (original === undefined) delete process.env.NEXT_PUBLIC_APP_MODE; else process.env.NEXT_PUBLIC_APP_MODE = original; }
});

test('keyword changes and clearing survive new Google connections without modifying original records', async () => {
  const { fetcher, state } = mockGoogle();
  const created = await createGoogleClassroom('test', fetcher).createAssignment(assignmentInput);
  const before = structuredClone(state.files.get(created.assignment.id).tabs);
  const api = createGoogleWorkspace('test', created.assignment, created.students, fetcher);
  await api.initialize();
  await api.append([{ id: 'edited', type: 'settings', studentId: '', createdAt: '2026-10-09T01:00:00Z', payload: { keywords: ['변경한 단어'] } }]);
  const reader = createGoogleReader('another-device', fetcher);
  assert.deepEqual(foldWorkspace((await reader.loadWorkspace(created.assignment.id)).events).settings.keywords, ['변경한 단어']);
  await api.append([{ id: 'cleared', type: 'settings', studentId: '', createdAt: '2026-10-09T01:01:00Z', payload: { keywords: [] } }]);
  assert.deepEqual(foldWorkspace((await reader.loadWorkspace(created.assignment.id)).events).settings.keywords, []);
  assert.deepEqual(state.files.get(created.assignment.id).tabs, before);
});

test('shared student access is the default and publishes only a separate minimal picker', async () => {
  const { fetcher, state } = mockGoogle();
  const created = await createGoogleClassroom('test', fetcher).createAssignment(assignmentInput);
  const entry = created.assignment.studentEntry;
  assert.equal(entry.mode, 'shared'); assert.notEqual(entry.id, created.assignment.id);
  const picker = state.files.get(entry.id), database = state.files.get(created.assignment.id);
  assert.ok(picker.permissions.some((permission) => permission.type === 'anyone' && permission.role === 'reader'));
  assert.ok(database.permissions.every((permission) => permission.role === 'owner'));
  assert.deepEqual(Object.keys(picker.tabs), ['Sheet1', 'students']);
  assert.deepEqual(picker.tabs.students[0], ['student_number', 'student_name', 'slide_id', 'class_name', 'assignment_name']);
  assert.ok(picker.tabs.students.every((row) => row.length === 5));
  assert.deepEqual(picker.tabs.students.slice(1).map((row) => row[0]), [1, 4]);
  const saved = await createGoogleReader('another-device', fetcher).loadWorkspace(created.assignment.id);
  assert.deepEqual(foldWorkspace(saved.events).settings.studentEntry, entry);
});

test('individual link distribution is selectable and creates no public name picker', async () => {
  const { fetcher, state } = mockGoogle();
  const created = await createGoogleClassroom('test', fetcher).createAssignment({ ...assignmentInput, entryMode: 'individual' });
  assert.equal(created.assignment.studentEntry.mode, 'individual');
  assert.equal([...state.files.values()].some((file) => file.appProperties?.gbaeumStore === 'student-join-v2'), false);
});

test('shared access can be restored after changing preference and reuses its existing picker', async () => {
  const { fetcher, state } = mockGoogle(), classroom = createGoogleClassroom('test', fetcher);
  const created = await classroom.createAssignment(assignmentInput);
  const workspace = createGoogleWorkspace('test', created.assignment, created.students, fetcher);
  await workspace.initialize();
  await workspace.append([{ id: 'individual-preference', type: 'settings', studentId: '', createdAt: '2026-10-09T01:00:00Z', payload: { studentEntry: { ...created.assignment.studentEntry, mode: 'individual' } } }]);
  await classroom.createStudentEntry({ assignment: created.assignment, className: assignmentInput.className, students: created.students, jobId: `join:${created.assignment.id}` });
  const events = (await createGoogleReader('test', fetcher).loadWorkspace(created.assignment.id)).events;
  assert.equal(foldWorkspace(events).settings.studentEntry.mode, 'shared'); assert.equal(state.sequence, 6);
  const picker = state.files.get(created.assignment.studentEntry.id);
  picker.tabs.private_notes = [['비공개 교사 메모']];
  const before = state.calls.length;
  await assert.rejects(classroom.createStudentEntry({ assignment: created.assignment, className: assignmentInput.className, students: created.students, jobId: `join:${created.assignment.id}` }), /다른 탭/);
  assert.ok(state.calls.slice(before).every((call) => call.method === 'GET'));
});
