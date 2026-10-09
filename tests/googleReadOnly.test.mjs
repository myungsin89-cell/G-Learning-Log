import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleReader, READ_ONLY_SCOPES } from '../src/lib/googleReadOnly.mjs';
import { adaptStoredAssignment, adaptDriveComments, createStoredAnalysisExport, summarizeStudentCard, storedHistoryBins } from '../src/lib/storedWorkRecords.mjs';
import { createSummaryCsv, unreadStudentReplies } from '../src/lib/workRecords.mjs';

const studentHeaders = ['number', 'name', 'slide_id', 'slide_url', 'status', 'last_active_at', 'char_count', 'slide_count', 'image_count', 'keyword_count', 'keywords_used', 'blank_slide_count', 'focus_ratio', 'teacher_feedback'];
const logHeaders = ['name', 'timestamp', 'char_count', 'slide_count', 'image_count', 'keyword_count', 'copied_text', 'record_source', 'previous_checked_at', 'student_number', 'char_delta', 'image_delta', 'slide_delta'];
const input = () => ({ className: '5학년 2반', assignment: { id: 'original-sheet', name: '달 관찰' }, loadedAt: '2026-10-09T00:00:00Z',
  studentRows: [studentHeaders, [4, '송명신', 'original-slide', 'unsafe-url', 'suspicious', '', 256, 2, 0, 1, '달', 0, 100, '저장된 피드백']],
  logRows: [logHeaders, ['SYSTEM_BASELINE', '', 120, 2, 1], ['송명신', '2026-10-08T12:00:00Z', 256, 2, 0, 1, '과거 추정']],
});

test('existing net amounts and attendance numbers survive without generating history', () => {
  const original = input();
  const snapshot = JSON.stringify(original);
  const data = adaptStoredAssignment(original);
  assert.equal(JSON.stringify(original), snapshot);
  const student = data.students[0];
  assert.equal(student.number, 4);
  assert.equal(student.chars, 256);
  assert.equal(student.slideId, 'original-slide');
  assert.equal(student.records[0].charDelta, null);
  assert.equal(student.records[0].source, 'legacy_unverified');
  assert.equal(student.status, 'unstarted');
  assert.equal(student.checkedAt, null);
  assert.equal(data.threads[student.id][0].role, 'unknown');
});

test('student cards expose restored history even when net chars are zero and a new first snapshot exists', () => {
  const student = adaptStoredAssignment(input()).students[0];
  student.chars = 0;
  student.records.push({ source: 'first_snapshot', checkedAt: '2026-10-09T00:00:00Z', charCount: 972, charDelta: null });
  student.currentCounts = { charCount: 972 };
  const original = JSON.stringify(student);
  const summary = summarizeStudentCard(student);
  assert.equal(summary.recordCount, 2);
  assert.equal(summary.historyLabel, '작업 기록 2개');
  assert.equal(summary.recent, '최근 확인 완료');
  assert.equal(summary.comparisonLabel, null);
  assert.equal(summary.checkedAt, '2026-10-09T00:00:00Z');
  assert.equal(summary.wholeChars, 972);
  assert.equal(JSON.stringify(student), original);
  assert.equal(student.records[0].charDelta, null);
});

test('card summaries use the latest dated record and include image-only changes without inferring old deltas', () => {
  const student = adaptStoredAssignment(input()).students[0];
  assert.equal(summarizeStudentCard(student).checkedAt, '2026-10-08T12:00:00Z');
  assert.equal(summarizeStudentCard(student).recent, '최근 변화량 미확인');
  assert.equal(summarizeStudentCard(student).wholeChars, null);
  student.records.unshift({ source: 'gap_comparison', previousCheckedAt: '2026-10-08T12:00:00Z', checkedAt: '2026-10-09T00:00:00Z', charDelta: 0, imageDelta: 2, slideDelta: 0 });
  assert.equal(summarizeStudentCard(student).recent, '최근 변화 · 이미지 +2개');
  assert.equal(summarizeStudentCard(student).comparisonLabel, '10. 8. 21:00 → 10. 9. 09:00 확인 사이');
  assert.equal(summarizeStudentCard({ records: [] }).historyLabel, '저장 기록 없음');
});

