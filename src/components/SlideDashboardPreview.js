'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import MadeByStamp from './MadeByStamp';
import { createPreviewStudents, createPreviewConversations } from '@/lib/slidePreviewData';
import { studentLabel, unreadStudentReplies, createSummaryCsv, createAnalysisExport } from '@/lib/workRecords.mjs';
import StudentWorkDetail from './StudentWorkDetail';
import StudentAccess from './StudentAccess';
import KeywordInput from './KeywordInput';
import { studentKey, formatAmount, formatCheckedAt, createStoredAnalysisExport, summarizeStudentCard } from '@/lib/storedWorkRecords.mjs';
import styles from './SlideDashboardPreview.module.css';

const previewStatuses = {
  active: { label: '변경 감지', hint: '최근 확인에서 슬라이드 변화가 있었어요.' },
  idle: { label: '변화 없음', hint: '7분 동안 새 변화가 없어요.' },
  surge: { label: '텍스트 급증', hint: '최근 글자 수가 크게 늘었어요.' },
  unstarted: { label: '첫 기록', hint: '비교할 이전 기록이 없어요.' },
};

function Icon({ name, size = 18 }) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    back: <path d="m14 6-6 6 6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    external: <><path d="M14 4h6v6m0-6-9 9" /><path d="M20 14v6H4V4h6" /></>,
    students: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    edit: <><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m14 5 5 5" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StatusBadge({ status, label }) {
  return <span className={`${styles.status} ${styles[status]}`}><i />{label || previewStatuses[status].label}</span>;
}

function PreviewModal({ title, onClose, drawer = false, headingMeta, headerAction, children, locked = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={ref} className={drawer ? styles.drawer : styles.modal} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }} onClick={(event) => { if (!locked && event.target === event.currentTarget) onClose(); }}>
    <div className={`${styles.modalHeader} ${drawer ? styles.drawerHeader : ''}`}>
      {drawer ? <div className={styles.drawerHeading}>{headingMeta}<h2 id={titleId}>{title}</h2></div> : <h2 id={titleId}>{title}</h2>}
      {headerAction && <div className={styles.drawerHeaderAction}>{headerAction}</div>}
      <button className={styles.iconButton} aria-label="닫기" onClick={onClose} disabled={locked}><Icon name="close" /></button>
    </div>
    {children}
  </dialog>;
}

function KeywordEditor({ keywords, onSave, onClose, error, readOnly }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const [words, setWords] = useState(() => [...keywords]), [draft, setDraft] = useState('');
  return <PreviewModal title="핵심 키워드 추가·수정" onClose={onClose} locked={saving}><form onSubmit={async (event) => {
    event.preventDefault(); if (saving) return;
    if (draft.trim()) { setFailed('입력한 키워드는 추가를 눌러 목록에 넣어 주세요.'); return; }
    setSaving(true); setFailed('');
    try { if (!await onSave(words)) setFailed('저장하지 못했습니다. 입력 내용은 유지됩니다.'); }
    catch (err) { setFailed(err.message); }
    finally { setSaving(false); }
  }}>
    <div className={styles.modalBody}><KeywordInput words={words} onChange={(value) => { setWords(value); setFailed(''); }} draft={draft} onDraftChange={(value) => { setDraft(value); setFailed(''); }} disabled={saving} />
      <p className={styles.smallNote}>추가한 목록을 확인한 뒤 저장하세요. ×를 눌러 개별 키워드를 삭제할 수 있습니다.</p>
      <p className={styles.smallNote}>{readOnly ? 'Google 시트에 저장합니다. 같은 계정으로 다른 컴퓨터에서도 볼 수 있어요. 학생별 확인 결과는 다음 작업 확인부터 갱신됩니다.' : '시안에서는 이 화면에만 적용됩니다.'}</p>
      {failed && <p className={styles.slideError} role="alert">{failed === '저장하지 못했습니다. 입력 내용은 유지됩니다.' && error ? error : failed}</p>}
    </div><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>취소</button><button className={styles.primaryButton} disabled={saving}>{saving ? 'Google 시트에 저장 중…' : '키워드 저장'}</button></div>
  </form></PreviewModal>;
}

