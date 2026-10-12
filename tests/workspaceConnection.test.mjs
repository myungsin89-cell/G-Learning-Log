import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceConnection } from '../src/lib/workspaceConnection.mjs';
import { StudentCollectionGate } from '../src/lib/studentCollection.mjs';
import { foldWorkspace } from '../src/lib/liveWorkRecords.mjs';

test('automatic setup and a simultaneous control share one initialization with no extra OAuth or private store', async () => {
  const connection = new WorkspaceConnection(); let release;
  const saved = new Promise((resolve) => { release = resolve; }); let authorizations = 0, initializations = 0;
  const authorize = async (options) => {
    assert.equal(options.interactive, false); authorizations++;
    return { initialize: async () => { initializations++; return saved; } };
  };
  const opening = connection.connect(authorize, { interactive: false });
  const stopping = connection.connect(() => assert.fail('No second login while setup is in flight'), { interactive: true });
  release({ events: [], storeId: 'private' });
  assert.equal((await opening), (await stopping)); assert.equal(authorizations, 1); assert.equal(initializations, 1);
});

test('failed automatic setup can be retried by a user without leaving a permanently pending connection', async () => {
  const connection = new WorkspaceConnection();
  await assert.rejects(connection.connect(async () => { throw new Error('Expired'); }, { interactive: false }), /Expired/);
  const result = await connection.connect(async (options) => {
    assert.equal(options.interactive, true); return { initialize: async () => ({ events: [], storeId: 'private' }) };
  }, { interactive: true });
  assert.equal(result.result.storeId, 'private');
});

test('restoring an ended assignment or a stopped student blocks monitoring before source reads', async () => {
  const connection = new WorkspaceConnection(), gate = new StudentCollectionGate();
  const result = await connection.connect(async () => ({ initialize: async () => ({ events: [
    { id: 'end', type: 'settings', studentId: '', payload: { monitoringEnded: true } },
    { id: 'student-stop', type: 'collection', studentId: 'slide:a', payload: { paused: true } },
  ] }) }), { interactive: false });
  const state = foldWorkspace(result.result.events); gate.restore(state.collectionPaused, state.seen, state.settings.monitoringEnded);
  assert.equal(gate.ended(), true);
  await assert.rejects(gate.read('slide:b', () => assert.fail('No read before explicit resume')), /모니터링을 종료/);
  gate.setEnded(false);
  assert.equal(gate.ticket('slide:a'), null); assert.ok(gate.ticket('slide:b'));
});
