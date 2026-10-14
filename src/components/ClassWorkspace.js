'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import BrandMark from './BrandMark';
import MadeByStamp from './MadeByStamp';
import AssignmentEditDialog from './AssignmentEditDialog';
import styles from './ClassWorkspacePreview.module.css';
import real from './ClassWorkspace.module.css';

function Icon({ name, size = 18 }) {
  const paths = {
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    back: <path d="m14 6-6 6 6 6" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function RosterDialog({ className, roster, error, onRetry, onClose, busy }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [search, setSearch] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const visible = (roster || []).filter((student) => `${student.number ?? ''} ${student.name}`.includes(search.trim()));
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>{className} 학생 명단</h2><button className={styles.iconButton} onClick={onClose} aria-label="닫기"><Icon name="close" /></button></div>
    <div className={styles.dialogBody}>
      {error ? <div className={real.rosterError} role="alert"><p>{error}</p><button className={styles.secondaryButton} onClick={onRetry} disabled={busy}>명단 다시 불러오기</button></div> : <>
        <div className={real.rosterToolbar}><span>전체 {roster?.length ?? 0}명</span><label className={styles.search}><Icon name="search" size={16} /><input aria-label="학생 명단 검색" placeholder="번호 또는 이름 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className={real.rosterGrid}>{visible.map((student) => <div key={student.id}><span>{student.number !== null ? `${student.number}번` : '번호 없음'}</span><strong>{student.name}</strong></div>)}</div>
        {!visible.length && <p className={real.noStudents}>{search ? '검색한 학생이 없어요.' : '등록된 학생이 없어요.'}</p>}
      </>}
    </div>
    <div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={onClose}>닫기</button></div>
  </dialog>;
}

function AssignmentCover({ assignment }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const cover = assignment.cover;
  if (cover && failedUrl !== cover.url) return <div className={real.assignmentCover}>
    <Image className={real.coverImage} src={cover.url} width={cover.width} height={cover.height} unoptimized referrerPolicy="no-referrer" alt={`${assignment.name} ${cover.source === 'student' ? '학생 슬라이드' : '예시 슬라이드'} 첫 장`} onError={() => setFailedUrl(cover.url)} />
    <span className={real.coverLabel}>{cover.source === 'student' ? '학생 슬라이드 · 첫 장' : '예시 슬라이드 · 첫 장'}</span>
  </div>;
  const loading = !assignment.summary && !assignment.summaryError && !assignment.coverError;
  return <div className={real.assignmentCover}><div className={real.coverFallback}><Image src="/google-slides.svg" width={32} height={40} alt="" /><span>{assignment.slidesTrashed ? '학생 슬라이드를 휴지통으로 옮겼어요' : loading ? '첫 장 불러오는 중…' : assignment.coverError || failedUrl ? '첫 장을 불러오지 못했어요' : '연결된 슬라이드가 없어요'}</span></div></div>;
}

function AssignmentTrashDialog({ assignment, onDelete, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [deleting, setDeleting] = useState(false);
  const [scope, setScope] = useState(assignment.slidesTrashed ? 'all' : 'slides');
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  const close = () => { if (!deleting) onClose(); };
  async function confirm() {
    if (deleting) return;
    setDeleting(true); setError('');
    try { await onDelete(assignment, scope); onClose(); }
    catch (err) { setError(err.message); }
    finally { setDeleting(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>휴지통으로 옮길 항목 선택</h2><button className={styles.iconButton} onClick={close} disabled={deleting} aria-label="닫기"><Icon name="close" /></button></div>
    <div className={styles.dialogBody}>
      <p className={real.trashTitle}>{assignment.name}</p>
      <fieldset className={real.trashChoices}><legend>삭제 범위</legend>
        <label className={scope === 'slides' ? real.trashChoiceSelected : ''}><input type="radio" name="trash-scope" value="slides" checked={scope === 'slides'} onChange={() => setScope('slides')} disabled={deleting || assignment.slidesTrashed} /><span><strong>학생 슬라이드만</strong><small>과제 카드, 작업 기록, 접속 시트, 교사 기록{assignment.creationId ? ', 배부 원본' : ''}은 남겨요.</small></span></label>
        <label className={scope === 'all' ? real.trashChoiceSelected : ''}><input type="radio" name="trash-scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} disabled={deleting} /><span><strong>과제와 기록까지 모두</strong><small>학생 슬라이드와 과제 시트, 접속 시트, 교사 기록{assignment.creationId ? ', 배부 원본' : ''}을 함께 옮겨요.</small></span></label>
      </fieldset>
      {assignment.slidesTrashed && <p className={real.trashNote}>학생 슬라이드는 이미 휴지통으로 옮겼습니다.</p>}
      <p className={styles.dialogDescription}>{scope === 'slides' ? '과제 카드는 남아 저장된 기록을 볼 수 있습니다. 기존 학생 접속 시트와 슬라이드 연결 정보도 남습니다.' : '과제 카드가 목록에서 사라지고 학생 접속 시트도 휴지통으로 이동합니다.'}</p>
      <p className={real.trashNote}>휴지통 이동만으로 기존 공유 링크의 접근이 즉시 차단되는 것은 아닙니다.</p>
      <p className={real.trashNote}>처음 선택한 예시 슬라이드와 학급 명단은 유지됩니다. Google Drive 휴지통에서 각 파일을 복원할 수 있습니다.</p>
      {error && <p className={real.editError} role="alert">{error}</p>}
    </div>
    <div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={close} disabled={deleting}>취소</button><button className={real.trashConfirm} onClick={confirm} disabled={deleting}>{deleting ? '휴지통으로 옮기는 중…' : scope === 'slides' ? '학생 슬라이드 휴지통으로 이동' : '과제와 기록 휴지통으로 이동'}</button></div>
  </dialog>;
}

export default function ClassWorkspace({ classItem, assignments, roster, rosterError, busy, onBack, onOpen, onCreate, onImport, onResume, onEdit, onSaveEdit, onDelete, onRefresh, onRetryRoster, account, onLogout, onReconnect, children }) {
  const [search, setSearch] = useState('');
  const [showRoster, setShowRoster] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [editError, setEditError] = useState('');
  async function editAssignment(assignment) {
    setEditError('');
    try { setEditing(await onEdit(assignment)); }
    catch (error) { setEditError(error.message); }
  }
  const visible = assignments.filter((assignment) => assignment.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <button className={`${styles.brand} ${real.brandButton}`} onClick={onBack} disabled={busy}><BrandMark size={36} /><span>G배움로그</span></button>
      <div className={real.headerActions}><span>{account?.displayName && `${account.displayName} 선생님`}</span><button className={real.plainButton} onClick={onReconnect} disabled={busy}>다시 로그인</button><button className={real.plainButton} onClick={onLogout} disabled={busy}>로그아웃</button></div>
    </div></header>
    <main className={styles.main}>
      <button className={`${styles.backLink} ${real.backButton}`} onClick={onBack} disabled={busy}><Icon name="back" size={15} /> 학급 목록</button>
      <div className={styles.classHeading}>
        <div><p className={styles.context}>우리 학급의 배움 기록</p><h1>{classItem.name}</h1><p className={styles.description}>과제를 열고 학생의 작업을 살펴보세요.</p></div>
        <button className={styles.rosterButton} onClick={() => setShowRoster(true)}><Icon name="people" /><span>{roster ? <>학생 <strong>{roster.length}명</strong></> : '학생 명단'}</span><span className={styles.rosterLabel}>명단 보기</span></button>
      </div>
      {children}
      <section className={styles.assignments} aria-labelledby="assignment-title">
        <div className={styles.sectionHeading}><div className={styles.sectionTitle}><h2 id="assignment-title">수업 과제</h2><span>{assignments.length}개</span></div>{onCreate && <div className={real.assignmentActions}>{onImport && <button className={styles.secondaryButton} onClick={onImport} disabled={busy}>기존 과제 가져오기</button>}<button className={styles.primaryButton} onClick={onCreate} disabled={busy || !roster?.length}>＋ 새 과제 만들기</button></div>}</div>
        <div className={styles.toolbar}><div className={real.listActions}><span className={real.listCount}>전체 과제 {assignments.length}개</span><button className={styles.textButton} onClick={onRefresh} disabled={busy}>새로고침</button></div><label className={styles.search}><Icon name="search" size={17} /><input aria-label="과제 검색" placeholder="과제 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className={styles.grid}>
          {visible.map((assignment) => <article key={assignment.id} className={styles.card}>
            <div className={`${styles.cardTop} ${real.cardTop}`}><span className={styles.tool}><Image src="/google-slides.svg" width={17} height={21} alt="" /> Google Slides</span><div className={real.cardActions}>{!assignment.slidesTrashed && assignment.setupStatus && assignment.setupStatus !== 'ready' && <button className={real.resumeButton} onClick={() => onResume?.(assignment)} disabled={busy}>배부 이어하기</button>}{onEdit && <button className={real.editButton} onClick={() => editAssignment(assignment)} disabled={busy} aria-label={`${assignment.name} 수정`}>수정</button>}{onDelete && <button className={real.trashButton} onClick={() => setDeleting(assignment)} disabled={busy} aria-label={`${assignment.name} 휴지통으로 이동`}>삭제</button>}</div></div>
            <AssignmentCover assignment={assignment} />
            <div className={styles.cardBody}>
              {assignment.createdAt && <p className={styles.cardDate}>{new Date(assignment.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 생성</p>}
              <h3>{assignment.name}</h3>
              {assignment.slidesTrashed && <span className={real.trashedBadge}>학생 슬라이드 휴지통 이동</span>}
              <p className={styles.cardMeta}>{assignment.summary ? `학생 ${assignment.summary.studentCount}명 · 슬라이드 연결 ${assignment.summary.linkedCount}명` : assignment.summaryError ? '학생 수 미확인' : '학생 목록 확인 중…'}</p>
              {assignment.keywords?.length > 0 && <div className={styles.keywords} aria-label="핵심 키워드">{assignment.keywords.slice(0, 3).map((word) => <span key={word}>{word}</span>)}{assignment.keywords.length > 3 && <span>+{assignment.keywords.length - 3}</span>}</div>}
              {assignment.settingsError && <p className={real.summaryError}>수정한 제목과 키워드를 불러오지 못했어요. 수정에서 다시 확인해 주세요.</p>}
              {assignment.summaryError && <p className={real.summaryError}>과제를 열어 기록을 다시 확인해 주세요.</p>}
            </div>
            <button className={styles.cardButton} disabled={busy} onClick={() => onOpen(assignment)} aria-label={`${assignment.name} ${assignment.slidesTrashed ? '저장된 기록 보기' : '학생 작업 살펴보기'}`}><span>{assignment.slidesTrashed ? '저장된 기록 보기' : '학생 작업 살펴보기'}</span><Icon name="arrow" size={17} /></button>
          </article>)}
        </div>
        {!visible.length && <div className={styles.empty}><h3>{search ? '검색한 과제가 없어요' : '첫 과제를 만들어 보세요'}</h3><p>{search ? '다른 과제 이름을 검색해 주세요.' : '새 과제를 만들거나 이전 G배움로그 과제 시트를 가져올 수 있어요.'}</p>{search ? <button className={styles.secondaryButton} onClick={() => setSearch('')}>전체 과제 보기</button> : onCreate && <div className={real.assignmentActions}>{onImport && <button className={styles.secondaryButton} onClick={onImport} disabled={busy}>기존 과제 가져오기</button>}<button className={styles.primaryButton} onClick={onCreate} disabled={busy || !roster?.length}>새 과제 만들기</button></div>}</div>}
      </section>
      <MadeByStamp />
    </main>
    {showRoster && <RosterDialog className={classItem.name} roster={roster} error={rosterError} busy={busy} onRetry={onRetryRoster} onClose={() => setShowRoster(false)} />}
    {editError && <div className={real.editBanner} role="alert">{editError}<button onClick={() => setEditError('')}>닫기</button></div>}
    {editing && <AssignmentEditDialog key={editing.id} assignment={editing} existingNames={assignments.filter((item) => item.id !== editing.id).map((item) => item.name)} onSave={onSaveEdit} onClose={() => setEditing(null)} />}
    {deleting && <AssignmentTrashDialog key={deleting.id} assignment={deleting} onDelete={onDelete} onClose={() => setDeleting(null)} />}
  </div>;
}
