export const IDLE_REVIEW_MS = 15 * 60 * 1000;
const MAX_CHECK_GAP_MS = 60 * 1000;

// This track belongs only to the current live watch. Saved history never seeds it.
export function advanceIdleWatch(previous, snapshot) {
  const checkedAt = Date.parse(snapshot.checkedAt);
  if (!Number.isFinite(checkedAt) || !snapshot.sessionId) return null;
  const gap = previous ? checkedAt - previous.checkedAt : null;
  const continuous = previous && snapshot.source === 'continuous_poll'
    && previous.sessionId === snapshot.sessionId
    && Date.parse(snapshot.previousCheckedAt) === previous.checkedAt
    && gap > 0 && gap <= MAX_CHECK_GAP_MS;
  const unchanged = ['charDelta', 'imageDelta', 'slideDelta'].every((key) => snapshot[key] === 0);
  return { sessionId: snapshot.sessionId, checkedAt,
    since: continuous && unchanged ? previous.since : checkedAt };
}

export function idleWatchMinutes(track, now) {
  if (!track || !Number.isFinite(now) || now < track.checkedAt || now - track.checkedAt > MAX_CHECK_GAP_MS) return null;
  const elapsed = track.checkedAt - track.since;
  return elapsed >= IDLE_REVIEW_MS ? Math.floor(elapsed / 60000) : null;
}
