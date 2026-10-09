import test from 'node:test';
import assert from 'node:assert/strict';
import { compactChartBins, legacyChangeBins, studentActivityTimeline } from '../src/lib/recordChart.mjs';
import { makeObservation } from '../src/lib/liveWorkRecords.mjs';

const baseline = { chars: 1430, images: 41, slides: 10, recordedAt: '2026-09-07T04:46:38Z' };
const row = (id, checkedAt, charCount, imageCount = 42) => ({ id, source: 'legacy_unverified', checkedAt, charCount, imageCount, slideCount: 10, charDelta: null });

test('initial template and existing content become a reference, not a work spike', () => {
  const records = [row('first', '2026-09-06T14:00:00Z', 1731), row('second', '2026-09-06T14:30:00Z', 1751)];
  const before = JSON.stringify(records);
  const bins = legacyChangeBins(records, 'charCount', 'record', baseline);
  assert.equal(bins[0].added, 0); assert.equal(bins[0].removed, 0); assert.equal(bins[0].reference, true);
  assert.equal(bins[1].added, 20);
  assert.equal(JSON.stringify(records), before);
  assert.equal(records[0].charDelta, null);
});

test('crossing the saved template correction does not create a 1430-character deletion', () => {
  const records = [row('first', '2026-09-06T14:00:00Z', 1731), row('second', '2026-09-09T00:15:57Z', 288, 1)];
  const chars = legacyChangeBins(records, 'charCount', 'day', baseline);
  assert.equal(chars[1].removed, 13); assert.equal(chars[1].comparisons[0].templateAdjusted, true);
  assert.equal(legacyChangeBins(records, 'imageCount', 'day', baseline)[1].removed, 0);
  assert.equal(legacyChangeBins(records, 'slideCount', 'day', baseline)[1].added, 0);
});

test('a blank file acquiring the initial template is not a 1550-character work burst', () => {
  const records = [row('blank', '2026-09-03T14:00:00Z', 23, 2), row('template', '2026-09-06T14:00:00Z', 1573, 45)];
  const bins = legacyChangeBins(records, 'charCount', 'record', baseline);
  assert.equal(bins[1].added, 0);
  assert.equal(bins[1].comparisons[0].templateReference, true);
  assert.equal(bins[1].comparisons[0].difference, null);
  assert.equal(legacyChangeBins(records, 'imageCount', 'record', baseline)[1].added, 0);
});

test('already excluded counts are never reduced twice; ambiguous template changes stay unknown', () => {
  const small = [row('a', '2026-09-02T14:00:00Z', 23, 2), row('b', '2026-09-08T14:00:00Z', 34, 3)];
  assert.equal(legacyChangeBins(small, 'charCount', 'day', baseline)[1].added, 11);
  const uncertain = [row('a', '2026-09-06T14:00:00Z', 1573, 45), row('b', '2026-09-08T14:00:00Z', 1573, 11)];
  const bins = legacyChangeBins(uncertain, 'charCount', 'day', baseline);
  assert.equal(bins[1].added, 0); assert.equal(bins[1].removed, 0); assert.equal(bins[1].unknown, 1);
});

test('daily bars show the recorded increases and decreases, without spreading a multi-day gap', () => {
  const records = [row('a', '2026-10-01T00:00:00Z', 200), row('b', '2026-10-04T00:00:00Z', 250), row('c', '2026-10-04T00:30:00Z', 230)];
  const bins = legacyChangeBins(records);
  assert.equal(bins.length, 2); assert.equal(bins[1].added, 50); assert.equal(bins[1].removed, 20);
  assert.equal(bins[1].start, records[0].checkedAt);
  assert.deepEqual(bins[1].records.map((record) => record.id), ['b', 'c']);
  assert.equal(legacyChangeBins([row('a', null, 200), row('b', '2026-10-04T00:00:00Z', null), row('c', '2026-10-05T00:00:00Z', 240)])[1].unknown, 1);
});

test('a long assignment fits one plot with every original record and amount preserved', () => {
  const records = Array.from({ length: 200 }, (_, index) => row(`r${index}`, new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), index * 2));
  const bins = legacyChangeBins(records), compact = compactChartBins(bins);
  assert.ok(compact.length <= 48);
  assert.equal(compact.flatMap((bin) => bin.records).length, 200);
  assert.equal(compact.reduce((sum, bin) => sum + bin.added, 0), 398);
  assert.equal(compact[0].start, records[0].checkedAt);
  assert.equal(compact.at(-1).end, records.at(-1).checkedAt);
});

test('one timeline retains image-only work and excludes initial states across both formats', () => {
  const records = [row('a', '2026-09-02T14:00:00Z', 23, 2), row('b', '2026-09-08T14:00:00Z', 34, 3), row('c', '2026-09-13T14:00:00Z', 34, 4),
    { id: 'snapshot', source: 'first_snapshot', checkedAt: '2026-10-09T00:00:00Z', charCount: 1047, imageCount: 50, slideCount: 10, charDelta: null },
    { id: 'new', source: 'gap_comparison', previousCheckedAt: '2026-10-09T00:00:00Z', checkedAt: '2026-10-10T00:00:00Z', charDelta: 20, imageDelta: 0, slideDelta: 1 }];
  const before = JSON.stringify(records), timeline = studentActivityTimeline(records, baseline);
  assert.deepEqual(timeline.bins.map((bin) => [bin.added, bin.imageAdded, bin.slideAdded]), [[11, 1, 0], [0, 1, 0], [20, 0, 1]]);
  assert.equal(timeline.bins.flatMap((bin) => bin.activities).length, 3);
  assert.equal(timeline.start, records[0].checkedAt); assert.equal(timeline.end, records.at(-1).checkedAt);
  assert.equal(JSON.stringify(records), before);
});

