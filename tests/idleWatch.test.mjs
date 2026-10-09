import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceIdleWatch, idleWatchMinutes } from '../src/lib/idleWatch.mjs';

const start = Date.parse('2026-10-09T01:00:00Z');
const snapshot = (seconds, extra = {}) => ({ sessionId: 'lesson', source: 'continuous_poll',
  checkedAt: new Date(start + seconds * 1000).toISOString(),
  previousCheckedAt: new Date(start + (seconds - 30) * 1000).toISOString(),
  charDelta: 0, imageDelta: 0, slideDelta: 0, ...extra });
const streak = (seconds) => {
  let track = null;
  for (let time = 0; time <= seconds; time += 30) track = advanceIdleWatch(track, snapshot(time));
  return track;
};

test('the watch starts at its own first check and qualifies only after 15 observed minutes', () => {
  const first = advanceIdleWatch(null, snapshot(900));
  assert.equal(idleWatchMinutes(first, start + 900000), null);
  assert.equal(idleWatchMinutes(streak(870), start + 870000), null);
  assert.equal(idleWatchMinutes(streak(900), start + 900000), 15);
  assert.equal(idleWatchMinutes(streak(960), start + 960000), 16);
});

test('a change to text, images or slides immediately clears the cue and restarts its duration', () => {
  for (const field of ['charDelta', 'imageDelta', 'slideDelta']) {
    for (const amount of [1, -1]) {
      const changed = advanceIdleWatch(streak(900), snapshot(930, { [field]: amount }));
      assert.equal(changed.since, start + 930000);
      assert.equal(idleWatchMinutes(changed, start + 930000), null);
      const next = advanceIdleWatch(changed, snapshot(960));
      assert.equal(next.since, changed.since);
    }
  }
});

test('manual checks, a new live session, long gaps and mismatched previous checks never join old idle time', () => {
  for (const current of [snapshot(930, { source: 'gap_comparison' }),
    snapshot(930, { sessionId: 'new-lesson' }), snapshot(990),
    snapshot(930, { previousCheckedAt: new Date(start + 870000).toISOString() }),
    snapshot(900)]) {
    const track = advanceIdleWatch(streak(900), current);
    assert.equal(track.since, Date.parse(current.checkedAt));
    assert.equal(idleWatchMinutes(track, track.checkedAt), null);
  }
});

test('missing change values and failed or stale checks cannot keep an inactivity cue', () => {
  const old = streak(900);
  assert.equal(idleWatchMinutes(old, old.checkedAt + 60001), null);
  assert.equal(idleWatchMinutes(old, old.checkedAt - 1), null);
  assert.equal(idleWatchMinutes(null, start + 900000), null);
  assert.equal(advanceIdleWatch(old, snapshot(930, { checkedAt: 'invalid' })), null);
  assert.equal(advanceIdleWatch(old, snapshot(930, { sessionId: null })), null);
  const unknown = advanceIdleWatch(old, snapshot(930, { charDelta: null }));
  assert.equal(idleWatchMinutes(unknown, unknown.checkedAt), null);
});

test('resetting or enabling the optional watch discards prior time and never mutates snapshots', () => {
  const record = snapshot(930);
  const original = JSON.stringify(record);
  const track = advanceIdleWatch(null, record);
  assert.equal(idleWatchMinutes(track, track.checkedAt), null);
  assert.equal(JSON.stringify(record), original);
});