test('cards distinguish unchanged counts, removal and an unknown comparison interval', () => {
  const latest = { source: 'continuous_poll', previousCheckedAt: '2026-10-09T00:00:00Z', checkedAt: '2026-10-09T00:00:30Z', charDelta: 0, imageDelta: 0, slideDelta: 0 };
  assert.equal(summarizeStudentCard({ records: [latest], currentCounts: { charCount: 0 } }).wholeChars, 0);
  assert.equal(summarizeStudentCard({ records: [latest] }).recent, '최근 변화 · 변화 없음');
  assert.equal(summarizeStudentCard({ records: [{ ...latest, charDelta: -20, slideDelta: 1 }] }).recent, '최근 변화 · 글자 -20자 · 슬라이드 +1장');
  const incomplete = summarizeStudentCard({ records: [{ ...latest, previousCheckedAt: null, charDelta: 200 }] });
  assert.equal(incomplete.recent, '최근 변화량 미확인');
  assert.equal(incomplete.comparisonLabel, null);
});

test('legacy history graphs retain stored counts and the last row of each Korean calendar day', () => {
  const records = [
    { id: 'later', source: 'legacy_unverified', checkedAt: '2026-10-08T16:00:00Z', charCount: 214, imageCount: 3, slideCount: 10, charDelta: null },
    { id: 'first', source: 'legacy_unverified', checkedAt: '2026-10-08T14:00:00Z', charCount: 100, imageCount: 1, slideCount: 8, charDelta: null },
    { id: 'earlier', source: 'legacy_unverified', checkedAt: '2026-10-08T15:00:00Z', charCount: 200, imageCount: 2, slideCount: 9, charDelta: null },
    { id: 'new', source: 'first_snapshot', checkedAt: '2026-10-09T00:00:00Z', charCount: 1644 },
    { id: 'unknown-date', source: 'legacy_unverified', checkedAt: null, charCount: 80 },
  ];
  const original = JSON.stringify(records);
  const bins = storedHistoryBins(records);
  assert.deepEqual(bins.map((bin) => [bin.label, bin.value, bin.records.length]), [['10/8', 100, 1], ['10/9', 214, 2]]);
  assert.equal(storedHistoryBins(records, 'imageCount')[1].value, 3);
  assert.equal(storedHistoryBins(records, 'slideCount')[1].value, 10);
  assert.deepEqual(storedHistoryBins(records, 'charCount', 'record').map((bin) => bin.value), [100, 200, 214]);
  assert.equal(JSON.stringify(records), original);
  assert.equal(records[0].charDelta, null);
});

test('legacy graph keeps zero, missing amounts and all dates without inventing records for gaps', () => {
  const records = [
    { id: 'zero', source: 'legacy_unverified', checkedAt: '2026-09-01T00:00:00Z', charCount: 0 },
    { id: 'known', source: 'legacy_unverified', checkedAt: '2026-09-04T00:00:00Z', charCount: 200 },
    { id: 'missing', source: 'legacy_unverified', checkedAt: '2026-09-04T01:00:00Z', charCount: null },
  ];
  assert.deepEqual(storedHistoryBins(records).map((bin) => bin.value), [0, null]);
  assert.equal(storedHistoryBins(records).length, 2);
  const long = Array.from({ length: 100 }, (_, index) => ({ id: `r${index}`, source: 'legacy_unverified', checkedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), charCount: index }));
  assert.equal(storedHistoryBins(long).length, 100);
  assert.throws(() => storedHistoryBins(records, 'charDelta'));
});

