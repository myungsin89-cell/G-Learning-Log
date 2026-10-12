'use client';

import styles from './SlideDashboardPreview.module.css';

export default function StudentRecordControl({ collection }) {
  if (!collection || (!collection.canChange && !collection.ended && !collection.paused && !collection.error)) return null;
  return <footer className={styles.recordControlFooter}>
    {collection.canChange && <button type="button" className={styles.recordControlButton} disabled={collection.busy || (!collection.ready && !collection.unsaved)} title={collection.paused ? '이 학생의 새 작업과 댓글 확인을 재개합니다.' : '이 학생의 새 작업과 댓글 확인을 중지합니다. 기존 기록은 유지합니다.'} onClick={() => collection.onChange(collection.unsaved || !collection.paused)}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{collection.paused && !collection.unsaved ? <path d="m8 5 11 7-11 7V5Z" /> : <path d="M8 5v14M16 5v14" />}</svg>
      {collection.busy ? '저장 중…' : collection.unsaved ? '중지 상태 다시 저장' : collection.paused ? '기록 재개' : '기록 중지'}
    </button>}
    {collection.ended ? <p className={styles.smallNote}>모니터링이 종료되어 저장된 기록만 보고 있습니다.</p> : collection.paused && <p className={styles.smallNote} role="status">새 작업과 댓글 확인을 중지했습니다. 기존 기록은 유지합니다.</p>}
    {collection.error && <p className={styles.slideError} role="alert">{collection.error}</p>}
  </footer>;
}
