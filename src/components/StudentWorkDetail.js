'use client';

import { useId, useState } from 'react';
import { studentLabel } from '@/lib/workRecords.mjs';
import { formatAmount, formatCheckedAt } from '@/lib/storedWorkRecords.mjs';
import CurrentSlideContents from './CurrentSlideContents';
import StudentActivityGraph from './StudentActivityGraph';
import styles from './SlideDashboardPreview.module.css';

const time = (date) => date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '시각 미기록';
const day = (date) => new Date(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
const signed = (value) => `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}`;

function RecordLine({ record, readOnly = false }) {
  if (record.source === 'legacy_unverified') return <li><time>{formatCheckedAt(record.checkedAt)}</time><div><span>글자 변화량 미확인 · 슬라이드 {formatAmount(record.slideCount)}장 · 이미지 {formatAmount(record.imageCount)}개</span><small>이 시점의 글자 증가·감소량은 확인되지 않았어요.</small></div></li>;
  if (record.source === 'first_snapshot') return <li><time>{formatCheckedAt(record.checkedAt)}</time><div><span>슬라이드 상태 확인 · 전체 글자 {formatAmount(record.charCount)}자</span><small>작업 증가량으로 계산하지 않는 확인 기록입니다.</small></div></li>;
  if (record.charDelta == null) return <li><time>{formatCheckedAt(record.checkedAt)}</time><div><span>글자 변화량 미기록{record.imageDelta != null ? ` · 이미지 ${signed(record.imageDelta)}개` : ''}{record.slideDelta != null ? ` · 슬라이드 ${signed(record.slideDelta)}장` : ''}</span><small>저장된 두 확인 시점 사이의 기록</small></div></li>;
  const long = record.source === 'gap_comparison';
  return <li><time>{readOnly ? `${formatCheckedAt(record.previousCheckedAt)} → ${formatCheckedAt(record.checkedAt)}` : long ? `${day(record.previousCheckedAt)} → ${day(record.checkedAt)}` : time(record.checkedAt)}</time><div><span>글자 수 {signed(record.charDelta)}자{record.imageDelta ? ` · 이미지 ${signed(record.imageDelta)}개` : ''}{record.slideDelta ? ` · 슬라이드 ${signed(record.slideDelta)}장` : ''}</span><small>{long ? '지난 확인 이후의 차이 · 실제 작성 시점 미확인' : `연속 확인 · ${Math.round((Date.parse(record.checkedAt) - Date.parse(record.previousCheckedAt)) / 1000)}초 간격`}</small></div></li>;
}

function RecentRecordList({ records, readOnly }) {
  const [limit, setLimit] = useState(3);
  const listId = useId();
  const changes = records.filter((record) => record.charDelta !== 0 || record.imageDelta || record.slideDelta).slice().reverse();
  const visible = changes.slice(0, limit);
  const remaining = changes.length - visible.length;
  return <>
    <ol id={listId} className={styles.activityList}>{visible.map((record) => <RecordLine readOnly={readOnly} key={record.id} record={record} />)}{visible.length === 0 && <li>{readOnly ? '저장된 비교 기록이 없습니다.' : '이번 확인에서 새 변화가 없어요.'}</li>}</ol>
    {changes.length > 3 && <div className={styles.recordListControls}>
      <span className={styles.smallNote} role="status">전체 {changes.length}개 중 {visible.length}개 표시</span>
      <div>{remaining > 0 && <button type="button" className={styles.secondaryButton} aria-controls={listId} onClick={() => setLimit((count) => count + 10)}>이전 기록 더보기 ({remaining}개)</button>}{limit > 3 && <button type="button" className={styles.textAction} aria-controls={listId} onClick={() => setLimit(3)}>최근 3개만 보기</button>}</div>
    </div>}
  </>;
}

function SaveForm({ label, name, defaultValue = '', placeholder, onSave, reset = false, onDone, maxLength = 2000, rows = 3, buttonLabel }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (saving) return;
    const form = event.currentTarget, value = String(new FormData(form).get(name)).trim();
    if (reset && !value) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const success = await onSave(value);
      if (success === false) { setError('저장을 완료하지 못했습니다. 입력 내용은 유지합니다.'); return; }
      if (reset) form.reset(); setSaved(true); onDone?.();
    } catch (err) { setError(err.message || '저장을 완료하지 못했습니다.'); }
    finally { setSaving(false); }
  }}>
    <label className={styles.field}>{label}<textarea name={name} rows={rows} maxLength={maxLength} required={reset} defaultValue={defaultValue} placeholder={placeholder} disabled={saving} /></label>
    <button className={styles.secondaryButton} disabled={saving}>{saving ? '저장 중…' : buttonLabel}</button>
    {error && <p className={styles.slideError} role="alert">{error}</p>}{saved && <p className={styles.smallNote} role="status">저장했습니다.</p>}
  </form>;
}