test('missing numbers and duplicate names stay separate; ambiguous logs remain in raw export', () => {
  const original = input();
  original.studentRows.push(['', '같은 이름'], [8, '같은 이름']);
  original.logRows.push(['같은 이름', '2026-10-08T12:00:00Z', 100]);
  original.logRows.push(['같은 이름', '2026-10-08T12:00:25Z', 120, 2, 0, 0, '', 'continuous_poll', '2026-10-08T12:00:00Z', 8, 20, 0, 0]);
  const data = adaptStoredAssignment(original);
  assert.equal(data.students[1].number, null);
  assert.equal(data.students[1].chars, null);
  assert.notEqual(data.students[1].id, data.students[2].id);
  assert.equal(data.students[1].records.length, 0);
  assert.equal(data.students[2].records[0].charDelta, 20);
  assert.equal(data.unmatchedRecords.length, 1);
  const exported = createStoredAnalysisExport(data, data.threads, []);
  assert.deepEqual(exported.rawSource.logRows, original.logRows.slice(1));
  assert.equal(exported.dataKind, 'stored_google_records');
  assert.equal(exported.students[0].commentsLoaded, false);
});

test('custom extension columns never become verified change records', () => {
  const original = input();
  original.logRows[0][7] = 'custom_source';
  original.logRows[2].push('continuous_poll', '2026-10-08T11:59:35Z', 4, 256);
  const data = adaptStoredAssignment(original);
  assert.equal(data.students[0].records[0].source, 'legacy_unverified');
  assert.equal(data.students[0].records[0].charDelta, null);
});

test('comments preserve teacher and other authors without inventing student replies', () => {
  const threads = adaptDriveComments([{ id: 'comment', content: '피드백', author: { me: true }, replies: [
    { id: 'teacher', content: '추가 안내', author: { me: true } },
    { id: 'other', content: '답글', author: { me: false, displayName: '미분류 사용자' } },
    { id: 'deleted', deleted: true },
  ] }]);
  assert.equal(threads[0].role, 'teacher');
  assert.equal(threads[0].replies.length, 2);
  assert.equal(threads[0].replies[1].role, 'other');
  assert.equal(unreadStudentReplies(threads, null), 0);
  const data = adaptStoredAssignment(input());
  const csv = createSummaryCsv(data.students, { readOnly: true, keywords: data.keywords, threads: data.threads, memos: {}, matched: (student) => student.keywordsUsed });
  assert.ok(csv.includes('저장된 피드백'));
  assert.ok(csv.includes('기존 저장 기록 · 읽기 전용'));
});

test('class, assignment, records and comment reads use only GET, including pagination', async () => {
  const calls = [];
  const api = createGoogleReader('test-token', async (url, options) => {
    calls.push({ url: new URL(url), options });
    const parsed = new URL(url);
    let result;
    if (parsed.pathname === '/drive/v3/files') {
      result = parsed.searchParams.get('q').includes('학급명단') ? { files: [{ id: 'roster', name: '명단' }] } : parsed.searchParams.get('pageToken') ? { files: [{ id: 'original-sheet', name: 'SlideSight_DB_[5학년 2반]_[달 관찰]' }, { id: 'other', name: 'SlideSight_DB_[다른 반]_[과제]' }] } : { files: [], nextPageToken: 'page-2' };
    } else if (parsed.pathname.includes('/comments')) {
      result = parsed.searchParams.get('pageToken') ? { comments: [] } : { comments: [{ id: 'c', author: { me: true } }], nextPageToken: 'comments-2' };
    } else if (parsed.pathname.endsWith('values:batchGet')) {
      result = { valueRanges: [{ values: input().studentRows }, { values: input().logRows }] };
    } else result = { sheets: (parsed.pathname.endsWith('roster') ? ['5학년 2반'] : ['students', 'activity_logs']).map((title) => ({ properties: { title } })) };
    return { ok: true, json: async () => result };
  });
  const classes = await api.listClasses();
  const assignments = await api.listAssignments(classes[0].name);
  assert.equal(assignments.length, 1);
  const data = await api.loadAssignment(assignments[0], classes[0].name);
  assert.equal(data.students[0].slideId, 'original-slide');
  assert.equal((await api.loadComments('original-slide')).length, 1);
  assert.ok(calls.every(({ options }) => options.method === 'GET'));
  assert.ok(calls.every(({ url }) => !url.pathname.includes('batchUpdate')));
  assert.ok(READ_ONLY_SCOPES.every((scope) => scope.endsWith('.readonly')));
});