test('template acquisition also excludes the initial slide bundle from work', () => {
  const records = [{ ...row('blank', '2026-09-03T14:00:00Z', 23, 2), slideCount: 1 }, row('template', '2026-09-06T14:00:00Z', 1573, 45)];
  assert.equal(studentActivityTimeline(records, baseline).bins.length, 0);
});

test('point details retain known page changes and both additions and deletions', () => {
  const records = [{ id: 'a', source: 'first_snapshot', checkedAt: '2026-10-01T00:00:00Z', pages: [{ id: 'p1', number: 1, chars: 100, images: 2 }, { id: 'p2', number: 2, chars: 50, images: 1 }] },
    { id: 'b', source: 'continuous_poll', previousCheckedAt: '2026-10-01T00:00:00Z', checkedAt: '2026-10-01T00:00:30Z', charDelta: 0, imageDelta: 0, slideDelta: 0, pages: [{ id: 'p1', number: 1, chars: 120, images: 2 }, { id: 'p3', number: 2, chars: 30, images: 1 }] },
    { id: 'c', source: 'continuous_poll', previousCheckedAt: '2026-10-01T00:00:30Z', checkedAt: '2026-10-01T00:01:00Z', charDelta: -5, imageDelta: -1, slideDelta: 0, pages: [{ id: 'p1', number: 1, chars: 115, images: 1 }, { id: 'p3', number: 2, chars: 30, images: 1 }] }];
  const { bins } = studentActivityTimeline(records);
  assert.equal(bins.length, 1); assert.equal(bins[0].removed, 5); assert.equal(bins[0].imageRemoved, 1);
  assert.deepEqual(bins[0].activities[0].pages.map((page) => page.kind), ['changed', 'added', 'removed']);
  assert.equal(bins[0].activities[0].pages[0].chars, 20);
});

test('long timelines retain all non-text amounts and point details after compaction', () => {
  const records = Array.from({ length: 201 }, (_, index) => row(`r${index}`, new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), index * 2, index + 1));
  const { bins } = studentActivityTimeline(records);
  assert.ok(bins.length <= 48); assert.equal(bins.flatMap((bin) => bin.activities).length, 200);
  assert.equal(bins.reduce((sum, bin) => sum + bin.added, 0), 400);
  assert.equal(bins.reduce((sum, bin) => sum + bin.imageAdded, 0), 200);
});

test('Dahyun-style backfilled rows never imply text was unchanged or estimate the missing writing', () => {
  const inferred = (id, checkedAt, charCount, images) => ({ ...row(id, checkedAt, charCount, images), raw: ['학생', checkedAt, String(charCount), '11', String(images), '3', '[편집] 슬라이드 개체 및 이미지 자료 배치'] });
  const records = [inferred('a', '2026-09-13T23:06:19Z', 13, 2), inferred('b', '2026-09-17T23:03:28Z', 13, 3), inferred('c', '2026-09-20T12:30:43Z', 13, 4), inferred('d', '2026-09-27T12:17:16Z', 50, 5)];
  const original = JSON.stringify(records), timeline = studentActivityTimeline(records, baseline);
  assert.equal(timeline.textUncertain, true);
  assert.equal(timeline.bins.length, 3);
  assert.ok(timeline.bins.every((bin) => bin.textUncertain && bin.added === 0 && bin.removed === 0 && bin.imageAdded === 1));
  assert.ok(timeline.bins.flatMap((bin) => bin.activities).every((activity) => activity.deltas[0] === null));
  assert.equal(JSON.stringify(records), original);
});

test('the first template bundle can include an existing image, without becoming a work spike', () => {
  const records = [row('blank', '2026-09-03T13:49:27Z', 23, 1), row('template', '2026-09-06T23:14:20Z', 1527, 41)];
  const { bins } = studentActivityTimeline(records, baseline);
  assert.equal(bins.length, 0);
});

test('new whole-count observations capture writing even while totals remain below the old template', () => {
  const presentation = (checkedAt, chars, images) => ({ checkedAt, charCount: chars, imageCount: images, slideCount: 11, pages: [{ id: 'page', number: 1, text: '학생 관찰 글', notes: '', chars, images }] });
  const first = makeObservation(presentation('2026-10-09T00:00:00Z', 1026, 48), null, { sessionId: 'check' });
  const second = makeObservation(presentation('2026-10-12T00:00:00Z', 1126, 49), first, { sessionId: 'next' });
  const { bins } = studentActivityTimeline([{ ...first, id: 'first' }, { ...second, id: 'second' }], baseline);
  assert.equal(second.charDelta, 100);
  assert.equal(bins[0].added, 100); assert.equal(bins[0].imageAdded, 1);
  assert.equal(bins[0].textUncertain, false);
  assert.deepEqual(bins[0].activities[0].pages, [{ number: 1, kind: 'changed', chars: 100, images: 1 }]);
});
