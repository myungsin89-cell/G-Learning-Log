import test from 'node:test';
import assert from 'node:assert/strict';
import { isTextSurge, parseRosterInput, studentLabel, unreadStudentReplies, unreadCommentActivity, pendingCommentActivity, pendingCommentMessages, authorRole, createSummaryCsv, createAnalysisExport } from '../src/lib/workRecords.mjs';

test('a gap or unknown baseline must not be classified as a text surge', () => {
  const change = { charDelta: 500, previousCheckedAt: '2026-10-01T10:00:00Z', checkedAt: '2026-10-04T10:00:00Z', continuous: true };
  assert.equal(isTextSurge(change), false);
  assert.equal(isTextSurge({ ...change, previousCheckedAt: null }), false);
  const short = { ...change, checkedAt: '2026-10-01T10:00:25Z' };
  assert.equal(isTextSurge(short), true);
  assert.equal(isTextSurge({ ...short, continuous: false }), false);
});

test('roster gaps retain attendance numbers, and duplicates are rejected', () => {
  const roster = parseRosterInput('1 달토끼\n2 별빛\n4 송명신');
  assert.equal(roster[2].number, 4);
  assert.equal(studentLabel(roster[2]), '4번 송명신');
  assert.throws(() => parseRosterInput('1 달토끼\n1 별빛'));
});

test('teacher and unknown replies never count as new student replies', () => {
  const threads = [{ replies: ['teacher', 'unknown', 'student'].map((role) => ({ role, createdAt: '2026-10-08T12:00:00Z' })) }];
  assert.equal(unreadStudentReplies(threads, null), 1);
  assert.equal(unreadStudentReplies(threads, '2026-10-08T12:01:00Z'), 0);
  assert.equal(authorRole({ me: true, displayName: '교사' }), 'teacher');
  assert.equal(authorRole({ me: false, displayName: '다른 사용자' }), 'other');
  assert.equal(authorRole({}), 'unknown');
});

test('new top-level comments and replies stay visible before author confirmation', () => {
  const earlier = '2026-10-08T11:00:00Z', later = '2026-10-08T12:00:00Z';
  const threads = [
    { role: 'other', createdAt: later, replies: [{ role: 'unknown', createdAt: later }, { role: 'teacher', createdAt: later }] },
    { role: 'student', createdAt: later, replies: [{ role: 'student', createdAt: earlier }] },
    { role: 'teacher', createdAt: earlier, replies: [] },
    { role: 'unknown', origin: 'stored_feedback', createdAt: later, replies: [] },
  ];
  assert.deepEqual(unreadCommentActivity(threads, earlier), { total: 3, student: 1, unclassified: 2 });
  assert.deepEqual(unreadCommentActivity(threads, '2026-10-08T13:00:00Z'), { total: 0, student: 0, unclassified: 0 });
});

test('older unanswered comments remain pending after they are read, and a later teacher reply clears them', () => {
  const threads = [
    { id: 'first', role: 'other', createdAt: '2026-10-07T10:00:00Z', replies: [] },
    { id: 'second', role: 'teacher', createdAt: '2026-10-07T10:00:00Z', replies: [
      { id: 'student-answer', role: 'student', createdAt: '2026-10-07T10:05:00Z' },
      { id: 'teacher-answer', role: 'teacher', createdAt: '2026-10-07T10:10:00Z' },
      { id: 'follow-up', role: 'student', createdAt: '2026-10-07T10:15:00Z' },
    ] },
  ];
  assert.deepEqual(unreadCommentActivity(threads, '2026-10-08T12:00:00Z'), { total: 0, student: 0, unclassified: 0 });
  assert.deepEqual(pendingCommentMessages(threads).map((message) => message.id), ['first', 'follow-up']);
  assert.deepEqual(pendingCommentActivity(threads), { total: 2, student: 1, unclassified: 1 });
  threads[0].replies.push({ id: 'reply', role: 'teacher', createdAt: '2026-10-08T13:00:00Z' });
  assert.deepEqual(pendingCommentActivity(threads), { total: 1, student: 1, unclassified: 0 });
});

test('CSV preserves multiline Korean text and neutralizes spreadsheet formulas', () => {
  const students = [{ number: 4, name: '=1+1', chars: 20, slides: 3, images: 1 }];
  const csv = createSummaryCsv(students, { keywords: ['달'], threads: {}, memos: { 4: '관찰 "메모"\n다음 기록' }, matched: () => ['달'] });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"관찰 ""메모""\n다음 기록"'));
});

test('AI export retains unknown amounts and gap provenance without scores', () => {
  const students = [{ number: 4, name: '송명신', chars: 256, slides: 2, images: 0, projectRecords: [{ source: 'gap_comparison', charsAdded: null, charsRemoved: null, charDelta: 256 }] }];
  const data = createAnalysisExport({ className: '5학년 2반', assignment: { name: '달 관찰' }, students, keywords: [], threads: {}, memos: {}, readAt: {}, reviewed: [], mode: 'project', matched: () => [] });
  assert.equal(data.students[0].records[0].charsAdded, null);
  assert.equal(data.students[0].records[0].source, 'gap_comparison');
  assert.equal(data.collection.backgroundCollection, false);
  assert.ok(!JSON.stringify(data).includes('focusRatio'));
});