test('long history is not truncated at 5,000 records', () => {
  const original = input();
  original.logRows = [logHeaders, ...Array.from({ length: 5001 }, () => ['송명신', '2026-10-08T12:00:00Z', 256])];
  const data = adaptStoredAssignment(original);
  assert.equal(data.students[0].records.length, 5001);
  assert.equal(data.rawSource.logRows.length, 5001);
});

test('roster reads preserve attendance gaps and missing numbers, with quoted sheet names', async () => {
  const calls = [];
  const api = createGoogleReader('test-token', async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ values: [['1', '김누리'], ['4', '송명신'], ['', '가명'], ['x', '번호 오류'], ['9', '']] }) };
  });
  const roster = await api.loadRoster({ name: "선생님's 학급", rosterId: 'roster' });
  assert.deepEqual(roster.map(({ number, name }) => [number, name]), [[1, '김누리'], [4, '송명신'], [null, '가명'], [null, '번호 오류']]);
  assert.equal(decodeURIComponent(calls[0].url.pathname), "/v4/spreadsheets/roster/values/'선생님''s 학급'!A2:B");
  assert.equal(calls[0].options.method, 'GET');
});

test('assignment summaries read one student range without loading presentations or history', async () => {
  const calls = [];
  const originalHeaders = [...studentHeaders];
  originalHeaders[0] = 'student_number'; originalHeaders[1] = 'student_name';
  const api = createGoogleReader('test-token', async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ values: [originalHeaders, [1, '김누리', 'slide-a'], [4, '송명신', '', 'https://docs.google.com/presentation/d/slide-b/edit'], [8, '학생', '', ''], []] }) };
  });
  const summary = await api.loadAssignmentSummary({ id: 'original-sheet', name: '관찰' }, '학급');
  assert.deepEqual(summary, { studentCount: 3, linkedCount: 2, coverSlideId: 'slide-a' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, 'sheets.googleapis.com');
  assert.equal(calls[0].options.method, 'GET');
});

test('private saved records are restored by GET and missing headers are surfaced', async () => {
  const headers = ['schema_version', 'event_id', 'event_type', 'student_id', 'created_at', 'payload_json'];
  let rows = [headers, ['2', 'saved-memo', 'memo', 'slide:original-slide', '2026-10-09T01:00:00Z', JSON.stringify({ text: '교사 비공개 메모' })]];
  const api = createGoogleReader('test-token', async (url, options) => {
    assert.equal(options.method, 'GET');
    const path = new URL(url).pathname;
    const result = path === '/drive/v3/files' ? { files: [{ id: 'private-store' }] } : path.includes('/values/') ? { values: rows } : { id: 'private-store', ownedByMe: true, appProperties: { sourceSheet: 'original-sheet' }, permissions: [{ type: 'user', role: 'owner' }] };
    return { ok: true, json: async () => result };
  });
  assert.equal((await api.loadWorkspace('original-sheet')).events[0].payload.text, '교사 비공개 메모');
  rows = [];
  await assert.rejects(api.loadWorkspace('original-sheet'), /헤더/);
});

