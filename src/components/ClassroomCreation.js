'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { classroomName, classroomKeywords } from '@/lib/googleClassroom.mjs';
import KeywordInput from './KeywordInput';
import CreationProgressDialog from './CreationProgressDialog';
import { assertRosterConfirmation } from '@/lib/classroomPrivacy.mjs';
import { parseRosterInput } from '@/lib/workRecords.mjs';
import { parsePresentationId } from '@/lib/slideContents.mjs';
import styles from './ClassWorkspacePreview.module.css';
import real from './ClassroomCreation.module.css';

export default function ClassroomCreation({ kind, className, roster = [], existingNames = [], initialPlan, onCreate, onCreated, onClose, onPickTemplate, preview = false }) {
  const dialog = useRef(null), job = useRef(null), prepared = useRef(initialPlan || null), inFlight = useRef(false);
  const titleId = useId();
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState({ percent: 0, completed: 0, total: 0, message: '' }), [error, setError] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [locked, setLocked] = useState(Boolean(initialPlan)), [result, setResult] = useState(null);
  const [template, setTemplate] = useState(() => {
    const id = parsePresentationId(initialPlan?.templateUrl);
    return id ? { id, name: initialPlan?.templateName || '선택한 예시 슬라이드' } : preview ? { id: 'preview-template', name: '식물 관찰 예시 슬라이드' } : null;
  });
  const [pickingTemplate, setPickingTemplate] = useState(false);
  const [keywordList, setKeywordList] = useState(() => classroomKeywords(initialPlan?.keywords ?? initialPlan?.keywordsText ?? '')), [keywordDraft, setKeywordDraft] = useState('');
  const members = initialPlan?.roster || roster;
  const [selected, setSelected] = useState(() => members.filter((student) => Number.isSafeInteger(student.number)).map((student) => student.number));
  const isClass = kind === 'class';
  useEffect(() => { const element = dialog.current; if (showProgress) element.close(); else element.showModal(); return () => { if (element.open) element.close(); }; }, [showProgress]);
  async function submit(event) {
    event?.preventDefault(); if (inFlight.current) return; inFlight.current = true; setError('');
    try {
      if (!prepared.current) {
        if (!isClass && keywordDraft.trim()) throw new Error('입력한 키워드는 추가를 눌러 목록에 넣어 주세요.');
        const form = new FormData(event.currentTarget);
        const name = classroomName(form.get('name'));
        if (isClass && (name === 'Sheet1' || name.startsWith('_'))) throw new Error('학급 이름에는 Sheet1이나 _로 시작하는 이름을 사용할 수 없습니다.');
        if (existingNames.includes(name)) throw new Error('같은 이름이 이미 있습니다. 구분할 수 있는 이름을 입력해 주세요.');
        if (isClass && !preview) assertRosterConfirmation(form.get('privacyConfirmed') === 'on');
        const payload = isClass ? { name, rosterText: String(form.get('roster')), privacyConfirmed: form.get('privacyConfirmed') === 'on' } : { name, className, templateUrl: String(form.get('template')), templateName: template?.name || '', keywords: keywordList, shareSlides: form.get('share') === 'on', entryMode: String(form.get('entryMode') || 'shared'), roster: members.filter((student) => selected.includes(student.number)) };
        parseRosterInput(isClass ? payload.rosterText : payload.roster.map((student) => `${student.number} ${student.name}`).join('\n'));
        if (!isClass && !parsePresentationId(payload.templateUrl)) throw new Error('Google 슬라이드 템플릿 주소를 확인해 주세요.');
        prepared.current = payload;
      }
      job.current ||= prepared.current.jobId || crypto.randomUUID();
      dialog.current.close();
      setBusy(true); setLocked(true); setResult(null); setShowProgress(true);
      setProgress({ name: prepared.current.name, percent: 0, completed: 0, total: isClass ? 0 : prepared.current.roster.length, message: 'Google 연결 확인 중…' });
      const created = await onCreate({ ...prepared.current, jobId: job.current, onProgress: (message, details = {}) => setProgress((previous) => ({ ...previous, ...details, message })) });
      setResult(created);
      setProgress((previous) => ({ ...previous, percent: 100, message: '생성을 완료했습니다.' }));
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function chooseTemplate() {
    if (!onPickTemplate || pickingTemplate) return;
    setPickingTemplate(true); setError('');
    const element = dialog.current;
    element?.close();
    try {
      const selectedFile = await onPickTemplate();
      if (selectedFile) setTemplate(selectedFile);
    } catch (err) { setError(err.message); }
    finally {
      if (element?.isConnected && !element.open) element.showModal();
      setPickingTemplate(false);
    }
  }
  const close = () => { if (!busy) onClose(); };
  return <><dialog ref={dialog} className={`${styles.dialog} ${real.dialog}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>{isClass ? '새 학급 만들기' : initialPlan ? '과제 배부 이어하기' : '새 과제 만들기'}</h2><button className={styles.iconButton} onClick={close} disabled={busy} aria-label="닫기">×</button></div>
    <form onSubmit={submit}>
      <div className={`${styles.dialogBody} ${real.body}`}>
        {!isClass && <div className={real.context}>{className}<span>Google Slides</span></div>}
        <fieldset disabled={busy || locked} className={real.fields}>
          <label className={styles.field}>{isClass ? '학급 이름' : '과제 이름'}<input name="name" defaultValue={initialPlan?.name || ''} required maxLength={80} placeholder={isClass ? '예: 4학년 4반' : '예: 달의 모양 관찰하기'} autoComplete="off" /></label>
          {isClass ? <><label className={styles.field}>학생 명단<textarea name="roster" required rows={8} placeholder={'1 김누리\n4 송명신\n5 달빛'} /><small>한 줄에 출석번호와 이름 또는 가명을 입력하세요. 빠진 번호는 그대로 두면 됩니다. 최대 50명.</small></label>{!preview && <div className={real.privacyNotice}><strong>명단 등록 전 확인</strong><p>번호·이름 또는 가명은 교사의 Google 시트에 저장합니다. 이후 공통 학생 링크를 만들면 링크 소지자가 목록과 연결 정보를 볼 수 있습니다.</p><label><input type="checkbox" name="privacyConfirmed" required /><span>수집·보관·공유 안내와 필요한 동의 또는 다른 적법한 처리 근거를 확인했습니다.</span></label><small>동의가 필요한 만 14세 미만 학생은 법정대리인의 동의와 그 확인 기록도 필요합니다. 이 확인란은 실제 동의서를 대신하지 않습니다.</small><a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침 보기</a></div>}</> : <>
            <div className={styles.field}><span>예시 슬라이드</span><input name="template" type="hidden" value={template?.id || ''} readOnly /><div className={real.pickerField}><button type="button" className={styles.secondaryButton} onClick={chooseTemplate} disabled={busy || locked || pickingTemplate || !onPickTemplate}>{pickingTemplate ? 'Google Drive 여는 중…' : template ? '다른 슬라이드 선택' : 'Google Drive에서 선택'}</button>{template ? <span className={real.pickedFile}><strong>{template.name}</strong><small>선택 완료</small></span> : <span className={real.pickerEmpty}>학생별로 복사할 Google Slides 파일을 선택하세요.</span>}</div><small>선택한 파일의 첫 장을 과제 카드 표지로 사용하고, 학생마다 사본을 만듭니다. 기본 글자와 이미지는 추가 작업량에서 제외합니다.</small></div>
            <div className={styles.field}><span>핵심 키워드 <span className={styles.optional}>선택</span></span><KeywordInput words={keywordList} onChange={setKeywordList} draft={keywordDraft} onDraftChange={setKeywordDraft} disabled={busy || locked} /><small>단어를 하나씩 추가하세요. 나중에도 추가·수정할 수 있습니다.</small></div>
            <details className={styles.recipientPicker}><summary>배부할 학생 <strong>{selected.length}명</strong></summary><div className={styles.recipientActions}><button type="button" className={styles.textButton} onClick={() => setSelected(members.filter((student) => Number.isSafeInteger(student.number)).map((student) => student.number))}>전체 선택</button><button type="button" className={styles.textButton} onClick={() => setSelected([])}>선택 해제</button></div><div className={styles.checkGrid}>{members.map((student) => <label key={student.id || student.number}><input type="checkbox" disabled={!Number.isSafeInteger(student.number)} checked={selected.includes(student.number)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, student.number] : previous.filter((number) => number !== student.number))} />{student.number === null ? '번호 없음' : `${student.number}번`} {student.name}</label>)}</div></details>
            {members.some((student) => !Number.isSafeInteger(student.number)) && <p className={real.warning}>출석번호가 없는 학생은 배부할 수 없습니다. 번호를 포함한 학급 명단을 등록해 주세요.</p>}
            <div className={real.entryMode}><strong>학생 접속 방식</strong><label><input type="radio" name="entryMode" value="shared" defaultChecked={(initialPlan?.entryMode || 'shared') === 'shared'} /><span>공통 학생 링크에서 이름 선택<small>기본 · QR과 하나의 링크로 안내합니다. 링크 소지자는 학생 목록과 슬라이드 연결 정보를 볼 수 있으며, 이름 선택은 본인인증이 아닙니다. 가명을 사용할 수 있습니다.</small></span></label><label><input type="radio" name="entryMode" value="individual" defaultChecked={initialPlan?.entryMode === 'individual'} /><span>학생별 링크 직접 전달<small>주소를 개별 전달하는 방식입니다. 이 선택만으로 슬라이드가 비공개가 되지는 않습니다.</small></span></label></div>
            <label className={real.share}><input name="share" type="checkbox" defaultChecked={initialPlan?.shareSlides ?? true} /><span>학생 슬라이드를 링크로 편집할 수 있도록 공유<small>슬라이드 링크를 가진 사람이 편집할 수 있습니다. 명단·교사 메모 시트는 이 설정으로 공유하지 않습니다. 선택을 해제하면 Google에서 해당 학생 계정에 편집 권한을 직접 부여해야 합니다.</small></span></label>
          </>}
        </fieldset>
        {error && <p className={real.warning} role="alert">{error}{locked && <span>입력 내용을 유지했습니다. 다시 시도하면 이미 생성한 파일부터 이어서 진행합니다.</span>}</p>}
      </div>
      <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={close} disabled={busy}>닫기</button><button className={styles.primaryButton} disabled={busy}>{busy ? '만드는 중…' : locked ? '이어서 다시 시도' : isClass ? '학급 만들기' : '과제 만들고 배부하기'}</button></div>
    </form>
  </dialog>{showProgress && <CreationProgressDialog kind={kind} name={progress.name} className={className} busy={busy} progress={progress} result={result} error={error} onRetry={() => submit()} onBack={() => setShowProgress(false)} onClose={close} onCreated={onCreated} />}</>;
}