export default function StudentWorkDetail({ student, averages, mode, threads, unread, onRead, onFeedback, onReply, memo, onMemo, surge, reviewed, onReview, readOnly = false, canWrite = false, canSaveMemo = false, workspaceError, commentsError, onRefreshComments, onConfirmAuthor, presentationState, onRefreshPresentation, templateBaseline }) {
  const [replying, setReplying] = useState(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(null);
  const writable = !readOnly || canWrite;
  const records = readOnly ? student.records : mode === 'lesson' ? student.lessonRecords : student.projectRecords;
  const hasLegacy = readOnly && records.some((record) => record.source === 'legacy_unverified');
  const latest = records.at(-1);
  const surgeSeconds = readOnly ? Math.round((Date.parse(latest?.checkedAt) - Date.parse(latest?.previousCheckedAt)) / 1000) : 25;
  const authorControl = (message) => readOnly && canWrite && message.role !== 'teacher' && message.origin !== 'stored_feedback' && <button className={styles.textAction} disabled={roleBusy !== null} onClick={async () => {
    setRoleBusy(message.id); try { await onConfirmAuthor(message, message.role === 'student' ? 'other' : 'student'); } finally { setRoleBusy(null); }
  }}>{message.role === 'student' ? '학생 작성자 확인 취소' : '학생 작성자로 확인'}</button>;
  return <div className={styles.drawerBody}>
    <section aria-label="전체 작업 요약"><h3 className={styles.detailTitle}>전체 작업 요약</h3><div className={styles.detailMetrics}>
      {[[readOnly ? '전체 글자' : '추가 글자', readOnly ? student.currentCounts?.charCount ?? null : student.chars, readOnly ? averages.wholeChars : averages.chars, '자'], ['슬라이드', student.slides, averages.slides, '장'], ['추가 이미지', student.images, averages.images, '개']].map(([label, value, average, unit]) => <div key={label}><span>{label}</span><strong>{formatAmount(value)}<small>{unit}</small></strong><p>학급 평균 {formatAmount(average == null ? null : Number(average.toFixed(1)))}{unit}</p></div>)}
    </div><p className={styles.smallNote}>{readOnly ? `전체 글자는 템플릿을 포함한 분량입니다. 확인 시각: ${formatCheckedAt(student.currentCounts?.checkedAt || student.checkedAt)} · 미기록 값은 —로 표시` : '같은 과제의 전체 학생 기준 · 기본 글자·이미지 제외 · 슬라이드는 전체 장수'}</p></section>

    {student.amountVerified === false && <p className={styles.smallNote}>템플릿 분량이 확인되지 않아 추가량은 저장된 수치를 표시합니다.</p>}

    <section className={styles.detailSection}><div className={styles.panelHeading}><h3>{hasLegacy && !records.some((record) => Number.isFinite(record.charDelta)) ? '최근 저장 기록' : '최근 변화'}</h3>{surge && <span className={styles.surgeFlag}>{reviewed ? '확인 완료' : '텍스트 급증 · 확인 필요'}</span>}</div>
      {surge && <div className={styles.surgeNotice}><p>{surgeSeconds}초 동안 글자 수가 {formatAmount(readOnly ? latest.charDelta : 286)}자 늘었습니다. 작성 맥락을 학생과 확인해 주세요.</p><small>붙여넣기를 확정하는 표시가 아니에요.</small>{writable && <button className={styles.textAction} onClick={onReview}>{reviewed ? '다시 확인 필요로 표시' : '확인 완료로 표시'}</button>}</div>}
      <RecentRecordList key={mode} records={records} readOnly={readOnly} />
    </section>

    <section className={styles.detailSection}><h3>작업 흐름</h3><StudentActivityGraph records={records} templateBaseline={templateBaseline} student={student} /></section>

    <section className={styles.detailSection} id={`feedback-${student.id || student.number}`}><div className={styles.panelHeading}><h3>교사 피드백과 학생 답장</h3>{unread > 0 && writable && <button className={styles.textAction} onClick={onRead}>새 답장 {unread}개 확인 완료</button>}</div><p className={styles.smallNote}>{readOnly ? '슬라이드에서 주고받은 댓글도 함께 보여요. 내 계정의 글은 교사 피드백으로 표시합니다.' : '슬라이드에서 남긴 댓글도 같은 대화로 표시하는 예시입니다.'}</p>
      {readOnly && onRefreshComments && <button className={styles.textAction} disabled={commentBusy} onClick={async () => { setCommentBusy(true); try { await onRefreshComments(); } catch { /* Preserve existing conversations and display the reconnect guidance below. */ } finally { setCommentBusy(false); } }}>{commentBusy ? '댓글 확인 중…' : '댓글 다시 확인'}</button>}
      {commentsError && <p className={styles.smallNote} role="status">{/로그인|만료|인증/.test(commentsError) ? 'Google에 다시 로그인하면 새 댓글을 확인할 수 있어요.' : '새 댓글은 학생 슬라이드에서 확인하거나, 댓글 다시 확인을 눌러주세요.'}</p>}
      <div className={styles.conversationList}>{threads.map((thread) => <article key={thread.id} className={styles.conversation}><div className={styles.messageHeader}><strong>{thread.role === 'teacher' ? '선생님' : thread.role === 'student' ? `${studentLabel(student)} 작성` : thread.authorName ? `${thread.authorName} · 작성자 미분류` : '작성자 확인 불가'}</strong><span>{thread.origin === 'google_slides' ? '슬라이드 댓글' : thread.origin === 'stored_feedback' ? '저장된 피드백 · 작성자/시각 미확인' : '앱에서 작성'} · {readOnly ? formatCheckedAt(thread.createdAt) : time(thread.createdAt)}</span></div><p>{thread.content}</p>{authorControl(thread)}{thread.replies.map((reply) => <div key={reply.id} className={`${styles.replyMessage} ${reply.role === 'student' ? styles.studentReply : ''}`}><div className={styles.messageHeader}><strong>{reply.role === 'teacher' ? '선생님 답글' : reply.role === 'student' ? `${studentLabel(student)} 답장` : reply.authorName ? `${reply.authorName} · 작성자 미분류` : '작성자 확인 불가'}</strong><span>{readOnly ? formatCheckedAt(reply.createdAt) : time(reply.createdAt)}</span></div><p>{reply.content}</p>{authorControl(reply)}</div>)}
        {writable && (!readOnly || thread.origin === 'google_slides') && (replying === thread.id ? <SaveForm label="추가 답글" name="reply" rows={2} reset onSave={(content) => onReply(thread.id, content)} onDone={() => setReplying(null)} buttonLabel="답글 남기기" /> : <button className={styles.textAction} onClick={() => setReplying(thread.id)}>교사 답글 남기기</button>)}
      </article>)}{threads.length === 0 && <p className={styles.feedbackEmpty}>{commentsError ? '현재 표시할 교사 피드백과 학생 답장이 없어요.' : '아직 교사 피드백과 학생 답장이 없어요.'}</p>}{threads.length > 0 && !threads.some((thread) => thread.replies.some((reply) => reply.role === 'student')) && <p className={styles.replyEmpty}>표시할 학생 답장이 아직 없어요.</p>}</div>
      {workspaceError && workspaceError !== commentsError && <p className={styles.slideError} role="alert">{workspaceError}</p>}
      {writable ? <SaveForm label="학생에게 전할 피드백" name="feedback" reset onSave={onFeedback} placeholder="잘한 점이나 다음에 살펴볼 내용을 전해주세요." buttonLabel="피드백 남기기" /> : <p className={styles.smallNote}>피드백을 작성하려면 Google 저장 권한을 연결해 주세요.</p>}
    </section>
    <section className={styles.detailSection}><h3>교사 메모 <small className={styles.privateMemoLabel}>교사만 보기</small></h3><p className={styles.smallNote}>메모 저장을 누르면 교사 전용 Google 시트에 저장합니다. 학생에게 공유되지 않으며 슬라이드에는 기록하지 않습니다.</p>{(!readOnly || canSaveMemo) ? <SaveForm key={student.id || student.number} label="교사 메모 내용" name="memo" defaultValue={memo} rows={3} maxLength={3000} onSave={onMemo} placeholder="슬라이드를 보며 기억할 내용이나 관찰한 모습을 적어주세요." buttonLabel="메모 저장" /> : <><p className={styles.storedMemo}>{memo || '저장된 교사 메모가 없습니다.'}</p><p className={styles.smallNote}>{student.slideId ? '현재 화면에서는 저장된 메모를 확인할 수 있습니다.' : '학생 슬라이드를 연결하면 메모를 저장할 수 있습니다.'}</p></>}</section>
    {readOnly && <details className={styles.optionalContents}><summary>슬라이드에 쓴 글 보기</summary><p className={styles.smallNote}>각 장에 쓴 글만 모아 읽는 기능이에요. 이미지와 배치는 위의 ‘슬라이드 열기’에서 확인할 수 있어요.</p><CurrentSlideContents student={student} state={presentationState} onRefresh={onRefreshPresentation} /></details>}
  </div>;
}
