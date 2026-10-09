'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { classroomName, classroomKeywords } from '@/lib/googleClassroom.mjs';
import KeywordInput from './KeywordInput';
import { parseRosterInput } from '@/lib/workRecords.mjs';
import { parsePresentationId } from '@/lib/slideContents.mjs';
import styles from './ClassWorkspacePreview.module.css';
import real from './ClassroomCreation.module.css';

export default function ClassroomCreation({ kind, className, roster = [], existingNames = [], initialPlan, onCreate, onCreated, onClose }) {
  const dialog = useRef(null), job = useRef(null), prepared = useRef(initialPlan || null), inFlight = useRef(false);
  const titleId = useId();
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const [locked, setLocked] = useState(Boolean(initialPlan)), [result, setResult] = useState(null);
  const [keywordList, setKeywordList] = useState(() => classroomKeywords(initialPlan?.keywords ?? initialPlan?.keywordsText ?? '')), [keywordDraft, setKeywordDraft] = useState('');
  const members = initialPlan?.roster || roster;
  const [selected, setSelected] = useState(() => members.filter((student) => Number.isSafeInteger(student.number)).map((student) => student.number));
  const isClass = kind === 'class';
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  async function submit(event) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setError('');
    try {
      if (!prepared.current) {
        if (!isClass && keywordDraft.trim()) throw new Error('입력한 키워드는 추가를 눌러 목록에 넣어 주세요.');
        const form = new FormData(event.currentTarget);
        const name = classroomName(form.get('name'));
        if (isClass && (name === 'Sheet1' || name.startsWith('_'))) throw new Error('학급 이름에는 Sheet1이나 _로 시작하는 이름을 사용할 수 없습니다.');
        if (existingNames.includes(name)) throw new Error('같은 이름이 이미 있습니다. 구분할 수 있는 이름을 입력해 주세요.');
        const payload = isClass ? { name, rosterText: String(form.get('roster')) } : { name, className, templateUrl: String(form.get('template')), keywords: keywordList, shareSlides: form.get('share') === 'on', entryMode: String(form.get('entryMode') || 'shared'), roster: members.filter((student) => selected.includes(student.number)) };
        parseRosterInput(isClass ? payload.rosterText : payload.roster.map((student) => `${student.number} ${student.name}`).join('\n'));
        if (!isClass && !parsePresentationId(payload.templateUrl)) throw new Error('Google 슬라이드 템플릿 주소를 확인해 주세요.');
        prepared.current = payload;
      }
      job.current ||= prepared.current.jobId || crypto.randomUUID();
      setBusy(true); setLocked(true); setProgress('Google 연결 확인 중…');
      const created = await onCreate({ ...prepared.current, jobId: job.current, onProgress: setProgress });
      if (created.warnings?.length) { setResult(created); setProgress('슬라이드는 만들었지만 일부 학생의 편집 공유가 완료되지 않았습니다.'); }
      else onCreated(created);
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const close = () => { if (!busy) onClose(); };
  return <dialog ref={dialog} className={`${styles.dialog} ${real.dialog}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>{isClass ? '새 학급 만들기' : initialPlan ? '과제 배부 이어하기' : '새 과제 만들기'}</h2><button className={styles.iconButton} onClick={close} disabled={busy} aria-label="닫기">×</button></div>
    <form onSubmit={submit}>
      <div className={`${styles.dialogBody} ${real.body}`}>
        {!isClass && <div className={real.context}>{className}<span>Google Slides</span></div>}
        <fieldset disabled={busy || locked} className={real.fields}>
          <label className={styles.field}>{isClass ? '학급 이름' : '과제 이름'}<input name="name" defaultValue={initialPlan?.name || ''} required maxLength={80} placeholder={isClass ? '예: 4학년 4반' : '예: 달의 모양 관찰하기'} autoComplete="off" /></label>
          {isClass ? <label className={styles.field}>학생 명단<textarea name="roster" required rows={8} placeholder={'1 김누리\n4 송명신\n5 달빛'} /><small>한 줄에 출석번호와 이름 또는 가명을 입력하세요. 빠진 번호는 그대로 두면 됩니다. 최대 50명.</small></label> : <>
            <label className={styles.field}>예시 슬라이드 주소<input name="template" defaultValue={initialPlan?.templateUrl ? `https://docs.google.com/presentation/d/${parsePresentationId(initialPlan.templateUrl)}/edit` : ''} type="url" required placeholder="https://docs.google.com/presentation/d/…/edit" /><small>첫 장을 과제 카드 표지로 사용하고, 학생마다 사본을 만듭니다. 기본 글자와 이미지는 추가 작업량에서 제외합니다.</small></label>
            <div className={styles.field}><span>핵심 키워드 <span className={styles.optional}>선택</span></span><KeywordInput words={keywordList} onChange={setKeywordList} draft={keywordDraft} onDraftChange={setKeywordDraft} disabled={busy || locked} /><small>단어를 하나씩 추가하세요. 나중에도 추가·수정할 수 있습니다.</small></div>
            <details className={styles.recipientPicker}><summary>배부할 학생 <strong>{selected.length}명</strong></summary><div className={styles.recipientActions}><button type="button" className={styles.textButton} onClick={() => setSelected(members.filter((student) => Number.isSafeInteger(student.number)).map((student) => student.number))}>전체 선택</button><button type="button" className={styles.textButton} onClick={() => setSelected([])}>선택 해제</button></div><div className={styles.checkGrid}>{members.map((student) => <label key={student.id || student.number}><input type="checkbox" disabled={!Number.isSafeInteger(student.number)} checked={selected.includes(student.number)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, student.number] : previous.filter((number) => number !== student.number))} />{student.number === null ? '번호 없음' : `${student.number}번`} {student.name}</label>)}</div></details>
            {members.some((student) => !Number.isSafeInteger(student.number)) && <p className={real.warning}>출석번호가 없는 학생은 배부할 수 없습니다. 번호를 포함한 학급 명단을 등록해 주세요.</p>}
            <div className={real.entryMode}><strong>학생 접속 방식</strong><label><input type="radio" name="entryMode" value="shared" defaultChecked={(initialPlan?.entryMode || 'shared') === 'shared'} /><span>공통 학생 링크에서 이름 선택<small>기본 · QR코드와 하나의 링크를 학급에 안내합니다.</small></span></label><label><input type="radio" name="entryMode" value="individual" defaultChecked={initialPlan?.entryMode === 'individual'} /><span>학생별 링크 직접 전달</span></label></div>
            <label className={real.share}><input name="share" type="checkbox" defaultChecked={initialPlan?.shareSlides ?? true} /><span>학생 슬라이드를 링크로 편집할 수 있도록 공유<small>각 학생에게 자신의 슬라이드 링크를 전달하세요. 명단·교사 메모 시트는 공유하지 않습니다.</small></span></label>
          </>}
        </fieldset>
        {busy && <p className={real.progress} role="status">{progress}</p>}
        {error && <p className={real.warning} role="alert">{error}{locked && <span>입력 내용을 유지했습니다. 다시 시도하면 이미 생성한 파일부터 이어서 진행합니다.</span>}</p>}
        {result && <div className={real.warning} role="status"><p>{progress}</p><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      </div>
      <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={close} disabled={busy}>닫기</button>{result && <button type="button" className={styles.secondaryButton} onClick={() => onCreated(result)}>과제 열기</button>}<button className={styles.primaryButton} disabled={busy}>{busy ? '만드는 중…' : locked ? '이어서 다시 시도' : isClass ? '학급 만들기' : '과제 만들고 배부하기'}</button></div>
    </form>
  </dialog>;
}
