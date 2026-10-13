import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentWithSettings, assignmentDetailsPayload } from '../src/lib/assignmentDetails.mjs';
import { foldWorkspace } from '../src/lib/liveWorkRecords.mjs';

const event = (id, payload) => ({ id, type: 'settings', studentId: '', createdAt: '2026-10-13T00:00:00Z', payload });

test('card title and keywords restore from private settings while original file identity stays intact', () => {
  const assignment = { id: 'source-sheet', name: '달 관찰', creationId: 'job' };
  const settings = foldWorkspace([event('created', { keywords: ['달'] }), event('edited', { title: '오늘의 달', keywords: ['달', '그림자'] })]).settings;
  const restored = assignmentWithSettings(assignment, settings);
  assert.deepEqual([restored.id, restored.sourceName, restored.name, restored.keywords], ['source-sheet', '달 관찰', '오늘의 달', ['달', '그림자']]);
  assert.equal(assignment.name, '달 관찰');
  assert.equal(assignmentWithSettings(restored, { title: '다시 수정' }).sourceName, '달 관찰');
});

test('assignment edits validate title and normalize keyword list before saving', () => {
  assert.deepEqual(assignmentDetailsPayload('  오늘의 달  ', [' 달 ', '달', ' 그림자 ']), { title: '오늘의 달', keywords: ['달', '그림자'] });
  assert.throws(() => assignmentDetailsPayload('', []), /이름/);
  assert.throws(() => assignmentDetailsPayload('잘못된/이름', []), /이름/);
  assert.throws(() => assignmentDetailsPayload('달', ['가'.repeat(501)]), /500자/);
});

test('student link metadata saved in settings is retained for title synchronization', () => {
  const assignment = { id: 'source-sheet', name: '달 관찰' };
  const studentEntry = { mode: 'shared', id: 'public-picker' };
  assert.deepEqual(assignmentWithSettings(assignment, { title: '새 제목', studentEntry }).studentEntry, studentEntry);
});
