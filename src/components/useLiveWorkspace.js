'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { foldWorkspace, makeObservation, mergeWorkspaceStudents, storeStudentKey, classifyConversations } from '@/lib/liveWorkRecords.mjs';
import { advanceIdleWatch, idleWatchMinutes } from '@/lib/idleWatch.mjs';

export default function useLiveWorkspace(data, { authorize, loadWorkspace, loadPresentation, loadComments }) {
  const [events, setEvents] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
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
  const refs = useRef({ api: null, events: [], collecting: false, mounted: true, sessionId: null, continuous: false, timer: null,
    live: false, idleWatchEnabled: false, idleTracks: {}, watchRevision: 0 });
  const actions = useRef(null);
  const state = foldWorkspace(events);
  const students = mergeWorkspaceStudents(data, state);
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
    if (!refs.current.mounted) return;
    setEvents(result.events); setStoreId(result.storeId); setInvalidRows(result.invalidRows);
  };

  useEffect(() => {
    const ref = refs.current;
    ref.mounted = true;
    let cancelled = false;
    loadWorkspace().then((result) => { if (result && !cancelled && ref.mounted && !ref.api) hydrate(result); }).catch((err) => { if (!cancelled && ref.mounted && !ref.api) setError(err.message); });
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
    if (busy) return;
    setBusy(true); setError('');
    try {
      const api = await authorize();
      const result = await api.initialize();
      if (!refs.current.mounted) return;
      refs.current.api = api;
      refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false;
      resetIdleWatch();
      hydrate(result); setEnabled(true); setProgress(purpose === 'memo' ? '교사 메모를 Google 시트에 저장할 준비가 됐습니다.' : purpose === 'keywords' ? '핵심 키워드를 Google 시트에 저장할 준비가 됐습니다.' : '저장 준비가 완료됐습니다. 현재 작업 확인을 눌러 시작하세요.'); return true;
    } catch (err) { if (refs.current.mounted) setError(err.message); return false; }
    finally { if (refs.current.mounted) setBusy(false); }
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

  async function refreshComments(student) {
    const key = student.id;
    try {
      const threads = await loadComments(student.slideId);
      if (refs.current.mounted) {
        setConversations((previous) => ({ ...previous, [key]: threads }));
        setCommentsLoaded((previous) => [...new Set([...previous, key])]);
        setCommentsErrors((previous) => ({ ...previous, [key]: '' }));
      }
      return threads;
    } catch (err) { if (refs.current.mounted) setCommentsErrors((previous) => ({ ...previous, [key]: err.message })); throw err; }
  }
  async function feedback(student, content, commentId = null) {
    if (!refs.current.api) { setError('Google 저장 권한을 연결해 주세요.'); return false; }
    setError('');
    try {
      await refs.current.api.feedback(student.slideId, content, commentId);
    } catch (err) { setError(`${err.message} 같은 글을 다시 보내기 전에 댓글을 새로고침해 확인해 주세요.`); return false; }
    try { await refreshComments(student); }
    catch { setError('피드백을 저장했지만 댓글을 다시 불러오지 못했습니다. 같은 글을 다시 보내지 말고 댓글을 새로고침해 주세요.'); }
    return true;
  }

  async function collect() {
    const ref = refs.current;
    if (!ref.api || ref.collecting || document.visibilityState !== 'visible') return;
    ref.collecting = true; setBusy(true); setError('');
    const interruptedSession = ref.sessionId, wasContinuous = ref.continuous;
    const watchRevision = ref.watchRevision;
    const previousState = foldWorkspace(ref.events);
    const keywords = previousState.settings.keywords || data.keywords;
    const pending = [], failed = [];
    try {
      const linked = data.students.filter((student) => student.slideId);
      for (let index = 0; index < linked.length; index += 3) {
        if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
        setProgress(`${Math.min(index + 3, linked.length)} / ${linked.length}명 작업 확인 중`);
        const chunk = linked.slice(index, index + 3);
        const results = await Promise.allSettled(chunk.map((student) => loadPresentation(student.slideId)));
        results.forEach((result, offset) => {
          const student = chunk[offset];
          if (result.status === 'fulfilled') pending.push(event('snapshot', student, makeObservation(result.value, previousState.snapshots[storeStudentKey(student)], { sessionId: interruptedSession, continuous: wasContinuous, keywords })));
          else failed.push(`${student.number ? `${student.number}번 ` : ''}${student.name}: ${result.reason.message}`);
        });
      }
      if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
      if (pending.length) hydrate(await ref.api.append(pending));
      if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) return;
      ref.continuous = true;
      if (failed.length) resetIdleWatch();
      else if (ref.live && ref.idleWatchEnabled && ref.watchRevision === watchRevision) {
        const next = { ...ref.idleTracks };
        for (const item of pending) next[item.studentId] = advanceIdleWatch(next[item.studentId], item.payload);
        ref.idleTracks = next; setIdleTracks(next); setWatchClock(Date.now());
      }
      setProgress(`${pending.length}명 기록 저장 · ${new Date().toLocaleTimeString('ko-KR', { hour12: false })} 확인`);
      if (failed.length) { ref.continuous = false; setError(`일부 학생을 확인하지 못했습니다. 이전 기록을 유지합니다. ${failed.join(' / ')}`); }
      // Refresh direct Slides comments on every second live cycle, and on manual checks.
      if (!wasContinuous || (ref.commentCycle = (ref.commentCycle || 0) + 1) % 2 === 0) {
        for (let index = 0; index < linked.length; index += 3) {
          if (!ref.mounted || document.visibilityState !== 'visible' || ref.sessionId !== interruptedSession) break;
          await Promise.allSettled(linked.slice(index, index + 3).map(refreshComments));
        }
      }
    } catch (err) {
      ref.continuous = false; ref.live = false; resetIdleWatch(); setRunning(false); if (ref.mounted) setError(err.message);
    } finally { ref.collecting = false; if (ref.mounted) setBusy(false); }
  }
  function toggleLive() {
    refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false;
    refs.current.live = !refs.current.live;
    resetIdleWatch(); setRunning(refs.current.live);
  }
  useEffect(() => { actions.current = { collect, toggleLive }; });
  useEffect(() => {
    const ref = refs.current;
    let cancelled = false;
    async function cycle() {
      if (cancelled || document.visibilityState !== 'visible') return;
      await actions.current.collect();
      if (!cancelled) refs.current.timer = setTimeout(cycle, 30000);
    }
    function visibility() {
      clearTimeout(refs.current.timer);
      refs.current.sessionId = crypto.randomUUID(); refs.current.continuous = false;
      resetIdleWatch();
      if (document.visibilityState === 'visible' && running) void cycle();
    }
    document.addEventListener('visibilitychange', visibility);
    if (running) void cycle();
    return () => { cancelled = true; clearTimeout(ref.timer); document.removeEventListener('visibilitychange', visibility); ref.continuous = false; };
  }, [running, resetIdleWatch]);

  return { enabled, running, busy, progress, error, storeId, invalidRows, events, state, students,
    idleWatchEnabled, toggleIdleWatch,
    inactiveMinutes: Object.fromEntries(students.map((student) => [student.id,
      running && idleWatchEnabled ? idleWatchMinutes(idleTracks[storeStudentKey(student)], watchClock) : null])),
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