test('legacy assignment cover reads only the first page of one linked student deck', async () => {
  const calls = [];
  const api = createGoogleReader('test-token', async (url, options) => {
    const parsed = new URL(url); calls.push({ url: parsed, options });
    return { ok: true, json: async () => parsed.pathname.endsWith('/thumbnail') ? { contentUrl: 'https://lh3.googleusercontent.com/first-page', width: 800, height: 450 } : { slides: [{ objectId: 'first-page' }, { objectId: 'last-page' }] } };
  });
  const assignment = { id: 'original-sheet', summary: { studentCount: 30, linkedCount: 30, coverSlideId: 'one-deck' } };
  const snapshot = JSON.stringify(assignment);
  const cover = await api.loadAssignmentCover(assignment);
  assert.equal(cover.source, 'student');
  assert.equal(cover.url, 'https://lh3.googleusercontent.com/first-page');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, '/v1/presentations/one-deck');
  assert.equal(calls[0].url.searchParams.get('fields'), 'slides(objectId)');
  assert.equal(calls[1].url.pathname, '/v1/presentations/one-deck/pages/first-page/thumbnail');
  assert.equal(calls[1].url.searchParams.get('thumbnailProperties.thumbnailSize'), 'MEDIUM');
  assert.ok(calls.every(({ options }) => options.method === 'GET'));
  assert.equal(JSON.stringify(assignment), snapshot);
});

test('new assignment covers prefer the frozen distribution template over a student deck', async () => {
  const calls = [];
  const api = createGoogleReader('test-token', async (url) => {
    const parsed = new URL(url); calls.push(parsed);
    return { ok: true, json: async () => parsed.pathname === '/drive/v3/files' ? { files: [{ id: 'frozen-template' }] } : parsed.pathname.endsWith('/thumbnail') ? { contentUrl: 'https://lh3.googleusercontent.com/template-page', width: 800, height: 450 } : { slides: [{ objectId: 'template-first' }] } };
  });
  assert.equal((await api.loadAssignmentCover({ coverSlideId: 'frozen-template', summary: { coverSlideId: 'student-deck' } })).source, 'template');
  assert.equal(calls[0].pathname, '/v1/presentations/frozen-template');
  calls.length = 0;
  assert.equal((await api.loadAssignmentCover({ creationId: 'old-job', summary: { coverSlideId: 'student-deck' } })).source, 'template');
  assert.match(calls[0].searchParams.get('q'), /old-job:template/);
  assert.equal(calls[1].pathname, '/v1/presentations/frozen-template');
});

test('missing decks cause no cover calls, while empty or failed thumbnails are explicit', async () => {
  let calls = 0;
  const api = createGoogleReader('test-token', async () => { calls++; return { ok: true, json: async () => ({ slides: [] }) }; });
  assert.equal(await api.loadAssignmentCover({ summary: { linkedCount: 0 } }), null);
  assert.equal(calls, 0);
  await assert.rejects(api.loadAssignmentCover({ coverSlideId: 'empty-deck' }), /첫 장/);
  const expired = createGoogleReader('test-token', async () => ({ ok: false, status: 401 }));
  await assert.rejects(expired.loadAssignmentCover({ coverSlideId: 'one-deck' }), /만료/);
  const invalid = createGoogleReader('test-token', async (url) => ({ ok: true, json: async () => url.endsWith('fields=slides%28objectId%29') ? { slides: [{ objectId: 'first' }] } : { contentUrl: 'javascript:alert(1)', width: 800, height: 450 } }));
  await assert.rejects(invalid.loadAssignmentCover({ coverSlideId: 'one-deck' }), /첫 장/);
});

test('a new assignment with a missing template never substitutes a student cover', async () => {
  const calls = [];
  const reader = createGoogleReader('test-token', async (url) => { calls.push(new URL(url)); return { ok: true, json: async () => ({ files: [] }) }; });
  await assert.rejects(reader.loadAssignmentCover({ creationId: 'new-job', summary: { coverSlideId: 'student-deck' } }), /예시 슬라이드/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'www.googleapis.com');
});
