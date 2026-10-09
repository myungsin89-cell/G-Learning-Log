import { isTextSurge } from './workRecords.mjs';

export const EVENT_HEADERS = ['schema_version', 'event_id', 'event_type', 'student_id', 'created_at', 'payload_json'];
export const storeStudentKey = (student) => student.slideId ? `slide:${student.slideId}` : null;
const validTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value) => Number.isFinite(value) && value >= 0;

export function parseWorkspaceEvents(rows) {
  if (rows.length && JSON.stringify(rows[0]) !== JSON.stringify(EVENT_HEADERS)) throw new Error('새 기록 저장소의 형식이 다릅니다. 기존 내용을 변경하지 않았습니다.');
  const events = [], invalidRows = [], seen = new Set();
  for (const row of rows.slice(1)) {
    try {
      const [version, id, type, studentId, createdAt, json] = row;
      if (version !== '2' || !id || !validTime(createdAt)) throw new Error('invalid event');
      const payload = JSON.parse(json);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid payload');
      if (seen.has(id)) continue;
      seen.add(id);
      events.push({ id, type, studentId, createdAt, payload });
    } catch { invalidRows.push([...row]); }
  }
  return { events, invalidRows };
}

export function eventRow(event) {
  const json = JSON.stringify(event.payload);
  if (!event.id || !validTime(event.createdAt) || json.length > 45000) throw new Error('저장할 기록이 너무 크거나 형식이 올바르지 않습니다.');
  return ['2', event.id, event.type, event.studentId || '', event.createdAt, json];
}

export function foldWorkspace(events) {
  const result = { snapshots: {}, records: {}, memos: {}, readAt: {}, reviewed: {}, identities: {}, messageRoles: {}, settings: {}, seen: new Set() };
  // Append order, rather than the client's clock, decides the latest saved setting.
  for (const event of events) {
    if (result.seen.has(event.id)) continue;
    result.seen.add(event.id);
    const key = event.studentId, payload = event.payload;
    if (event.type === 'snapshot' && validTime(payload.checkedAt) && ['charCount', 'imageCount', 'slideCount'].every((field) => count(payload[field]))) {
      result.snapshots[key] = payload;
      (result.records[key] ||= []).push({ ...payload, id: event.id, charsAdded: null, charsRemoved: null });
    } else if (event.type === 'memo' && typeof payload.text === 'string') result.memos[key] = payload.text;
    else if (event.type === 'read' && validTime(payload.at)) result.readAt[key] = payload.at;
    else if (event.type === 'review' && typeof payload.value === 'boolean') result.reviewed[key] = { value: payload.value, recordId: payload.recordId };
    else if (event.type === 'identity' && payload.authorId) result.identities[`${key}:${payload.authorId}`] = payload.role;
    else if (event.type === 'message_role' && payload.messageId) result.messageRoles[`${key}:${payload.messageId}`] = payload.role;
    else if (event.type === 'settings') result.settings = { ...result.settings, ...payload };
  }
  return result;
}

export function makeObservation(presentation, previous, { sessionId, continuous = false, keywords = [] }) {
  const elapsed = previous ? Date.parse(presentation.checkedAt) - Date.parse(previous.checkedAt) : null;
  if (previous && (!Number.isFinite(elapsed) || elapsed <= 0)) throw new Error('확인 시각이 이전 기록보다 늦지 않아 비교 기록을 저장하지 않았습니다.');
  const uninterrupted = Boolean(previous && continuous && previous.sessionId === sessionId && elapsed <= 60000);
  const source = !previous ? 'first_snapshot' : uninterrupted ? 'continuous_poll' : 'gap_comparison';
  const text = presentation.pages.map((page) => `${page.text}\n${page.notes}`).join('\n').replace(/\s/g, '').toLowerCase();
  return { source, sessionId, checkedAt: presentation.checkedAt, previousCheckedAt: previous?.checkedAt || null,
    charCount: presentation.charCount, imageCount: presentation.imageCount, slideCount: presentation.slideCount,
    charDelta: previous ? presentation.charCount - previous.charCount : null,
    imageDelta: previous ? presentation.imageCount - previous.imageCount : null,
    slideDelta: previous ? presentation.slideCount - previous.slideCount : null,
    keywordsUsed: keywords.filter((word) => word.trim() && text.includes(word.replace(/\s/g, '').toLowerCase())),
    pages: presentation.pages.map(({ id, number, chars, images }) => ({ id, number, chars, images })),
  };
}

export function mergeWorkspaceStudents(data, state) {
  const baseline = data.assignment.templateBaseline;
  return data.students.map((student) => {
    const key = storeStudentKey(student), snapshot = state.snapshots[key];
    if (!snapshot) return { ...student, storeKey: key };
    const records = [...student.records, ...(state.records[key] || [])];
    const changed = [snapshot.charDelta, snapshot.imageDelta, snapshot.slideDelta].some((value) => value != null && value !== 0);
    const surge = isTextSurge({ ...snapshot, continuous: snapshot.source === 'continuous_poll' });
    return { ...student, storeKey: key, records, checkedAt: snapshot.checkedAt,
      chars: baseline?.chars != null ? Math.max(0, snapshot.charCount - baseline.chars) : student.chars,
      images: baseline?.images != null ? Math.max(0, snapshot.imageCount - baseline.images) : student.images,
      slides: snapshot.slideCount, keywordsUsed: snapshot.keywordsUsed || [], currentCounts: snapshot,
      amountVerified: baseline?.chars != null && baseline?.images != null,
      status: surge ? 'surge' : changed ? 'active' : snapshot.source === 'first_snapshot' ? 'unstarted' : 'idle' };
  });
}

export function classifyConversations(threads, student, state) {
  const key = storeStudentKey(student);
  const classify = (message) => {
    if (message.role === 'teacher') return message;
    const role = state.messageRoles[`${key}:${message.id}`] || (message.authorId && state.identities[`${key}:${message.authorId}`]);
    return role === 'student' ? { ...message, role: 'student', identityConfirmed: true } : message;
  };
  return threads.map((thread) => ({ ...classify(thread), replies: thread.replies.map(classify) }));
}

export function verifiedChangeBins(records, mode = 'lesson') {
  const bins = [], continuous = new Map();
  for (const record of records) {
    if (!['continuous_poll', 'gap_comparison'].includes(record.source) || !Number.isFinite(record.charDelta) || !validTime(record.checkedAt) || !validTime(record.previousCheckedAt)) continue;
    const end = Date.parse(record.checkedAt);
    const start = Date.parse(record.previousCheckedAt);
    if (end <= start) continue;
    const short = record.source === 'continuous_poll' && end - start <= 60000;
    const bucket = Math.floor(end / 1200000) * 1200000;
    const id = mode === 'lesson' && short ? `${record.sessionId || 'session'}:${bucket}` : record.id;
    let bin = short && mode === 'lesson' ? continuous.get(id) : null;
    if (!bin) {
      bin = { id, start: mode === 'lesson' && short ? new Date(bucket).toISOString() : record.previousCheckedAt,
        end: mode === 'lesson' && short ? new Date(bucket + 1200000).toISOString() : record.checkedAt,
        added: 0, removed: 0, records: [], gap: !short };
      bins.push(bin); if (short && mode === 'lesson') continuous.set(id, bin);
    }
    bin.added += Math.max(0, record.charDelta); bin.removed += Math.max(0, -record.charDelta); bin.records.push(record);
  }
  return bins;
}
