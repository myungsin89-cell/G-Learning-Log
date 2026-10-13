'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { assignmentDetailsPayload } from '@/lib/assignmentDetails.mjs';
import KeywordInput from './KeywordInput';
import styles from './ClassWorkspacePreview.module.css';
import real from './ClassWorkspace.module.css';

export default function AssignmentEditDialog({ assignment, existingNames, onSave, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [title, setTitle] = useState(assignment.name);
  const [keywords, setKeywords] = useState(assignment.keywords || []);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    try {
      if (draft.trim()) throw new Error('입력한 키워드는 추가를 눌러 목록에 넣어 주세요.');
      const details = assignmentDetailsPayload(title, keywords);
      if (details.title !== assignment.name && existingNames.includes(details.title)) throw new Error('같은 이름의 과제가 이미 있습니다.');
      setSaving(true); setError('');
      await onSave(assignment, details);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  const close = () => { if (!saving) onClose(); };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>수업 과제 수정</h2><button className={styles.iconButton} type="button" onClick={close} disabled={saving} aria-label="닫기">×</button></div>
    <form onSubmit={submit}>
      <div className={styles.dialogBody}>
        <p className={styles.dialogDescription}>과제 목록에 보이는 제목과 살펴볼 핵심 키워드를 수정하세요.</p>
        <label className={styles.field}>과제 제목<input value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} maxLength={80} required autoFocus disabled={saving} /></label>
        <div className={styles.field}><span>핵심 키워드 <span className={styles.optional}>선택</span></span><KeywordInput words={keywords} onChange={(value) => { setKeywords(value); setError(''); }} draft={draft} onDraftChange={(value) => { setDraft(value); setError(''); }} disabled={saving} /><small>추가한 키워드는 저장 후 학생 작업 확인에 반영됩니다.</small></div>
        <p className={real.editNote}>제목은 학생 접속 화면에도 반영됩니다. 학생 슬라이드와 접속 링크 주소는 그대로 유지됩니다.</p>
        {error && <p className={real.editError} role="alert">{error}</p>}
      </div>
      <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={close} disabled={saving}>취소</button><button className={styles.primaryButton} disabled={saving}>{saving ? '저장 중…' : '수정 내용 저장'}</button></div>
    </form>
  </dialog>;
}
