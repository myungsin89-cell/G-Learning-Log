'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { foldWorkspace, makeObservation, mergeWorkspaceStudents, storeStudentKey, classifyConversations } from '@/lib/liveWorkRecords.mjs';
import { mergePostedTeacherReplies } from '@/lib/workRecords.mjs';
import { advanceIdleWatch, idleWatchMinutes } from '@/lib/idleWatch.mjs';
import { StudentCollectionGate, CollectionStoppedError } from '@/lib/studentCollection.mjs';
import { WorkspaceConnection } from '@/lib/workspaceConnection.mjs';

export default function useLiveWorkspace(data, { authorize, loadWorkspace, loadPresentation, loadComments }) {
  const [events, setEvents] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [runRevision, setRunRevision] = useState(0);
  const [idleWatchEnabled, setIdleWatchEnabled] = useState(false);
  const [idleTracks, setIdleTracks] = useState({});
  const [watchClock, setWatchClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [invalidRows, setInvalidRows] = useState([]);
  const [conversations, setConversations] = useState({});
  const [commentsLoaded, setCommentsLoaded] = useState([]);
  const [commentsErrors, setCommentsErrors] = useState({});
  const [collectionPaused, setCollectionPausedState] = useState({}), [collectionReady, setCollectionReady] = useState(false);
  const [collectionBusy, setCollectionBusy] = useState([]), [collectionErrors, setCollectionErrors] = useState({}), [collectionUnsaved, setCollectionUnsaved] = useState({});
  const [monitoringEnded, setMonitoringEndedState] = useState(false), [monitoringBusy, setMonitoringBusy] = useState(false);
  const [monitoringUnsaved, setMonitoringUnsaved] = useState(false), [monitoringError, setMonitoringError] = useState('');
  const refs = useRef({ api: null, events: [], collecting: false, mounted: true, sessionId: null, continuous: false, timer: null,
    live: false, skipFirstCycle: false, idleWatchEnabled: false, idleTracks: {}, watchRevision: 0, gate: new StudentCollectionGate(), connection: new WorkspaceConnection(), collectionBusy: new Set(), studentRevisions: new Map(), postedReplies: [], monitoringBusy: false });
  const actions = useRef(null);
  const state = foldWorkspace(events);
  const monitoringPending = Boolean(process.env.NEXT_PUBLIC_APP_MODE !== 'readonly' && data.assignment.creationId && !state.settings.monitoringStartedAt && !state.settings.monitoringEnded);
  const students = monitoringPending ? data.students.map((student) => ({ ...student, records: [], chars: null, images: null, slides: null, checkedAt: null, status: 'unstarted', currentCounts: null })) : mergeWorkspaceStudents(data, state);
  const hasStarted = () => !data.assignment.creationId || Boolean(foldWorkspace(refs.current.events).settings.monitoringStartedAt);
  const resetIdleWatch = useCallback(() => {
    const ref = refs.current;
    ref.idleTracks = {}; ref.watchRevision++;
    if (ref.mounted) setIdleTracks({});
  }, []);
  function toggleIdleWatch() {
    const ref = refs.current;
    ref.idleWatchEnabled = !ref.idleWatchEnabled;
    setIdleWatchEnabled(ref.idleWatchEnabled);
    resetIdleWatch();
  }
  useEffect(() => {
    if (!running || !idleWatchEnabled) return;
    // Refresh freshness locally; this timer makes no Google requests.
    const timer = setInterval(() => setWatchClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [running, idleWatchEnabled]);
  const hydrate = (result) => {
    refs.current.events = result.events;
    const restored = foldWorkspace(result.events);
    refs.current.gate.restore(restored.collectionPaused, restored.seen, restored.settings.monitoringEnded === true);
    if (refs.current.gate.ended()) stopLive();
    if (!refs.current.mounted) return;
    setCollectionPausedState(refs.current.gate.paused()); setCollectionReady(true);
    setMonitoringEndedState(refs.current.gate.ended());
    setEvents(result.events); setStoreId(result.storeId); setInvalidRows(result.invalidRows);
  };

  useEffect(() => {
    const ref = refs.current;
    ref.mounted = true;
    let cancelled = false;
    async function restoreReadOnly() {
      const result = await loadWorkspace();
      if (cancelled || !ref.mounted || ref.api) return;
      if (result) hydrate(result);
      else { ref.gate.restore(); setCollectionPausedState(ref.gate.paused()); setCollectionReady(true); }
    }
    async function start() {
      setBusy(true); setProgress('모니터링 준비 중…');
      try {
        if (process.env.NEXT_PUBLIC_APP_MODE === 'readonly') { await restoreReadOnly(); return; }
        // A background setup may use the first login's token, never open OAuth.
        if (!await initializeConnection({ interactive: false }) || cancelled) return;
        if (ref.gate.ended()) { setProgress('모니터링 종료 · 저장된 기록 보기'); return; }
        if (!hasStarted()) { setProgress('모니터링 시작을 기다리는 중입니다.'); return; }
        ref.live = true; setRunning(true); setProgress('학생 작업 확인을 시작합니다.');
      } catch (err) {
        if (!cancelled && ref.mounted && !ref.api) {
          setError(`모니터링을 시작하지 못했습니다. ${err.message}`);
          try { await restoreReadOnly(); }
          catch (restoreError) { if (!cancelled && ref.mounted) setError(`${err.message} ${restoreError.message}`); }
        }
      } finally { if (!cancelled && ref.mounted) setBusy(false); }
    }
    void start();
    return () => { cancelled = true; ref.mounted = false; ref.continuous = false; clearTimeout(ref.timer); };
    // The component is keyed by assignment + initial load. Auth is read when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const event = (type, student, payload) => {
    const key = student ? storeStudentKey(student) : '';
    if (student && !key) throw new Error('슬라이드가 연결된 학생만 작업 기록을 저장할 수 있습니다.');
    return { id: crypto.randomUUID(), type, studentId: key, createdAt: new Date().toISOString(), payload };
  };
  async function save(type, student, payload) {
    if (!refs.current.api) { setError('Google 저장 권한을 연결해 주세요.'); return false; }
    setError('');
    try { hydrate(await refs.current.api.append([event(type, student, payload)])); return true; }
    catch (err) { setError(err.message); return false; }
  }
  async function connect({ purpose = 'records' } = {}) {
    if (refs.current.collecting) return false;
    setBusy(true); setError('');
    try {
      if (!await initializeConnection({ interactive: true })) return false;
      if (purpose === 'records' && hasStarted() && !refs.current.gate.ended() && !refs.current.monitoringBusy) { refs.current.live = true; setRunning(true); }
      setProgress(refs.current.gate.ended() ? '모니터링 종료 · 저장된 기록 보기' : !hasStarted() ? '모니터링 시작을 기다리는 중입니다.' : purpose === 'memo' ? '교사 메모를 Google 시트에 저장할 준비가 됐습니다.' : purpose === 'keywords' ? '핵심 키워드를 Google 시트에 저장할 준비가 됐습니다.' : 'Google 연결을 확인하고 모니터링을 시작합니다.'); return true;
    } catch (err) { if (refs.current.mounted) setError(err.message); return false; }
    finally { if (refs.current.mounted) setBusy(false); }
  }

  async function initializeConnection(options) {
    const ref = refs.current;
    const { api, result } = await ref.connection.connect(authorize, options);
    if (!ref.mounted) return false;
    ref.api = api; ref.sessionId = crypto.randomUUID(); ref.continuous = false;
    resetIdleWatch(); hydrate(result); setEnabled(true);
    return true;
  }

  async function saveMemo(student, text) {
    // The memo's Save button opens OAuth directly when necessary. No collection
    // is started, and the memo is appended only to the private teacher sheet.
    if (!refs.current.api && !await connect({ purpose: 'memo' })) return false;
    return save('memo', student, { text: text.slice(0, 3000) });
  }
  async function saveKeywords(keywords) {
    if (!refs.current.api && !await connect({ purpose: 'keywords' })) return false;
    return save('settings', null, { keywords: [...new Set(keywords.map((word) => word.trim()).filter(Boolean))] });
  }

  function stopLive() {
    const ref = refs.current;
    ref.live = false; ref.continuous = false; clearTimeout(ref.timer);
    ref.sessionId = crypto.randomUUID(); ref.studentRevisions.clear(); resetIdleWatch();
    if (ref.mounted) setRunning(false);
  }
  async function startMonitoring() {
    const ref = refs.current;
    if (ref.monitoringBusy || ref.collecting || ref.gate.ended() || document.visibilityState !== 'visible') return false;
    ref.monitoringBusy = true; setMonitoringBusy(true); setMonitoringError('');
    stopLive();
    try {
      if (!ref.api && !await connect({ purpose: 'privacy' })) throw new Error('Google 저장 권한을 연결해 주세요.');
      const startedAt = new Date().toISOString();
      const baselines = [], failed = [];
      const linked = data.students.filter((student) => student.slideId && !ref.gate.paused()[storeStudentKey(student)]);
      for (let index = 0; index < linked.length; index += 3) {
        setProgress(`${Math.min(index + 3, linked.length)} / ${linked.length}명 시작 기준 확인 중`);
        const chunk = linked.slice(index, index + 3);
        const results = await Promise.allSettled(chunk.map((student) => ref.gate.read(storeStudentKey(student), () => loadPresentation(student.slideId))));
        results.forEach((result, offset) => {
          const student = chunk[offset];
          if (result.status === 'fulfilled') {
            const { data: presentation, ticket } = result.value;
            baselines.push({ item: event('snapshot', student, makeObservation(presentation, null, { sessionId: ref.sessionId, keywords: foldWorkspace(ref.events).settings.keywords || data.keywords })), ticket });
          } else if (!(result.reason instanceof CollectionStoppedError)) failed.push(`${student.number ? `${student.number}번 ` : ''}${student.name}: ${result.reason.message}`);
        });
      }
      if (!ref.mounted || ref.gate.ended()) return false;
      if (linked.length && !baselines.length && failed.length) throw new Error(`학생 슬라이드의 현재 상태를 읽지 못했습니다. ${failed.join(' / ')}`);
      const saved = await ref.api.append([event('settings', null, { monitoringStartedAt: startedAt }), ...baselines.map(({ item }) => item)], { shouldInclude: (item) => item.type !== 'snapshot' || ref.gate.accepts(baselines.find(({ item: baseline }) => baseline.id === item.id)?.ticket) });
      hydrate(saved);
      const ids = new Set(saved.events.map((item) => item.id));
      for (const { item, ticket } of baselines) if (ids.has(item.id) && ref.gate.accepts(ticket)) ref.studentRevisions.set(ticket.key, `${ticket.monitoringRevision}:${ticket.revision}`);
      ref.continuous = true; ref.skipFirstCycle = true; ref.live = true; setRunning(true); setRunRevision((value) => value + 1);
      setProgress(`모니터링 시작 · ${baselines.length}명 기준 저장 · 30초마다 확인`);
      void (async () => {
        for (let index = 0; index < linked.length; index += 3) {
          if (!ref.mounted || ref.gate.ended()) break;
          await Promise.allSettled(linked.slice(index, index + 3).filter((student) => ref.gate.ticket(storeStudentKey(student))).map(refreshComments));
        }
      })();
      if (failed.length) setMonitoringError(`일부 학생은 시작 기준을 읽지 못했습니다. 다음 확인을 첫 기준으로 저장합니다. ${failed.join(' / ')}`);
      return true;
    } catch (err) { if (ref.mounted) setMonitoringError(`모니터링을 시작하지 못했습니다. ${err.message}`); return false; }
    finally { ref.monitoringBusy = false; if (ref.mounted) setMonitoringBusy(false); }
  }
  async function setMonitoringEnded(ended) {
    const ref = refs.current;
    if (ref.monitoringBusy) return false;
    ref.monitoringBusy = true; setMonitoringBusy(true); setMonitoringError('');
    if (ended) {
      ref.gate.setEnded(true); stopLive(); setMonitoringEndedState(true); setMonitoringUnsaved(true);
    }
    try {
      if (!ref.api && !await connect({ purpose: 'privacy' })) throw new Error('Google 저장 권한을 연결해 주세요.');
      const control = event('settings', null, { monitoringEnded: ended });
      const saved = await ref.api.append([control]);
      // Resume only after persistence; restarting never starts an automatic cycle.
      if (!ended) { ref.gate.setEnded(false); stopLive(); }
      ref.gate.confirmEnded(control.id, ended); hydrate(saved);
      setMonitoringUnsaved(false);
      setProgress(ended ? '모니터링 종료 · 저장된 기록 보기' : '모니터링 재개 · 현재 작업 확인을 눌러 시작하세요.');
      return true;
    } catch (err) {
      if (ref.mounted) setMonitoringError(`${ended ? '이 화면의 조회는 멈췄지만 종료 상태를 저장하지 못했습니다. 새로고침 전에 다시 저장해 주세요. ' : '모니터링 종료 상태를 유지합니다. '}${err.message}`);
      return false;
    } finally { ref.monitoringBusy = false; if (ref.mounted) setMonitoringBusy(false); }
  }

  async function setStudentCollection(student, paused) {
    const ref = refs.current, key = storeStudentKey(student);
    if (!key || ref.collectionBusy.has(key) || ref.gate.ended() || ref.monitoringBusy) return false;
    ref.collectionBusy.add(key); setCollectionBusy([...ref.collectionBusy]);
    setCollectionErrors((previous) => ({ ...previous, [key]: '' }));
    if (paused) {
      ref.gate.setPaused(key, true); setCollectionPausedState(ref.gate.paused()); resetIdleWatch();
      setCollectionUnsaved((previous) => ({ ...previous, [key]: true }));
    }
    try {
      if (!ref.api && !await connect({ purpose: 'privacy' })) throw new Error('Google 저장 권한을 연결한 뒤 중지 상태를 저장해 주세요.');
      const control = event('collection', student, { paused });
      const saved = await ref.api.append([control]);
      if (!paused) { ref.gate.setPaused(key, false); resetIdleWatch(); }
      ref.gate.confirm(key, control.id, paused);
      hydrate(saved);
      setCollectionUnsaved((previous) => ({ ...previous, [key]: false }));
      return true;
    } catch (err) {
      if (ref.mounted) setCollectionErrors((previous) => ({ ...previous, [key]: `${paused ? '이 화면에서는 조회를 중지했지만, 중지 상태를 시트에 저장하지 못했습니다. 새로고침 전에 다시 저장해 주세요. ' : '중지 상태를 유지합니다. '}${err.message}` }));
      return false;
    } finally { ref.collectionBusy.delete(key); if (ref.mounted) setCollectionBusy([...ref.collectionBusy]); }
  }

  async function inspectPresentation(student) {
    return (await refs.current.gate.read(storeStudentKey(student), () => loadPresentation(student.slideId))).data;
  }

  async function refreshComments(student) {
    const key = student.id;
    try {
      const threads = (await refs.current.gate.read(storeStudentKey(student), () => loadComments(student.slideId))).data;
      if (refs.current.mounted) {
        setConversations((previous) => ({ ...previous, [key]: mergePostedTeacherReplies(threads, previous[key] || [], refs.current.postedReplies.filter((item) => item.studentId === key)) }));
        setCommentsLoaded((previous) => [...new Set([...previous, key])]);
        setCommentsErrors((previous) => ({ ...previous, [key]: '' }));
      }
      return threads;
    } catch (err) { if (refs.current.mounted && !(err instanceof CollectionStoppedError)) setCommentsErrors((previous) => ({ ...previous, [key]: err.message })); throw err; }
  }
  async function feedback(student, content, commentId = null) {
    if (!refs.current.api) { setError('Google 저장 권한을 연결해 주세요.'); return false; }
    setError('');
    let saved;
    try {
      if (!refs.current.gate.ticket(storeStudentKey(student))) throw new CollectionStoppedError(refs.current.gate.ready, refs.current.gate.ended());
      saved = await refs.current.api.feedback(student.slideId, content, commentId);
    } catch (err) { setError(`${err.message} 같은 글을 다시 보내기 전에 댓글을 새로고침해 확인해 주세요.`); return false; }
    if (commentId && saved?.id) {
      const reply = { id: saved.id, role: 'teacher', authorName: saved.author?.displayName || null,
        content: saved.content || content.trim(), createdAt: saved.createdTime || new Date().toISOString() };
      refs.current.postedReplies.push({ studentId: student.id, threadId: commentId, reply });
      if (refs.current.mounted) setConversations((previous) => ({ ...previous, [student.id]: mergePostedTeacherReplies(previous[student.id] || [], previous[student.id] || [], refs.current.postedReplies.filter((item) => item.studentId === student.id)) }));
      try { hydrate(await refs.current.api.append([event('message_role', student, { messageId: saved.id, role: 'teacher' })])); }
      catch { setError('답글은 슬라이드에 저장됐지만 교사 작성 표시를 별도로 저장하지 못했습니다. 다시 보내지 말고 댓글을 새로고침해 확인해 주세요.'); }
    }
    try { await refreshComments(student); }
    catch { setError('피드백을 저장했지만 댓글을 다시 불러오지 못했습니다. 같은 글을 다시 보내지 말고 댓글을 새로고침해 주세요.'); }
    return true;
  }

  async function collect() {
    const ref = refs.current;
    if (!ref.api || !ref.gate.ready || !hasStarted() || ref.gate.ended() || ref.monitoringBusy || ref.collecting || document.visibilityState !== 'visible') return;
    ref.collecting = true; setBusy(true); setError('');
    const interruptedSession = ref.sessionId, wasContinuous = ref.continuous;
    const watchRevision = ref.watchRevision;
    const previousState = foldWorkspace(ref.events);
    const keywords = previousState.settings.keywords || data.keywords;
    const pending = [], failed = [], tickets = new Map();
    try {
      const linked = data.students.filter((student) => ref.gate.ticket(storeStudentKey(student)));
      for (let index = 0; index < linked.length; index += 3) {
        if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
        setProgress(`${Math.min(index + 3, linked.length)} / ${linked.length}명 작업 확인 중`);
        const chunk = linked.slice(index, index + 3);
        const results = await Promise.allSettled(chunk.map((student) => ref.gate.read(storeStudentKey(student), () => loadPresentation(student.slideId))));
        results.forEach((result, offset) => {
          const student = chunk[offset];
          if (result.status === 'fulfilled') {
            const { data: presentation, ticket } = result.value;
            const revision = `${ticket.monitoringRevision}:${ticket.revision}`;
            const item = event('snapshot', student, makeObservation(presentation, previousState.snapshots[storeStudentKey(student)], { sessionId: interruptedSession, continuous: wasContinuous && ref.studentRevisions.get(ticket.key) === revision, keywords }));
            pending.push(item); tickets.set(item.id, ticket);
          } else if (!(result.reason instanceof CollectionStoppedError)) failed.push(`${student.number ? `${student.number}번 ` : ''}${student.name}: ${result.reason.message}`);
        });
      }
      if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
      let collected = [];
      if (pending.length) {
        const saved = await ref.api.append(pending, { shouldInclude: (item) => ref.gate.accepts(tickets.get(item.id)) });
        hydrate(saved);
        const ids = new Set(saved.events.map((item) => item.id));
        collected = pending.filter((item) => ids.has(item.id) && ref.gate.accepts(tickets.get(item.id)));
        for (const item of collected) { const ticket = tickets.get(item.id); ref.studentRevisions.set(ticket.key, `${ticket.monitoringRevision}:${ticket.revision}`); }
      }
      if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
      ref.continuous = true;
      if (failed.length) resetIdleWatch();
      else if (ref.live && ref.idleWatchEnabled && ref.watchRevision === watchRevision) {
        const next = { ...ref.idleTracks };
        for (const item of collected) next[item.studentId] = advanceIdleWatch(next[item.studentId], item.payload);
        ref.idleTracks = next; setIdleTracks(next); setWatchClock(Date.now());
      }
      setProgress(`${collected.length}명 기록 저장 · ${new Date().toLocaleTimeString('ko-KR', { hour12: false })} 확인`);
      if (failed.length) { ref.continuous = false; setError(`일부 학생을 확인하지 못했습니다. 이전 기록을 유지합니다. ${failed.join(' / ')}`); }
      // Refresh direct Slides comments on every second live cycle, and on manual checks.
      if (!wasContinuous || (ref.commentCycle = (ref.commentCycle || 0) + 1) % 2 === 0) {
        for (let index = 0; index < linked.length; index += 3) {
          if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) break;
          await Promise.allSettled(linked.slice(index, index + 3).filter((student) => ref.gate.ticket(storeStudentKey(student))).map(refreshComments));
        }
      }
    } catch (err) {
      ref.continuous = false; ref.live = false; resetIdleWatch(); setRunning(false); if (ref.mounted) setError(err.message);
    } finally { ref.collecting = false; if (ref.mounted) setBusy(false); }
  }
  function toggleLive() {
    if (!refs.current.api || !refs.current.gate.ready || !hasStarted() || refs.current.gate.ended() || refs.current.monitoringBusy) return;
    refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false;
    refs.current.live = !refs.current.live;
    resetIdleWatch(); setRunning(refs.current.live);
  }
  useEffect(() => { actions.current = { collect, toggleLive }; });
  useEffect(() => {
    const ref = refs.current;
    let cancelled = false;
    async function cycle() {
      if (cancelled || !ref.live || ref.gate.ended() || document.visibilityState !== 'visible') return;
      await actions.current.collect();
      if (!cancelled && ref.live && !ref.gate.ended()) refs.current.timer = setTimeout(cycle, 30000);
    }
    function visibility() {
      clearTimeout(refs.current.timer);
      refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false;
      resetIdleWatch();
      if (document.visibilityState === 'visible' && running) void cycle();
    }
    document.addEventListener('visibilitychange', visibility);
    if (running && ref.skipFirstCycle) { ref.skipFirstCycle = false; ref.continuous = true; ref.timer = setTimeout(cycle, 30000); }
    else if (running) void cycle();
    return () => { cancelled = true; clearTimeout(ref.timer); document.removeEventListener('visibilitychange', visibility); ref.continuous = false; };
  }, [running, resetIdleWatch, runRevision]);

  return { enabled, running, busy, progress, error, storeId, invalidRows, events, state, students,
    monitoringPending, monitoringEnded, monitoringBusy, monitoringUnsaved, monitoringError, setMonitoringEnded, startMonitoring,
    collectionPaused, collectionReady, collectionBusy, collectionErrors, collectionUnsaved, setStudentCollection, inspectPresentation,
    idleWatchEnabled, toggleIdleWatch,
    inactiveMinutes: Object.fromEntries(students.map((student) => [student.id,
      running && idleWatchEnabled && !collectionPaused[storeStudentKey(student)] ? idleWatchMinutes(idleTracks[storeStudentKey(student)], watchClock) : null])),
    keywords: state.settings.keywords || data.keywords,
    memos: Object.fromEntries(students.map((student) => [student.id, state.memos[storeStudentKey(student)] || ''])),
    readAt: Object.fromEntries(students.map((student) => [student.id, state.readAt[storeStudentKey(student)] || null])),
    reviewed: students.filter((student) => { const review = state.reviewed[storeStudentKey(student)]; return review?.value && review.recordId === student.records.at(-1)?.id; }).map((student) => student.id),
    conversations, commentsLoaded, commentsErrors, classify: (threads, student) => classifyConversations(threads, student, state),
    connect, refreshComments, feedback, collect: () => { refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false; resetIdleWatch(); return collect(); }, toggleLive,
    saveMemo,
    markRead: (student) => save('read', student, { at: new Date().toISOString() }),
    review: (student, value) => save('review', student, { value, recordId: student.records.at(-1)?.id }),
    confirmAuthor: (student, message, role = 'student') => message.role === 'teacher' ? Promise.resolve(false) : save(message.authorId ? 'identity' : 'message_role', student, message.authorId ? { authorId: message.authorId, role } : { messageId: message.id, role }),
    saveKeywords,
    refreshSettings: async () => { const result = await loadWorkspace(); if (result) hydrate(result); },
  };
}
