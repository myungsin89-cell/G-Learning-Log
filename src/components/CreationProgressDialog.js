'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './ClassWorkspacePreview.module.css';
import real from './ClassroomCreation.module.css';

export default function CreationProgressDialog({ kind, name, className, busy, progress, result, error, onRetry, onBack, onClose, onCreated }) {
  const dialog = useRef(null), titleId = useId(), descriptionId = useId();
  const isClass = kind === 'class';
  const warnings = result?.warnings || [];
  const complete = Boolean(result) && !busy;
  const percent = Math.max(0, Math.min(100, progress.percent));
  const title = busy ? isClass ? '학급을 만들고 있어요' : '학생 슬라이드를 만들고 있어요'
    : error ? '잠시 멈췄어요' : warnings.length ? '슬라이드 생성 완료 · 공유 확인 필요' : isClass ? '학급을 만들었어요' : '학생 슬라이드를 모두 만들었어요';
  const close = () => { if (!busy) onClose(); };
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className={`${styles.dialog} ${real.progressDialog}`} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" className={styles.iconButton} disabled={busy} onClick={close} aria-label="닫기">×</button></div>
    <div className={real.progressBody}>
      <p id={descriptionId} className={real.progressContext}>{className && !isClass ? `${className} · ` : ''}{name}</p>
      <div className={real.progressAmount}><strong>{percent}<span>%</span></strong>{busy && <span className={real.spinner} aria-hidden="true" />}{complete && !warnings.length && <span className={real.doneMark} aria-hidden="true">✓</span>}</div>
      <progress className={real.progressBar} max="100" value={percent} aria-label={isClass ? '학급 생성 진행률' : '슬라이드 생성 진행률'} />
      {!isClass && <p className={real.studentCount}>학생 슬라이드 <strong>{progress.completed} / {progress.total}개</strong> 생성 완료</p>}
      <p className={real.progressMessage} role="status" aria-live="polite">{error ? '완료된 파일은 보관되어 있어요.' : complete ? warnings.length ? '슬라이드는 만들었지만 일부 공유 설정을 다시 확인해야 해요.' : isClass ? '학생 명단을 저장했습니다.' : '과제와 학생 접속 안내를 준비했습니다.' : progress.message}</p>
      {error && <div className={real.warning} role="alert"><p>{error}</p><span>다시 시도하면 이미 생성한 파일을 확인하고 이어서 진행합니다.</span></div>}
      {warnings.length > 0 && !busy && <div className={real.warning} role="alert"><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      {busy && <p className={real.progressHint}>생성이 끝날 때까지 이 화면을 열어두세요.</p>}
    </div>
    {!busy && <div className={`${styles.dialogActions} ${real.progressActions}`}>
      {error ? <button type="button" className={styles.secondaryButton} onClick={onBack}>입력 내용 확인</button> : <button type="button" className={styles.secondaryButton} onClick={close}>닫기</button>}
      {(error || warnings.length > 0) && <button type="button" className={warnings.length ? styles.secondaryButton : styles.primaryButton} onClick={onRetry}>이어서 다시 시도</button>}
      {result && <button type="button" className={styles.primaryButton} onClick={() => onCreated(result)}>{isClass ? '학급 열기' : '과제 열기'}</button>}
    </div>}
  </dialog>;
}
