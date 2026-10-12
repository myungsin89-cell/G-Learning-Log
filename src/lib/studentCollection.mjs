export class CollectionStoppedError extends Error {
  constructor(ready, ended = false) { super(ended ? '모니터링을 종료했습니다. 저장된 기록만 확인할 수 있습니다.' : ready ? '기록 중지 학생입니다. 재개하면 새 작업과 댓글을 확인할 수 있습니다.' : '기록 수집 상태를 먼저 확인해야 합니다. 저장 권한 연결 또는 새로고침으로 다시 확인해 주세요.'); this.name = 'CollectionStoppedError'; }
}

// Revisions reject an old response even if a student was paused and resumed
// before that response arrived. Local choices survive older hydration results.
export class StudentCollectionGate {
  ready = false;
  saved = {};
  overrides = new Map();
  barriers = new Map();
  revisions = new Map();
  monitoringSaved = false;
  monitoringOverride = null;
  monitoringBarrier = null;
  monitoringRevision = 0;
  ended() { return this.monitoringOverride ?? this.monitoringSaved; }
  setEnded(ended) { this.monitoringOverride = ended; this.monitoringRevision++; }
  confirmEnded(id, ended) { this.monitoringSaved = ended; this.monitoringOverride = null; this.monitoringBarrier = { id, ended }; }
  restore(saved = {}, seen = new Set(), ended = false) {
    const before = this.paused();
    const wasEnded = this.ended();
    this.monitoringSaved = this.monitoringBarrier && !seen.has(this.monitoringBarrier.id) ? this.monitoringBarrier.ended : ended;
    if (wasEnded !== this.ended()) this.monitoringRevision++;
    this.saved = { ...saved }; this.ready = true;
    for (const [key, control] of this.barriers) if (!seen.has(control.id)) this.saved[key] = control.paused;
    const after = this.paused();
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (Boolean(before[key]) !== Boolean(after[key])) this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
    }
  }
  paused() { return { ...this.saved, ...Object.fromEntries(this.overrides) }; }
  setPaused(key, paused) {
    if (!key) throw new Error('학생 슬라이드를 먼저 연결해 주세요.');
    this.overrides.set(key, paused);
    this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
  }
  confirm(key, id, paused) { this.saved[key] = paused; this.overrides.delete(key); this.barriers.set(key, { id, paused }); }
  ticket(key) { return this.ready && !this.ended() && key && !this.paused()[key] ? { key, revision: this.revisions.get(key) || 0, monitoringRevision: this.monitoringRevision } : null; }
  accepts(ticket) { return Boolean(ticket && this.ready && !this.ended() && !this.paused()[ticket.key] && ticket.monitoringRevision === this.monitoringRevision && ticket.revision === (this.revisions.get(ticket.key) || 0)); }
  async read(key, load) {
    const ticket = this.ticket(key);
    if (!ticket) throw new CollectionStoppedError(this.ready, this.ended());
    const data = await load();
    if (!this.accepts(ticket)) throw new CollectionStoppedError(this.ready, this.ended());
    return { data, ticket };
  }
}
