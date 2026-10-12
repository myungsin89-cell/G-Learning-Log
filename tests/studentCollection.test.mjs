import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentCollectionGate, CollectionStoppedError } from '../src/lib/studentCollection.mjs';
import { foldWorkspace, eventRow, parseWorkspaceEvents, makeObservation } from '../src/lib/liveWorkRecords.mjs';

const key = 'slide:student-a';
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const change = (id, paused) => ({ id, type: 'collection', studentId: key, createdAt: '2026-10-12T02:00:00Z', payload: { paused } });

test('saved pause survives reload without erasing prior snapshots or teacher notes', () => {
  const snapshot = { id: 'old', type: 'snapshot', studentId: key, createdAt: '2026-10-12T01:00:00Z', payload: { checkedAt: '2026-10-12T01:00:00Z', charCount: 10, imageCount: 1, slideCount: 2 } };
  const before = [snapshot, { ...change('note', false), type: 'memo', payload: { text: '보존할 교사 메모' } }, change('stop', true)];
  const state = foldWorkspace(parseWorkspaceEvents([['schema_version', 'event_id', 'event_type', 'student_id', 'created_at', 'payload_json'], ...before.map(eventRow)]).events);
  const gate = new StudentCollectionGate(); gate.restore(state.collectionPaused);
  assert.equal(gate.ticket(key), null);
  assert.equal(state.records[key].length, 1); assert.equal(state.memos[key], '보존할 교사 메모');
  gate.restore(foldWorkspace([...before, change('resume', false)]).collectionPaused);
  assert.ok(gate.ticket(key));
});

test('automatic, manual and comment reads are blocked before any source request for a stopped student', async () => {
  const gate = new StudentCollectionGate();
  await assert.rejects(gate.read(key, () => assert.fail('No request before restoring controls')), CollectionStoppedError);
  gate.restore({ [key]: true });
  for (const purpose of ['automatic snapshot', 'manual body', 'comments']) {
    await assert.rejects(gate.read(key, () => assert.fail(`No ${purpose} request`)), CollectionStoppedError);
  }
  let otherReads = 0;
  await gate.read('slide:student-b', async () => { otherReads++; return 'other'; });
  assert.equal(otherReads, 1);
});

test('late body and comment responses are rejected after pause, including a rapid resume', async () => {
  for (const resume of [false, true]) {
    const gate = new StudentCollectionGate(); gate.restore();
    const body = deferred(), comments = deferred();
    const results = Promise.allSettled([gate.read(key, () => body.promise), gate.read(key, () => comments.promise)]);
    gate.setPaused(key, true); if (resume) gate.setPaused(key, false);
    body.resolve('late body'); comments.resolve('late comments');
    assert.ok((await results).every((result) => result.status === 'rejected' && result.reason instanceof CollectionStoppedError));
  }
});

test('local stop stays in force after failed persistence or older hydration; resume breaks continuous observation', async () => {
  const gate = new StudentCollectionGate(); gate.restore();
  const first = gate.ticket(key);
  gate.setPaused(key, true); gate.restore({});
  assert.equal(gate.ticket(key), null);
  gate.restore({ [key]: true }); gate.setPaused(key, false);
  const next = gate.ticket(key);
  assert.notEqual(next.revision, first.revision); assert.equal(gate.accepts(first), false);
  const previous = { checkedAt: '2026-10-12T00:00:00Z', charCount: 10, imageCount: 0, slideCount: 1, sessionId: 'lesson' };
  const observation = makeObservation({ checkedAt: '2026-10-12T00:00:30Z', charCount: 20, imageCount: 0, slideCount: 1, pages: [] }, previous, { sessionId: 'lesson', continuous: first.revision === next.revision });
  assert.equal(observation.source, 'gap_comparison');
});

test('older hydration cannot erase a confirmed stop, while later saved controls from another session are accepted', () => {
  const gate = new StudentCollectionGate(); gate.restore(); gate.setPaused(key, true); gate.confirm(key, 'own-stop', true);
  gate.restore({}, new Set()); assert.equal(gate.ticket(key), null);
  gate.restore({ [key]: false }, new Set(['own-stop', 'later-resume'])); assert.ok(gate.ticket(key));
  gate.setPaused(key, false); gate.confirm(key, 'own-resume', false);
  gate.restore({ [key]: true }, new Set(['own-stop', 'own-resume', 'later-stop'])); assert.equal(gate.ticket(key), null);
});
