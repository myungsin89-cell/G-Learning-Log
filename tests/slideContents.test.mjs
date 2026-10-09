import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptPresentation, parsePresentationId } from '../src/lib/slideContents.mjs';
import { createGoogleReader } from '../src/lib/googleReadOnly.mjs';
import { adaptStoredAssignment, createStoredAnalysisExport } from '../src/lib/storedWorkRecords.mjs';

const text = (...parts) => ({ textElements: parts.map((content) => ({ textRun: { content } })) });
const fixture = () => ({ presentationId: 'original-slide', title: '달 관찰', slides: [
  { objectId: 'page-1', pageElements: [
    { elementGroup: { children: [{ shape: { text: text('달', '의 모양\n') } }, { image: {} }] } },
    { table: { tableRows: [{ tableCells: [{ text: text('관찰 날짜') }, { text: text('10월 9일') }] }] } },
    { wordArt: { renderedText: '초승달' } },
  ], slideProperties: { notesPage: { pageElements: [
    { shape: { placeholder: { type: 'BODY' }, text: text('관찰 노트') } },
    { shape: { placeholder: { type: 'SLIDE_NUMBER' }, text: text('1') } },
  ] } } },
  { objectId: 'page-2', pageElements: [{ image: {} }] },
] });

test('current content covers formatted runs, groups, tables, word art, notes and image-only pages', () => {
  const original = fixture();
  const before = JSON.stringify(original);
  const data = adaptPresentation(original, '2026-10-09T00:00:00Z');
  assert.equal(JSON.stringify(original), before);
  assert.equal(data.pages[0].text, '달의 모양\n관찰 날짜\t10월 9일\n초승달');
  assert.equal(data.pages[0].notes, '관찰 노트');
  assert.equal(data.charCount, '달의모양관찰날짜10월9일초승달관찰노트'.length);
  assert.equal(data.imageCount, 2);
  assert.equal(data.slideCount, 2);
  assert.equal(data.pages[1].text, '');
  assert.equal(data.source, 'on_demand_google_slides');
  assert.ok(!('lastEditedPage' in data));
});

test('saved Google slide URLs are accepted without trusting unrelated URL hosts', () => {
  assert.equal(parsePresentationId('', 'https://docs.google.com/presentation/d/real-id/edit#slide=id.page'), 'real-id');
  assert.equal(parsePresentationId(' https://docs.google.com/presentation/u/0/d/real-id/edit '), 'real-id');
  assert.equal(parsePresentationId(' https://evil.example/presentation/d/unsafe/edit ', 'https://docs.google.com/presentation/d/safe/edit'), 'safe');
  assert.equal(parsePresentationId('https://docs.google.com.evil.example/presentation/d/unsafe/edit'), null);
  assert.equal(parsePresentationId('javascript:alert(1)'), null);
  const data = adaptStoredAssignment({ className: '학급', assignment: {}, studentRows: [['number', 'name'], [4, '이름', '', 'https://docs.google.com/presentation/d/original-slide/edit']], logRows: [] });
  assert.equal(data.students[0].slideId, 'original-slide');
});

test('one current presentation is read with GET and exported separately from stored history', async () => {
  const calls = [];
  const api = createGoogleReader('test-token', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => fixture() };
  });
  const current = await api.loadPresentation('original-slide');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://slides.googleapis.com/v1/presentations/original-slide');
  assert.equal(calls[0].options.method, 'GET');
  const data = adaptStoredAssignment({ className: '학급', assignment: {}, studentRows: [['number', 'name'], [4, '이름', 'original-slide', '', '', '', 256, 10, 3], [5, '다른 학생', 'unopened']], logRows: [] });
  const exported = createStoredAnalysisExport(data, data.threads, [], { 'row-2': { data: current } });
  assert.equal(exported.students[0].chars, 256);
  assert.equal(exported.students[0].slides, 10);
  assert.equal(exported.students[0].records.length, 0);
  assert.equal(exported.students[0].currentPresentation.slideCount, 2);
  assert.equal(exported.students[1].currentPresentation, null);
  assert.equal(exported.collection.backgroundCollection, false);
});

test('failed slide access is surfaced instead of falling back to example content', async () => {
  const api = createGoogleReader('test-token', async () => ({ ok: false, status: 403 }));
  await assert.rejects(api.loadPresentation('original-slide'), { status: 403 });
  assert.throws(() => adaptPresentation({}), /슬라이드 본문/);
});
