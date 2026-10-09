import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSpreadsheetData, appendActivityLogs, saveStudentsStatus, createDatabaseSpreadsheet, duplicateSlideForStudents, saveClassRoster, deleteClassRoster, deleteAssignment, postSlideComment, postSlideReply, deleteSlideComment, deleteSlideReply } from '../src/lib/googleApi.js';

function fakeGoogle(occupied = []) {
  const calls = [];
  globalThis.sessionStorage = { getItem: () => 'test-token' };
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: {
    get: async () => ({ result: { sheets: [
      { properties: { sheetId: 1, title: 'students', gridProperties: { columnCount: 14 } } },
      { properties: { sheetId: 2, title: 'activity_logs', gridProperties: { columnCount: 8 } } },
    ] } }),
    batchUpdate: async (request) => { calls.push({ resize: request.resource.requests }); return {}; },
    values: {
      batchUpdate: async (request) => { calls.push({ headers: request.resource.data }); return {}; },
      get: async ({ range }) => {
        calls.push({ range });
        const values = range.includes('!H1:') ? occupied : range.startsWith('students') ? [[4, '송명신']] : [['송명신', '2026-10-08T12:00:00Z', 256, 2, 0, 0, '첫 기록']];
        return { result: { values } };
      },
      append: async (request) => { calls.push({ append: request.resource.values }); return {}; },
      update: async (request) => { calls.push({ update: request.resource.values }); return {}; },
    },
  } } } } };
  return calls;
}
const cleanup = () => { delete globalThis.window; delete globalThis.sessionStorage; };

test('read-only deployment blocks every legacy Google writer before API access', async (context) => {
  const previous = process.env.NEXT_PUBLIC_APP_MODE;
  context.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_MODE; else process.env.NEXT_PUBLIC_APP_MODE = previous; });
  process.env.NEXT_PUBLIC_APP_MODE = 'readonly';
  for (const writer of [appendActivityLogs, saveStudentsStatus, createDatabaseSpreadsheet, duplicateSlideForStudents, saveClassRoster, deleteClassRoster, deleteAssignment, postSlideComment, postSlideReply, deleteSlideComment, deleteSlideReply]) {
    await assert.rejects(writer(), /읽기 전용 새 버전/);
  }
});

test('reading an old narrow sheet never expands or writes it', async (context) => {
  context.after(cleanup);
  const calls = fakeGoogle();
  const result = await loadSpreadsheetData('test-read-old-schema');
  assert.ok(calls.some((call) => call.range === 'students!A2:N'));
  assert.ok(calls.some((call) => call.range === 'activity_logs!A2:H'));
  assert.ok(calls.every((call) => call.range));
  assert.equal(result.students[0].number, 4);
  assert.equal(result.logs[0].source, 'legacy_unverified');
  assert.equal(result.logs[0].charDiff, null);
});

test('explicit writes expand empty extension columns and preserve zero deltas', async (context) => {
  context.after(cleanup);
  const calls = fakeGoogle();
  await appendActivityLogs('test-write-schema', [{ name: '송명신', number: 4, source: 'gap_comparison', charDiff: 0, imageDelta: 0, slideDelta: 0 }]);
  assert.equal(calls.find((call) => call.resize).resize.length, 2);
  const log = calls.find((call) => call.append).append[0];
  assert.equal(log[7], 'gap_comparison');
  assert.equal(log[10], 0);
  await saveStudentsStatus('test-write-schema', [{ number: 4, name: '송명신', lastCheckedAt: '2026-10-08T12:00:00Z', teacherMemo: '비공개 메모' }]);
  const row = calls.find((call) => call.update).update[0];
  assert.equal(row.length, 15);
  assert.ok(!row.includes('비공개 메모'));
});

for (const occupied of [[['custom_notes'], ['보존할 메모']], [[], ['헤더 없는 기존 데이터']]]) {
  test(`occupied extension columns abort before any writes (${occupied[0][0] || 'no header'})`, async (context) => {
    context.after(cleanup);
    const calls = fakeGoogle(occupied);
    await assert.rejects(appendActivityLogs(`conflict-${occupied[0][0] || 'body'}`, [{ name: '학생' }]), /기존 데이터/);
    assert.ok(calls.every((call) => call.range));
  });
}