export default function SlideDashboardPreview({ className, assignment, initialData = null, onBack, onHome, onRefresh, onLoadComments, onLoadPresentation, workspace = null, onConfigureEntry }) {
  const readOnly = initialData !== null;
  const canWrite = Boolean(workspace?.enabled);
  const historyBaseline = initialData ? { ...initialData.assignment.templateBaseline, recordedAt: initialData.assignment.templateBaseline?.recordedAt || initialData.rawSource.logRows.findLast((row) => row[0] === 'SYSTEM_BASELINE')?.[1] } : null;
  const statuses = readOnly ? { active: { label: '변화 기록' }, idle: { label: '변화 없음' }, surge: { label: '텍스트 급증' }, unstarted: { label: '변화량 미확인' } } : previewStatuses;
  const [seedStudents] = useState(() => initialData ? initialData.students : createPreviewStudents(assignment.students, assignment.keywords, assignment.roster));
  const students = workspace?.students || seedStudents;
  const [seedKeywords, setKeywords] = useState(assignment.keywords);
  const keywords = workspace?.keywords || seedKeywords;
  const [view, setView] = useState('students');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(assignment.closed);
  const [updated, setUpdated] = useState('12:00:00');
  const [modal, setModal] = useState(null);
  const [mode, setMode] = useState('lesson');
  const [seedThreads, setThreads] = useState(() => initialData ? initialData.threads : createPreviewConversations(students));
  const [seedCommentsLoaded, setCommentsLoaded] = useState([]);
  const commentsLoaded = workspace?.commentsLoaded || seedCommentsLoaded;
  const [presentations, setPresentations] = useState({});
  const presentationRequests = useRef(new Map());
  const [seedMemos, setMemos] = useState({});
  const [seedReadAt, setReadAt] = useState({});
  const [seedReviewed, setReviewed] = useState([]);
  const memos = workspace?.memos || seedMemos, readAt = workspace?.readAt || seedReadAt, reviewed = workspace?.reviewed || seedReviewed;
  const threads = Object.fromEntries(students.map((student) => {
    const key = studentKey(student);
    const current = workspace?.conversations[key] || seedThreads[key] || [];
    const saved = readOnly ? initialData.threads[key] || [] : [];
    const combined = [...saved.filter((thread) => !current.some((item) => item.id === thread.id || item.content === thread.content)), ...current];
    return [key, workspace ? workspace.classify(combined, student) : combined];
  }));
  const [notice, setNotice] = useState('');
  const activeStudent = students.find((student) => studentKey(student) === modal?.number);
  const unread = (student) => unreadStudentReplies(threads[studentKey(student)] || [], readAt[studentKey(student)]);
  const inactiveMinutes = (student) => workspace?.inactiveMinutes?.[studentKey(student)] ?? null;
  const effectiveStatus = (student) => student.status === 'surge' && ((!readOnly && mode === 'project') || reviewed.includes(studentKey(student))) ? 'active' : student.status;
  const needsReview = students.filter((student) => (effectiveStatus(student) === 'surge' || unread(student) > 0 || inactiveMinutes(student) !== null));
  const filteredStudents = students.filter((student) => (
    (filter === 'all' || (filter === 'review' ? needsReview.includes(student) : filter === 'replies' ? unread(student) > 0 : effectiveStatus(student) === filter)) &&
    (studentLabel(student).includes(query.trim()) || String(student.number) === query.trim())
  ));
  const matched = (student) => readOnly ? keywords.filter((keyword) => student.keywordsUsed.includes(keyword)) : student.status === 'unstarted' ? [] : keywords.filter((keyword) => student.text.replace(/\s/g, '').toLowerCase().includes(keyword.replace(/\s/g, '').toLowerCase()));
  const counts = Object.fromEntries(Object.keys(statuses).map((status) => [status, students.filter((student) => effectiveStatus(student) === status).length]));
  const average = (key) => { const known = students.map((student) => student[key]).filter((value) => typeof value === 'number'); return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null; };
  const cardSummary = (student) => summarizeStudentCard(readOnly ? student : { ...student, records: mode === 'lesson' ? student.lessonRecords : student.projectRecords, currentCounts: { charCount: student.chars } });
  const wholeCounts = students.map((student) => cardSummary(student).wholeChars).filter((value) => Number.isFinite(value));
  const cardAverageChars = wholeCounts.length ? Math.round(wholeCounts.reduce((sum, value) => sum + value, 0) / wholeCounts.length) : null;
  const averages = { chars: average('chars'), slides: average('slides'), images: average('images'), wholeChars: cardAverageChars };
  const averageChars = averages.chars === null ? null : Math.round(averages.chars);
  const messages = (student) => (threads[studentKey(student)] || []).flatMap((thread) => [thread, ...thread.replies]);
  const teacherCount = (student) => messages(student).filter((message) => message.role === 'teacher').length;
  const feedbackLabel = (student) => {
    if (!commentsLoaded.includes(studentKey(student))) return messages(student).length ? `저장 피드백 ${messages(student).length}개` : '댓글 미조회';
    const unclassified = messages(student).filter((message) => !['teacher', 'student'].includes(message.role)).length;
    return `교사 ${teacherCount(student)} · 학생 답장 ${studentCount(student)}${unclassified ? ` · 미분류 ${unclassified}` : ''}`;
  };
  const studentCount = (student) => messages(student).filter((message) => message.role === 'student').length;

  async function refreshPresentation(student) {
    if (!student?.slideId || !onLoadPresentation) return;
    const key = studentKey(student);
    // Coalesce repeat clicks while this student's current content is being read.
    if (presentationRequests.current.has(key)) return presentationRequests.current.get(key);
    setPresentations((previous) => ({ ...previous, [key]: { ...previous[key], loading: true, error: '' } }));
    const request = Promise.resolve().then(async () => {
      try {
        const data = await onLoadPresentation(student.slideId);
        setPresentations((previous) => ({ ...previous, [key]: { data, loading: false, error: '' } }));
      } catch (error) {
        setPresentations((previous) => ({ ...previous, [key]: { ...previous[key], loading: false, error: error.message || '슬라이드를 읽지 못했습니다.' } }));
      } finally { presentationRequests.current.delete(key); }
    });
    presentationRequests.current.set(key, request);
    return request;
  }

  async function openStudent(number) {
    setNotice('');
    setModal({ type: 'student', number });
    const student = students.find((item) => studentKey(item) === number);
    // Original slides open in a new tab. Their text is loaded only on explicit request.
    if (readOnly && student?.slideId && onLoadComments) {
      setNotice('슬라이드 댓글을 불러오는 중입니다.');
      try {
        const conversations = workspace ? await workspace.refreshComments(student) : await onLoadComments(student.slideId);
        if (!workspace) { setThreads((previous) => ({ ...previous, [number]: conversations })); setCommentsLoaded((previous) => [...new Set([...previous, number])]); }
        setNotice('슬라이드 댓글을 확인했습니다. 학생으로 확인되지 않은 작성자는 따로 표시합니다.');
      } catch (error) { setNotice(error.message || '댓글을 불러오지 못했습니다.'); }
    }
  }

  async function saveKeywords(words) {
    if (workspace) { if (!await workspace.saveKeywords(words)) return false; }
    else setKeywords(words);
    setModal(null);
    setNotice(readOnly ? '핵심 키워드를 Google 시트에 저장했습니다.' : '시안의 핵심 키워드를 변경했습니다.');
    return true;
  }

  async function addFeedback(content) {
    if (workspace) return workspace.feedback(activeStudent, content);
    setThreads((previous) => ({ ...previous, [activeStudent.number]: [...(previous[activeStudent.number] || []), { id: crypto.randomUUID(), role: 'teacher', origin: 'app', content, createdAt: new Date().toISOString(), replies: [] }] }));
    setNotice('예시 피드백을 남겼습니다. 실제 슬라이드에는 전송되지 않습니다.');
    return true;
  }
  async function addReply(threadId, content) {
    if (workspace) return workspace.feedback(activeStudent, content, threadId);
    const key = studentKey(activeStudent);
    setThreads((previous) => ({ ...previous, [key]: previous[key].map((thread) => thread.id === threadId ? { ...thread, replies: [...thread.replies, { id: crypto.randomUUID(), role: 'teacher', content, createdAt: new Date().toISOString() }] } : thread) }));
    return true;
  }
  async function saveMemo(text) {
    if (workspace) { const saved = await workspace.saveMemo(activeStudent, text); if (saved) setNotice('교사 메모를 Google 시트에 저장했습니다. 교사만 볼 수 있습니다.'); return saved; }
    setMemos((previous) => ({ ...previous, [studentKey(activeStudent)]: text })); setNotice('교사 메모를 시안에 저장했습니다. 학생에게 전달되지 않습니다.'); return true;
  }
  function markRead() {
    if (workspace) return workspace.markRead(activeStudent);
    setReadAt((previous) => ({ ...previous, [studentKey(activeStudent)]: new Date().toISOString() }));
  }
  function review() {
    const key = studentKey(activeStudent);
    if (workspace) return workspace.review(activeStudent, !reviewed.includes(key));
    setReviewed((previous) => previous.includes(key) ? previous.filter((number) => number !== key) : [...previous, key]);
  }

  function exportRecords(kind) {
    const config = { className, assignment, students, keywords, threads, memos, readAt, reviewed, mode, matched };
    const storedExport = readOnly ? createStoredAnalysisExport({ ...initialData, students }, threads, commentsLoaded, presentations) : null;
    if (storedExport && workspace) {
      storedExport.dataKind = 'google_learning_records';
      storedExport.collection = { ...storedExport.collection, readOnly: !canWrite, liveSlideCollection: workspace.running, intervalSeconds: 30 };
      storedExport.definitions.current = '새 기록을 확인한 학생은 currentCounts를 기준으로 표시. 미확인 학생은 기존 앱 저장값. 어느 값도 실시간 편집 전체를 나타내지 않음.';
      storedExport.definitions.comments = '학생을 열거나 수동·수업 확인 중 조회한 댓글. 교사 글과 직접 확인한 학생 답장만 분류하며 실패는 commentsErrors에 보관.';
      storedExport.definitions.slideContents = '본문 확인을 직접 요청한 시점의 슬라이드 본문·노트와 전체 수치. 미조회는 null. 새 스냅샷은 텍스트 원문 대신 장별 수치를 보관.';
      storedExport.definitions.keywords = Array.isArray(workspace.state.settings.keywords) ? '교사가 별도 저장소에 등록한 전체 과제 키워드와 확인 시점별 사용 키워드.' : '기존 저장된 사용 키워드의 합집합. 전체 과제 키워드 수는 미확인.';
      storedExport.definitions.addedAmounts = '새 확인값은 원본 템플릿 기준량을 제외한 수치. 기준량이 미기록된 학생은 기존 추가량을 유지하며 currentCounts에 전체 수치를 따로 제공.';
      storedExport.definitions.teacherMemo = '교사 비공개 저장소에 보관된 메모. 학생 슬라이드와 원본 과제 시트에는 저장하지 않음.';
      storedExport.newWorkspace = { events: workspace.events, invalidRows: workspace.invalidRows, settings: workspace.state.settings, commentsErrors: workspace.commentsErrors };
      storedExport.students = storedExport.students.map((student) => ({ ...student, teacherMemo: memos[student.id] || '', feedbackReadAt: readAt[student.id] || null, surgeReviewed: reviewed.includes(student.id) }));
    }
    const data = kind === 'csv' ? createSummaryCsv(students, { ...config, readOnly, live: canWrite, keywordsKnown: !readOnly || Array.isArray(workspace?.state.settings.keywords) }) : JSON.stringify(readOnly ? storedExport : createAnalysisExport(config), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `G배움로그_${className.replace(/[<>:"/\\|?*]/g, '_')}_${assignment.name.replace(/[<>:"/\\|?*]/g, '_')}_${readOnly ? '저장기록' : '예시'}.${kind}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(readOnly ? '저장된 기록의 내보내기를 요청했습니다. JSON에는 원본 행과 댓글 조회 여부도 포함됩니다.' : kind === 'csv' ? '예시 종합기록 CSV를 내려받았습니다.' : '예시 전체 기록 JSON을 내려받았습니다. 확인 시각과 수집 구분이 포함됩니다.');
  }

  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      {readOnly ? <button className={`${styles.brand} ${styles.brandButton}`} onClick={onHome || onBack}><BrandMark size={34} /><span>G배움로그</span></button> : <Link href="/design-preview/classes" className={styles.brand}><BrandMark size={34} /><span>G배움로그</span></Link>}
      {readOnly ? <button className={styles.backLink} onClick={onBack}><Icon name="back" size={15} /> 과제 목록</button> : <Link className={styles.backLink} href={`/design-preview/classroom?className=${encodeURIComponent(className)}`}><Icon name="back" size={15} /> 과제 목록</Link>}
    </div></header>
    <main className={styles.main}>
      <div className={styles.heading}>
        <div className={styles.headingText}><p className={styles.context}>{className}<span>Google Slides</span>{!readOnly && <span className={styles.previewLabel}>디자인 시안</span>}</p><h1>{assignment.name}</h1></div>
        {readOnly ? <div className={styles.headingActions}><a className={styles.textAction} href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(assignment.id)}/edit`} target="_blank" rel="noopener noreferrer">과제 시트 열기</a><button className={styles.primaryButton} onClick={() => setModal({ type: 'student-access' })}><Icon name="students" />학생 접속 안내</button></div> : <button className={styles.primaryButton} onClick={() => setModal({ type: 'join' })}><Icon name="students" /> 학생 접속 안내</button>}
      </div>
      {readOnly ? <div className={styles.monitorBar}><span className={workspace?.running ? styles.monitorLive : styles.monitorPaused}><i />{workspace?.running ? '수업 확인 중 · 30초 간격' : canWrite ? '수동 확인' : '저장된 기록 보기'}</span><span className={styles.updated}>{workspace?.progress || `${formatCheckedAt(initialData.loadedAt)} 불러옴`}</span><div className={styles.monitorActions}>
        {workspace && process.env.NEXT_PUBLIC_APP_MODE !== 'readonly' && <button disabled={workspace.busy} onClick={() => setModal({ type: 'connect' })}>{canWrite ? '저장 권한 갱신' : 'Google 저장 권한 연결'}</button>}
        {canWrite && <><button disabled={workspace.busy || workspace.running} onClick={workspace.collect}><Icon name="refresh" size={15} />현재 작업 확인</button><button onClick={workspace.toggleLive}><Icon name={workspace.running ? 'pause' : 'play'} size={15} />{workspace.running ? '수업 확인 중지' : '수업 실시간 확인'}</button></>}
        <button disabled={workspace?.busy || workspace?.running} onClick={onRefresh}>기록 새로고침</button>
      </div></div> : <div className={styles.monitorBar}>
        <span className={paused ? styles.monitorPaused : styles.monitorLive}><i />{paused ? (assignment.closed ? '모니터링 종료' : '모니터링 일시 중지') : '모니터링 중'}</span>
        <span className={styles.updated}>예시 기록 · {updated} 확인</span>
        <div className={styles.monitorActions}><button onClick={() => { setUpdated('방금 갱신'); setNotice('예시 기록의 표시를 새로고침했습니다.'); }}><Icon name="refresh" size={15} />새로고침</button><button onClick={() => { setPaused((previous) => !previous); setNotice('시안에서는 표시 상태만 변경됩니다.'); }}><Icon name={paused ? 'play' : 'pause'} size={14} />{paused ? '모니터링 재개' : '일시 중지'}</button></div>
      </div>}
      {workspace?.error && <p className={styles.surgeNotice} role="alert">{workspace.error}</p>}

      <section className={styles.overview} aria-label="학급 작업 요약">
        <div className={styles.total}><span>전체 학생</span><strong>{students.length}<small>명</small></strong></div>
        {Object.entries(statuses).map(([key, status]) => <button key={key} className={styles.stat} onClick={() => { setView('students'); setFilter(key); }} aria-pressed={filter === key && view === 'students'}><span className={styles.statLabel}><i className={styles[key]} />{status.label}</span><strong>{counts[key]}<small>명</small></strong></button>)}
        <div className={styles.average}><span>평균 전체 글자 수</span><strong>{formatAmount(cardAverageChars)}<small>자</small></strong></div>
      </section>
      <div className={styles.viewBar}><div className={styles.viewTabs} aria-label="대시보드 화면 선택"><button aria-pressed={view === 'students'} className={view === 'students' ? styles.selectedView : ''} onClick={() => setView('students')}>학생 작업 현황</button><button aria-pressed={view === 'report'} className={view === 'report' ? styles.selectedView : ''} onClick={() => setView('report')}>종합 기록</button></div><span>{readOnly ? "최근 확인한 기록 기준" : "예시 데이터 기준"}</span></div>

      {view === 'students' ? <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          {readOnly && !workspace ? <section className={styles.reviewPanel} aria-label="저장 기록 안내"><div className={styles.panelHeading}><h2>저장 기록 안내</h2></div><p className={styles.panelDescription}>학생을 선택하면 작업 흐름과 슬라이드 댓글을 확인할 수 있어요. Google 저장 권한을 연결하면 현재 변화를 확인하고 피드백을 남길 수 있습니다.</p><p className={styles.smallNote}>댓글 조회 학생 {commentsLoaded.length} / {students.length}명<br />평균은 수치가 저장된 학생만 계산합니다.</p></section> : <section className={styles.reviewPanel} aria-labelledby="review-heading"><div className={styles.panelHeading}><h2 id="review-heading">먼저 살펴볼 학생</h2><span>{needsReview.length}명</span></div><p className={styles.panelDescription}>{needsReview.length ? '새 학생 답장이나 확인할 변화가 있어요.' : '먼저 살펴볼 학생이 아직 없어요.'}</p>
            {readOnly && workspace && <div className={styles.idleWatchBar}>
              <label className={styles.idleWatchToggle}><input type="checkbox" role="switch" checked={workspace.idleWatchEnabled} onChange={workspace.toggleIdleWatch} aria-describedby="idle-watch-help" /><span aria-hidden="true" />15분간 변화 없는 학생 살펴보기</label>
              <p id="idle-watch-help">{workspace.idleWatchEnabled && !workspace.running ? '실시간 확인을 시작하면 시간을 계산해요.' : '실시간 확인 중에만 적용됩니다.'} 확인이 중단되면 시간을 초기화해요.</p>
            </div>}
            <div className={styles.reviewList}>{[...needsReview].sort((a, b) => Number(effectiveStatus(b) === 'surge') - Number(effectiveStatus(a) === 'surge') || a.number - b.number).slice(0, 4).map((student) => <button key={studentKey(student)} onClick={() => openStudent(studentKey(student))}><span className={styles.reviewNumber}>{student.number ?? '—'}</span><span><strong>{studentLabel(student)}</strong><small>{[effectiveStatus(student) === 'surge' ? readOnly ? `최근 확인에서 ${student.records.at(-1).charDelta}자 증가` : '25초 동안 286자 증가' : null, inactiveMinutes(student) !== null ? `${inactiveMinutes(student)}분간 변화 미확인` : null, unread(student) ? `새 학생 답장 ${unread(student)}개` : null].filter(Boolean).join(' · ')}</small></span><Icon name="arrow" size={14} /></button>)}</div>
            <button className={styles.panelLink} onClick={() => { setFilter('review'); setQuery(''); }}>해당 학생 모두 보기 <Icon name="arrow" size={15} /></button>
          </section>}
          <section className={styles.keywordPanel} aria-labelledby="keyword-heading"><div className={styles.panelHeading}><h2 id="keyword-heading">핵심 키워드</h2>{(!readOnly || (workspace && process.env.NEXT_PUBLIC_APP_MODE !== 'readonly')) && <button className={styles.textAction} aria-label="핵심 키워드 추가·수정" onClick={() => setModal({ type: 'keywords' })}>추가·수정</button>}</div><p className={styles.panelDescription}>{readOnly && !workspace?.state.settings.keywords ? '과제에서 살펴볼 주제어를 등록하세요.' : '슬라이드에 담긴 주제어를 확인해요.'}</p><div className={styles.keywordChips}>{keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}{keywords.length === 0 && <p>등록된 키워드가 없어요.</p>}</div></section>
          <p className={styles.observationNote}>표시 시각은 앱이 변화를 확인한 시각입니다. 변화가 없는 읽기·생각하기 활동과 미수집 기간은 학생과 함께 확인해 주세요.</p>
        </aside>
        <section className={styles.studentPanel} aria-labelledby="students-heading">
          <div className={styles.studentHeading}><h2 id="students-heading">학생별 작업 기록 <span>{filteredStudents.length}명</span></h2><label className={styles.search}><Icon name="search" size={16} /><input aria-label="학생 검색" placeholder="번호 또는 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          <div className={styles.studentFilters} aria-label="학생 상태 필터">{[['all', '전체'], ...(!readOnly || workspace?.storeId ? [['review', '살펴볼 학생'], ['replies', '새 학생 답장']] : []), ...Object.entries(statuses).map(([key, value]) => [key, value.label])].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? styles.selectedFilter : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
          {readOnly && <p className={styles.smallNote}>전체 글자는 최근 확인한 슬라이드의 수치이며 템플릿을 포함합니다. 아직 전체 수치를 확인하지 않은 학생은 —로 표시합니다.</p>}
          <div className={styles.studentGrid}>{filteredStudents.map((student) => {
            const summary = cardSummary(student);
            return <button key={studentKey(student)} className={`${styles.studentCard} ${effectiveStatus(student) === 'surge' ? styles.surgeCard : ''}`} onClick={() => openStudent(studentKey(student))} aria-label={`${studentLabel(student)} 상세 보기`}>
            <span className={styles.studentCardHeader}><strong>{studentLabel(student)}</strong><StatusBadge status={effectiveStatus(student)} label={readOnly && effectiveStatus(student) === 'unstarted' ? summary.recordCount ? `기록 ${summary.recordCount}개` : '저장 기록 없음' : statuses[effectiveStatus(student)].label} /></span>
            <span className={styles.metrics}><span><strong>{formatAmount(summary.wholeChars)}<em>자</em></strong><small>전체 글자</small><span className={styles.cardWholeAmount}>템플릿 포함</span></span><span><strong>{formatAmount(student.slides)}<em>장</em></strong><small>슬라이드</small></span><span><strong>{formatAmount(student.images)}<em>개</em></strong><small>추가 이미지</small></span></span>
            <span className={styles.cardKeywords}><span>키워드</span><strong>{readOnly ? `${matched(student).length}개 기록` : `${matched(student).length} / ${keywords.length}`}</strong><span className={styles.keywordDots}>{keywords.slice(0, 6).map((keyword) => <i key={keyword} className={matched(student).includes(keyword) ? styles.filledDot : ''} />)}</span></span>
            <span className={styles.cardChange}>{inactiveMinutes(student) !== null && <span className={styles.idleWatchNotice}>{inactiveMinutes(student)}분간 변화 미확인</span>}<strong className={styles.cardHistory}>{summary.recent}</strong>{summary.comparisonLabel ? <span className={styles.cardInterval}>{summary.comparisonLabel}</span> : readOnly && summary.recordCount > 0 && <span className={styles.cardInterval}>{summary.historyLabel}</span>}</span>
            <span className={styles.studentCardFooter}><small>{readOnly && !student.checkedAt ? '마지막 저장' : '최근 확인'} {formatCheckedAt(summary.checkedAt)}</small><span className={unread(student) ? styles.unreadBadge : styles.replyMuted}>{unread(student) ? `새 학생 답장 ${unread(student)}` : readOnly ? feedbackLabel(student) : `피드백 ${teacherCount(student)}`}</span></span>
          </button>; })}</div>
          {filteredStudents.length === 0 && <div className={styles.empty}><h3>조건에 맞는 학생이 없어요</h3><p>번호나 상태를 바꿔서 찾아보세요.</p><button className={styles.secondaryButton} onClick={() => { setQuery(''); setFilter('all'); }}>전체 학생 보기</button></div>}
        </section>
      </div> : <section className={styles.report}>
        <div className={styles.reportHeading}><div><h2>{className} 종합 기록</h2><p>전체 작업량과 피드백을 비교하고, 학생을 선택해 과정을 살펴보세요.</p></div><div className={styles.exportActions}><button className={styles.secondaryButton} onClick={() => exportRecords('csv')}>종합기록 CSV</button><button className={styles.primaryButton} onClick={() => exportRecords('json')}>전체 기록 JSON</button><button className={styles.textAction} onClick={() => window.print()}>인쇄</button></div></div>
        <p className={styles.reportScope}>{readOnly ? "저장된 자료" : "예시 자료"} · 학급 평균 {formatAmount(averageChars)}자 / 슬라이드 {formatAmount(averages.slides === null ? null : Number(averages.slides.toFixed(1)))}장 / 추가 이미지 {formatAmount(averages.images === null ? null : Number(averages.images.toFixed(1)))}개 · {readOnly ? canWrite ? "앱을 닫거나 다른 탭으로 이동하면 수집하지 않습니다." : "저장된 확인 시점의 수치입니다." : "앱을 닫은 동안에는 수집하지 않습니다."}</p>
        <div className={styles.tableScroll}><table><thead><tr><th scope="col">학생</th><th scope="col">추가 글자</th><th scope="col">슬라이드</th><th scope="col">추가 이미지</th><th scope="col">키워드</th><th scope="col">피드백</th><th scope="col">교사 메모</th></tr></thead><tbody>{students.map((student) => <tr key={studentKey(student)}><th scope="row"><button onClick={() => openStudent(studentKey(student))}>{studentLabel(student)}</button></th><td>{formatAmount(student.chars)}자</td><td>{formatAmount(student.slides)}장</td><td>{formatAmount(student.images)}개</td><td>{readOnly ? `${matched(student).length}개 기록` : `${matched(student).length} / ${keywords.length}`}</td><td><button onClick={() => openStudent(studentKey(student))}>{readOnly ? feedbackLabel(student) : `교사 ${teacherCount(student)} · 학생 답장 ${studentCount(student)}`}</button>{unread(student) > 0 && <span className={styles.tableUnread}>새 답장 {unread(student)}</span>}</td><td><button className={styles.memoPreview} onClick={() => openStudent(studentKey(student))}>{memos[studentKey(student)] || (readOnly && !canWrite ? '저장된 메모 없음' : '메모 남기기')}</button></td></tr>)}</tbody></table></div>
        <p className={styles.smallNote}>{readOnly ? "JSON에는 원본 행, 확인 구간과 변화량, 조회된 댓글·답장, 작성자 확인 여부와 비공개 교사 메모를 함께 담습니다. 미기록 값과 댓글 조회 실패도 구분합니다." : "JSON에는 실제 수집 구분, 확인 간격, 변화 기록, 댓글·답장과 교사 메모를 함께 담습니다. 현재 내려받는 자료는 예시 데이터입니다."}</p>
      </section>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <p className={styles.previewNote}>{readOnly ? `작업량은 기록을 확인한 시점 사이의 변화입니다. 확인되지 않은 변화량은 미확인으로 표시합니다.${initialData.unmatchedRecords.length ? ` 학생을 확인할 수 없는 기록 ${initialData.unmatchedRecords.length}개는 전체 기록 JSON에서 확인할 수 있습니다.` : ""}` : "디자인 시안 · 기록과 대화는 예시입니다. 입력한 피드백·메모는 이 화면에서만 보관되며 새로고침하면 초기화됩니다."}</p><MadeByStamp />
    </main>

    {modal?.type === 'connect' && <PreviewModal title="Google 저장 권한 연결" onClose={() => setModal(null)}><div className={styles.modalBody}>
      <p className={styles.joinDescription}>작업 흐름과 교사 메모를 저장하고<br />학생에게 피드백을 남겨보세요.</p>
      <ul className={styles.connectionSteps}><li>과제의 교사 전용 저장소에 연결합니다.</li><li>작업 확인 시점·변화량·키워드와 비공개 메모를 이 시트에 추가합니다.</li><li>직접 작성한 피드백과 답글은 학생 원본 슬라이드 댓글에 저장합니다.</li></ul>
      <p className={styles.smallNote}>Google에서 파일 읽기와 앱이 사용하는 파일 편집 권한을 요청합니다. 자료를 불러온 교사와 같은 계정으로 연결해 주세요. 학생 슬라이드 본문은 변경하지 않습니다.</p>
      {workspace?.error && <p className={styles.slideError} role="alert">{workspace.error}</p>}
      {workspace?.error && <p className={styles.slideError} role="alert">{workspace.error}</p>}
    </div><div className={styles.modalActions}><button className={styles.secondaryButton} disabled={workspace?.busy} onClick={() => setModal(null)}>닫기</button><button className={styles.primaryButton} disabled={workspace?.busy} onClick={async () => { if (await workspace.connect()) setModal(null); }}>{workspace?.busy ? '저장소 연결 중…' : 'Google 권한 확인 후 저장 연결'}</button></div></PreviewModal>}
    {modal?.type === 'keywords' && <KeywordEditor keywords={keywords} readOnly={readOnly} onSave={saveKeywords} error={workspace?.error} onClose={() => setModal(null)} />}
    {modal?.type === 'student-access' && <StudentAccess className={className} assignment={assignment} students={students} entry={workspace?.state.settings.studentEntry || assignment.studentEntry} onConfigure={onConfigureEntry} onClose={() => setModal(null)} />}
    {modal?.type === 'join' && <PreviewModal title="학생 접속 안내" onClose={() => setModal(null)}><div className={styles.modalBody}><p className={styles.joinDescription}>학생은 과제 링크로 들어와<br />접속 코드를 입력하고 본인 번호를 선택해요.</p><p className={styles.codeLabel}>접속 코드 예시</p><div className={styles.joinCode}>2684</div><p className={styles.smallNote}>화면 구성을 위한 예시입니다. 실제 접속 링크와 QR은 Google 연결 후 제공됩니다.</p></div><div className={styles.modalActions}><button className={styles.primaryButton} onClick={() => setModal(null)}>확인</button></div></PreviewModal>}
    {modal?.type === 'student' && activeStudent && <PreviewModal drawer title={`${studentLabel(activeStudent)} 작업 기록`} onClose={() => setModal(null)}
      headingMeta={<StatusBadge status={effectiveStatus(activeStudent)} label={statuses[effectiveStatus(activeStudent)].label} />}
      headerAction={readOnly ? activeStudent.slideUrl ? <a className={`${styles.secondaryButton} ${styles.studentSlideButton}`} href={activeStudent.slideUrl} target="_blank" rel="noopener noreferrer">슬라이드 열기<Icon name="external" size={14} /></a> : <span className={styles.drawerMissingSlide}>슬라이드 미연결</span> : <button className={`${styles.secondaryButton} ${styles.studentSlideButton}`} onClick={() => setNotice('시안에는 실제 학생 슬라이드가 없습니다. Google 연결 후 원본을 열 수 있어요.')}>슬라이드 열기<Icon name="external" size={14} /></button>}>
      {inactiveMinutes(activeStudent) !== null && <p className={styles.drawerNotice}>{inactiveMinutes(activeStudent)}분간 변화가 확인되지 않았어요. 읽거나 생각하는 중일 수 있으니 학생의 상황을 함께 살펴보세요.</p>}
      {notice && <p className={styles.drawerNotice} role="status">{notice}</p>}
      <StudentWorkDetail templateBaseline={historyBaseline} readOnly={readOnly} canWrite={canWrite} canSaveMemo={Boolean(workspace && activeStudent.slideId && process.env.NEXT_PUBLIC_APP_MODE !== 'readonly')} workspaceError={workspace?.error} commentsError={workspace?.commentsErrors[studentKey(activeStudent)]} onRefreshComments={() => workspace?.refreshComments(activeStudent)} onConfirmAuthor={(message, role) => workspace?.confirmAuthor(activeStudent, message, role)} presentationState={presentations[studentKey(activeStudent)]} onRefreshPresentation={() => refreshPresentation(activeStudent)} key={studentKey(activeStudent)} student={activeStudent} averages={averages} mode={mode} setMode={setMode} threads={threads[studentKey(activeStudent)] || []} unread={unread(activeStudent)} onRead={markRead} onFeedback={addFeedback} onReply={addReply} memo={memos[studentKey(activeStudent)] || ''} onMemo={saveMemo} surge={activeStudent.status === 'surge' && (readOnly || mode === 'lesson')} reviewed={reviewed.includes(studentKey(activeStudent))} onReview={review} />
    </PreviewModal>}
  </div>;
}
