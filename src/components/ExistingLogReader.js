'use client';

import { useEffect, useRef, useState } from 'react';
import EntryScreen from './EntryScreen';
import ClassSelection, { ClassSelectionHeader } from './ClassSelection';
import ClassWorkspace from './ClassWorkspace';
import ClassroomCreation from './ClassroomCreation';
import MadeByStamp from './MadeByStamp';
import ConnectedAssignment from './ConnectedAssignment';
import { createGoogleReader } from '@/lib/googleReadOnly.mjs';
import { createGoogleWorkspace } from '@/lib/googleWorkspace.mjs';
import { createGoogleClassroom } from '@/lib/googleClassroom.mjs';
import { foldWorkspace } from '@/lib/liveWorkRecords.mjs';
import { readOnlyClientId, saveReadOnlyClientId, signInReadOnly, signInWorkspace, signInClassroom, currentWorkspaceSession, adoptWorkspaceSession, clearWorkspaceSession, clearReadOnlySession, currentReadOnlySession } from '@/lib/readOnlyAuth';
import styles from './ExistingLogReader.module.css';
import selectionStyles from './ClassSelection.module.css';

export default function ExistingLogReader() {
  const [reader, setReader] = useState(null);
  const [account, setAccount] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [creation, setCreation] = useState(null);
  const coverCache = useRef(new Map());
  const stage = !reader ? 'login' : data ? `assignment:${data.assignment.id}` : selectedClass ? `class:${selectedClass.id}` : 'classes';
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [stage]);

  async function connect() {
    setError('');
    if (!readOnlyClientId()) { setShowConfig(true); return; }
    setBusy(true);
    try {
      const session = await signInReadOnly();
      const api = createGoogleReader(session.accessToken);
      const results = await Promise.allSettled([api.listClasses(), api.account()]);
      for (const result of results) if (result.status === 'rejected') throw result.reason;
      const result = results[0].value;
      const sameAccount = account?.permissionId && account.permissionId === results[1].value?.permissionId;
      setAccount(results[1].value);
      setReader(api);
      setClasses(result);
      if (!sameAccount) {
        coverCache.current.clear();
        setSelectedClass(null); setAssignments([]); setRoster(null); setRosterError('');
        setSelectedAssignment(null); setData(null);
      }
      setNotice('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function checkSession() {
    if (!currentReadOnlySession()) throw new Error('로그인이 만료됐습니다. 다시 로그인한 뒤 이어서 확인해 주세요.');
  }
  async function openClass(item, { refreshCover = false } = {}) {
    setBusy(true); setError('');
    try {
      const current = api();
      const [assignmentResult, rosterResult] = await Promise.allSettled([current.listAssignments(item.name), current.loadRoster(item)]);
      if (assignmentResult.status === 'rejected') throw assignmentResult.reason;
      const result = assignmentResult.value;
      setSelectedClass(item); setAssignments(result);
      setRoster(rosterResult.status === 'fulfilled' ? rosterResult.value : null);
      setRosterError(rosterResult.status === 'rejected' ? rosterResult.reason.message : '');
      const summaries = [];
      for (let index = 0; index < result.length; index += 4) {
        summaries.push(...await Promise.all(result.slice(index, index + 4).map(async (assignment) => {
          let next;
          try { next = { ...assignment, summary: await current.loadAssignmentSummary(assignment, item.name) }; }
          catch (err) { next = { ...assignment, summaryError: err.message }; }
          try {
            const cached = coverCache.current.get(assignment.id);
            const useCached = !refreshCover && cached?.expiresAt > Date.now();
            const cover = useCached ? cached.cover : await current.loadAssignmentCover(next);
            if (cover && !useCached) coverCache.current.set(assignment.id, { cover, expiresAt: Date.now() + 15 * 60 * 1000 });
            return { ...next, cover };
          }
          catch (err) { return { ...next, coverError: err.message }; }
        })));
      }
      setAssignments(summaries);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function openAssignment(item) {
    setBusy(true); setError('');
    try {
      const result = await api().loadAssignment(item, selectedClass.name);
      setSelectedAssignment(item); setData(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function disconnect() {
    coverCache.current.clear(); clearReadOnlySession(); setReader(null); setAccount(null); setClasses([]); setSelectedClass(null); setAssignments([]); setSelectedAssignment(null); setData(null); setError(''); setNotice(''); setRoster(null); setRosterError('');
  }
  function api() { checkSession(); return createGoogleReader(currentReadOnlySession().accessToken); }
  async function refreshClasses() {
    setBusy(true); setError('');
    try { setClasses(await api().listClasses()); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function refreshRoster() {
    setBusy(true);
    try { setRoster(await api().loadRoster(selectedClass)); setRosterError(''); }
    catch (err) { setRosterError(err.message); }
    finally { setBusy(false); }
  }
  function backToClasses() { setData(null); setSelectedClass(null); setSelectedAssignment(null); setAssignments([]); setError(''); }
  async function authorize() {
    const session = await authorizeSession(false);
    return createGoogleWorkspace(session.accessToken, data.assignment, data.students);
  }
  async function authorizeSession(copyTemplate) {
    if (!account?.permissionId) throw new Error('계정 확인을 위해 과제 목록에서 다시 로그인해 주세요.');
    // Called directly by the user's button so GIS can open its permission popup.
    const cached = currentWorkspaceSession();
    const session = cached && (!copyTemplate || cached.scopes.includes('https://www.googleapis.com/auth/drive')) ? cached : await (copyTemplate ? signInClassroom() : signInWorkspace());
    const nextReader = createGoogleReader(session.accessToken);
    const nextAccount = await nextReader.account();
    if (nextAccount?.permissionId !== account.permissionId) { clearWorkspaceSession(); throw new Error('자료를 불러온 교사와 같은 Google 계정으로 저장을 연결해 주세요.'); }
    adoptWorkspaceSession(); setReader(nextReader);
    return session;
  }
  async function createClass(payload) {
    const session = await authorizeSession(false);
    return createGoogleClassroom(session.accessToken).createClass(payload);
  }
  async function createAssignment(payload) {
    const session = await authorizeSession(true);
    return createGoogleClassroom(session.accessToken).createAssignment(payload);
  }
  async function resumeAssignment(assignment) {
    setBusy(true); setError('');
    try { setCreation({ kind: 'assignment', initialPlan: await api().loadCreationPlan(assignment) }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function created(result) {
    setCreation(null);
    if (creation.kind === 'class') { setClasses((previous) => [...previous, result]); await openClass(result); }
    else { await openClass(selectedClass); await openAssignment(result.assignment); }
  }
  async function configureEntry(mode) {
    const session = await authorizeSession(false);
    if (mode === 'shared') return createGoogleClassroom(session.accessToken).createStudentEntry({ assignment: data.assignment, className: data.className, students: data.students, jobId: `join:${data.assignment.id}` });
    const workspace = createGoogleWorkspace(session.accessToken, data.assignment, data.students);
    const previous = await workspace.initialize();
    const entry = { ...foldWorkspace(previous.events).settings.studentEntry, mode: 'individual' };
    await workspace.append([{ id: crypto.randomUUID(), type: 'settings', studentId: '', createdAt: new Date().toISOString(), payload: { studentEntry: entry } }]);
    return entry;
  }

  if (data) return <>
    {busy && <p className={styles.floating} role="status">저장된 기록을 다시 불러오는 중입니다.</p>}
    {error && <div className={styles.floating} role="alert">{error}<button onClick={connect} disabled={busy}>다시 로그인</button><button onClick={() => setError('')}>닫기</button></div>}
    <ConnectedAssignment key={`${selectedAssignment.id}-${data.loadedAt}`} data={data}
      onBack={() => { setData(null); setError(''); }} onRefresh={() => { if (!busy) openAssignment(selectedAssignment); }}
      onHome={backToClasses}
      configureEntry={process.env.NEXT_PUBLIC_APP_MODE !== 'readonly' ? configureEntry : undefined}
      loadPresentation={(slideId) => api().loadPresentation(slideId)} loadComments={(slideId) => api().loadComments(slideId)}
      loadWorkspace={() => api().loadWorkspace(data.assignment.id)} authorize={authorize} />
  </>;

  const messages = <>
    {error && <div className={styles.error} role="alert"><span>{error}</span>{reader && <button onClick={connect} disabled={busy}>다시 로그인</button>}</div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {busy && <p className={styles.loading} role="status"><i />Google 데이터를 불러오는 중입니다…</p>}
  </>;
  const creationDialog = creation && <ClassroomCreation key={creation.initialPlan?.jobId || creation.kind} kind={creation.kind} className={selectedClass?.name} roster={roster || []} initialPlan={creation.initialPlan}
    existingNames={(creation.kind === 'class' ? classes : assignments).map((item) => item.name)}
    onCreate={creation.kind === 'class' ? createClass : createAssignment} onCreated={created} onClose={() => { setCreation(null); if (selectedClass) openClass(selectedClass); else refreshClasses(); }} />;
  if (!reader) return <EntryScreen onLogin={connect} loading={busy}>
      {messages}
      <details className={styles.settings} open={showConfig} onToggle={(event) => setShowConfig(event.currentTarget.open)}>
        <summary>Google 연결 설정</summary>
        {showConfig && <form className={styles.config} onSubmit={(event) => {
          event.preventDefault();
          try { saveReadOnlyClientId(String(new FormData(event.currentTarget).get('clientId'))); setNotice('클라이언트 ID를 이 브라우저에 저장했습니다. Google 로그인 버튼으로 연결해 주세요.'); setShowConfig(false); setError(''); }
          catch (err) { setError(err.message); }
        }}>
          <label htmlFor="readonly-client">웹 OAuth 클라이언트 ID</label>
          <input id="readonly-client" name="clientId" type="text" defaultValue={readOnlyClientId()} placeholder="…apps.googleusercontent.com" required autoComplete="off" spellCheck={false} />
          <p>Google Auth Platform의 웹 클라이언트 ID를 입력해 주세요.</p>
          <p>클라이언트의 승인된 JavaScript 원본에 현재 접속 주소를 등록해 주세요. 현재 주소는 <code>{typeof window === 'undefined' ? '' : window.location.origin}</code>입니다.</p>
          <button className={styles.primary}>연결 설정 저장</button>
        </form>}
      </details>
  </EntryScreen>;

  if (selectedClass) return <><ClassWorkspace key={selectedClass.id} classItem={selectedClass} assignments={assignments} roster={roster} rosterError={rosterError} busy={busy}
    onBack={backToClasses} onOpen={openAssignment} onRefresh={() => openClass(selectedClass, { refreshCover: true })} onRetryRoster={refreshRoster}
    onCreate={process.env.NEXT_PUBLIC_APP_MODE !== 'readonly' ? () => setCreation({ kind: 'assignment' }) : undefined} onResume={resumeAssignment}
    account={account} onLogout={disconnect} onReconnect={connect}>{messages}</ClassWorkspace>{creationDialog}</>;

  return <div className={selectionStyles.page}>
    <ClassSelectionHeader displayName={account?.displayName} onLogout={disconnect} onReconnect={connect} loading={busy} />
    <main className={selectionStyles.main}>
      {messages}
      <ClassSelection classItems={classes} onSelect={openClass} disabled={busy} onRefresh={refreshClasses} onCreate={process.env.NEXT_PUBLIC_APP_MODE !== 'readonly' ? () => setCreation({ kind: 'class' }) : undefined} />
      <MadeByStamp />
    </main>
    {creationDialog}
  </div>;
}
