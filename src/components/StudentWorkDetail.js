'use client';

import { useId, useState } from 'react';
import { pendingCommentMessages } from '@/lib/workRecords.mjs';
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

export default function StudentWorkDetail({ student, keywords = [], matchedKeywords = [], keywordChecked = false, averages, mode, threads, unread, onFeedback, onReply, memo, onMemo, surge, reviewed, onReview, onReviewComment, readOnly = false, canWrite = false, canSaveMemo = false, slidesTrashed = false, workspaceError, commentsError, commentsLoaded = false, onRefreshComments, presentationState, onRefreshPresentation, templateBaseline, collection }) {
  const [replying, setReplying] = useState(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(null);
  const writable = !readOnly || canWrite;
  const pendingMessages = new Set(pendingCommentMessages(threads));
  const records = readOnly ? student.records : mode === 'lesson' ? student.lessonRecords : student.projectRecords;
  const hasLegacy = readOnly && records.some((record) => record.source === 'legacy_unverified');
  const latest = records.at(-1);
  const keywordCheckedAt = student.currentCounts?.checkedAt || student.checkedAt;
  const keywordSource = keywordCheckedAt ? `${formatCheckedAt(keywordCheckedAt)}에 확인한` : '저장된';
  const surgeSeconds = readOnly ? Math.round((Date.parse(latest?.checkedAt) - Date.parse(latest?.previousCheckedAt)) / 1000) : 25;
  const messageLabel = (message, reply = false) => message.role === 'teacher' ? reply ? '선생님 답글' : '선생님' : message.role === 'student' ? reply ? '학생 답글' : '학생 댓글' : message.authorName || '작성자 미확인';
  const canReplyTo = (thread) => writable && !collection?.paused && (!collection || collection.ready) && (!readOnly || thread.origin === 'google_slides');
  const replyEditor = (thread) => <SaveForm label="교사 답글" name="reply" rows={2} reset onSave={(content) => onReply(thread.id, content)} onDone={() => setReplying(null)} buttonLabel="답글 남기기" />;
  const canReviewComment = (thread, message) => readOnly && canWrite && onReviewComment && thread.origin === 'google_slides' && message.role !== 'teacher';
  const setCommentReviewed = async (message, value) => {
    setReviewBusy(message.id);
    try { if (await onReviewComment(message, value) !== false && value) setReplying(null); } finally { setReviewBusy(null); }
  };
  const pendingAction = (thread, message, lastPending) => {
    const isPending = pendingMessages.has(message);
    const isReviewed = message.reviewed === true && message.role !== 'teacher';
    if (!isPending && !isReviewed) return null;
    return <>
      <div className={styles.pendingActionRow}>
        {isReviewed && <span className={styles.reviewedReplyFlag}>확인 완료</span>}
        {isPending && canReplyTo(thread) && lastPending === message && replying !== thread.id && <button className={styles.replyAction} onClick={() => setReplying(thread.id)}>답글 남기기</button>}
        {canReviewComment(thread, message) && <button className={styles.reviewAction} disabled={reviewBusy !== null} onClick={() => setCommentReviewed(message, !isReviewed)}>{reviewBusy === message.id ? '저장 중…' : isReviewed ? '되돌리기' : '답글 없이 확인 완료'}</button>}
      </div>
      {isPending && canReplyTo(thread) && lastPending === message && replying === thread.id && replyEditor(thread)}
    </>;
  };
  return <div className={styles.drawerBody}>
    {collection && !collection.ready && <p className={styles.smallNote} role="status">중지 상태를 확인하고 있습니다. 확인 전에는 새 작업·댓글을 조회하지 않습니다.</p>}
    <section className={styles.workSummary} aria-label="전체 작업 요약"><div className={styles.summaryHeading}><h3 className={styles.detailTitle}>전체 작업 요약</h3></div><div className={styles.detailMetrics}>
      {[[readOnly ? '전체 글자' : '추가 글자', readOnly ? student.currentCounts?.charCount ?? null : student.chars, readOnly ? averages.wholeChars : averages.chars, '자'], ['슬라이드', student.slides, averages.slides, '장'], ['추가 이미지', student.images, averages.images, '개']].map(([label, value, average, unit]) => <div key={label}><span>{label}</span><strong>{formatAmount(value)}<small>{unit}</small></strong><p>학급 평균 {formatAmount(average == null ? null : Number(average.toFixed(1)))}{unit}</p></div>)}
    </div><p className={styles.smallNote}>{readOnly ? `전체 글자는 템플릿을 포함한 분량입니다. 확인 시각: ${formatCheckedAt(student.currentCounts?.checkedAt || student.checkedAt)} · 미기록 값은 —로 표시` : '같은 과제의 전체 학생 기준 · 기본 글자·이미지 제외 · 슬라이드는 전체 장수'}</p></section>

    {student.amountVerified === false && <p className={styles.smallNote}>템플릿 분량이 확인되지 않아 추가량은 저장된 수치를 표시합니다.</p>}

    <section className={styles.detailSection} aria-label="핵심 키워드 달성 현황"><div className={styles.panelHeading}><h3>핵심 키워드 달성 현황</h3>{keywords.length > 0 && <strong className={styles.keywordProgress}>{keywordChecked ? `${matchedKeywords.length} / ${keywords.length}` : '확인 전'}</strong>}</div>
      {keywords.length > 0 ? <><ul className={styles.keywordProgressList}>{keywords.map((keyword) => {
        const found = keywordChecked && matchedKeywords.includes(keyword);
        return <li key={keyword} className={found ? styles.keywordFound : styles.keywordMissing}><span aria-hidden="true">{found ? '✓' : '○'}</span>{keyword}<small>{keywordChecked ? found ? '확인됨' : '미확인' : '확인 전'}</small></li>;
      })}</ul><p className={styles.smallNote}>{keywordChecked ? `${keywordSource} 슬라이드의 키워드 포함 기록이에요. 키워드를 수정했다면 다음 작업 확인 때 갱신됩니다.` : '아직 학생 슬라이드의 키워드를 확인하지 않았어요. 모니터링을 시작하거나 현재 작업 확인을 누르면 갱신됩니다.'}</p></> : <p className={styles.smallNote}>이 과제에 등록된 핵심 키워드가 없어요. 과제 카드의 수정 또는 핵심 키워드 추가·수정에서 등록할 수 있습니다.</p>}
    </section>

    <section className={styles.detailSection}><div className={styles.panelHeading}><h3>{hasLegacy && !records.some((record) => Number.isFinite(record.charDelta)) ? '최근 저장 기록' : '최근 변화'}</h3>{surge && <span className={styles.surgeFlag}>{reviewed ? '확인 완료' : '텍스트 급증 · 확인 필요'}</span>}</div>
      {surge && <div className={styles.surgeNotice}><p>{surgeSeconds}초 동안 글자 수가 {formatAmount(readOnly ? latest.charDelta : 286)}자 늘었습니다. 작성 맥락을 학생과 확인해 주세요.</p><small>붙여넣기를 확정하는 표시가 아니에요.</small>{writable && <button className={styles.textAction} onClick={onReview}>{reviewed ? '다시 확인 필요로 표시' : '확인 완료로 표시'}</button>}</div>}
      <RecentRecordList key={mode} records={records} readOnly={readOnly} />
    </section>

    <section className={styles.detailSection}><h3>작업 흐름</h3><StudentActivityGraph records={records} templateBaseline={templateBaseline} student={student} /></section>

    <section className={styles.detailSection} id={`feedback-${student.id || student.number}`}><div className={styles.panelHeading}><h3>슬라이드 댓글과 피드백</h3>{unread > 0 && <span className={styles.newCommentCount}>새 댓글 {unread}개</span>}</div><p className={styles.smallNote}>{readOnly ? '학생 슬라이드에 남긴 댓글과 교사 답글을 함께 보여요.' : '슬라이드에서 남긴 댓글도 같은 대화로 표시하는 예시입니다.'}</p>
      {commentsError && <p className={styles.slideError} role="alert">댓글을 불러오지 못했습니다. {commentsError}</p>}
      {readOnly && (!commentsLoaded || commentsError) && !slidesTrashed && onRefreshComments && <button className={styles.textAction} disabled={commentBusy} onClick={async () => { setCommentBusy(true); try { await onRefreshComments(); } catch { /* The request error appears above; keep earlier conversations visible. */ } finally { setCommentBusy(false); } }}>{commentBusy ? '댓글 확인 중…' : commentsError ? '댓글 다시 시도' : '댓글 확인'}</button>}
      <div className={styles.conversationList}>{threads.map((thread) => {
        const threadPending = pendingCommentMessages([thread]);
        const lastPending = threadPending.at(-1);
        return <article key={thread.id} className={styles.conversation}>
          {threadPending.length > 0 && <span className={styles.conversationCount} title={`답변 대기 ${threadPending.length}개`} aria-label={`답변 대기 ${threadPending.length}개`}>{threadPending.length > 99 ? '99+' : threadPending.length}</span>}
          <div className={styles.messageHeader}><strong>{messageLabel(thread)}</strong><span>{thread.origin === 'google_slides' ? '슬라이드 댓글' : thread.origin === 'stored_feedback' ? '저장된 피드백 · 작성자/시각 미확인' : '앱에서 작성'} · {readOnly ? formatCheckedAt(thread.createdAt) : time(thread.createdAt)}</span></div>
          <p>{thread.content}</p>{pendingAction(thread, thread, lastPending)}
          {thread.replies.map((reply) => <div key={reply.id} className={`${styles.replyMessage} ${reply.role === 'student' ? styles.studentReply : ''}`}>
            <div className={styles.messageHeader}><strong>{messageLabel(reply, true)}</strong><span>{readOnly ? formatCheckedAt(reply.createdAt) : time(reply.createdAt)}</span></div>
            <p>{reply.content}</p>{pendingAction(thread, reply, lastPending)}
          </div>)}
          {!lastPending && canReplyTo(thread) && (replying === thread.id ? replyEditor(thread) : <button className={styles.textAction} onClick={() => setReplying(thread.id)}>추가 답글 남기기</button>)}
        </article>;
      })}{threads.length === 0 && <p className={styles.feedbackEmpty}>{commentsError ? '현재 표시할 댓글이 없어요. 조회 오류를 확인해 주세요.' : readOnly && !commentsLoaded ? '슬라이드 댓글을 아직 확인하지 않았어요.' : '아직 슬라이드 댓글이나 피드백이 없어요.'}</p>}</div>
      {workspaceError && workspaceError !== commentsError && <p className={styles.slideError} role="alert">{workspaceError}</p>}
      {collection?.paused || (collection && !collection.ready) ? <p className={styles.smallNote}>{slidesTrashed ? '학생 슬라이드를 휴지통으로 옮겼습니다. 저장된 기록만 확인할 수 있어요.' : collection?.ended ? '모니터링은 종료됐습니다. 기존 댓글은 확인할 수 있고, 답글을 남기려면 모니터링을 재개해 주세요.' : '자동 기록은 중지됐습니다. 기존 댓글은 확인할 수 있고, 답글을 남기려면 기록을 재개해 주세요.'}</p> : writable ? <SaveForm label="학생에게 전할 피드백" name="feedback" reset onSave={onFeedback} placeholder="잘한 점이나 다음에 살펴볼 내용을 전해주세요." buttonLabel="피드백 남기기" /> : <p className={styles.smallNote}>피드백을 작성하려면 Google 연결을 확인해 주세요.</p>}
    </section>
    <section className={styles.detailSection}><h3>교사 메모 <small className={styles.privateMemoLabel}>교사만 보기</small></h3><p className={styles.smallNote}>메모 저장을 누르면 교사 전용 Google 시트에 저장합니다. 학생에게 공유되지 않으며 슬라이드에는 기록하지 않습니다.</p>{(!readOnly || canSaveMemo) ? <SaveForm key={student.id || student.number} label="교사 메모 내용" name="memo" defaultValue={memo} rows={3} maxLength={3000} onSave={onMemo} placeholder="슬라이드를 보며 기억할 내용이나 관찰한 모습을 적어주세요." buttonLabel="메모 저장" /> : <><p className={styles.storedMemo}>{memo || '저장된 교사 메모가 없습니다.'}</p><p className={styles.smallNote}>{student.slideId ? '현재 화면에서는 저장된 메모를 확인할 수 있습니다.' : '학생 슬라이드를 연결하면 메모를 저장할 수 있습니다.'}</p></>}</section>
    {readOnly && !slidesTrashed && <details className={styles.optionalContents}><summary>슬라이드에 쓴 글 보기</summary><p className={styles.smallNote}>각 장에 쓴 글만 모아 읽는 기능이에요. 이미지와 배치는 위의 ‘슬라이드 열기’에서 확인할 수 있어요.</p><CurrentSlideContents paused={collection?.paused || (collection && !collection.ready)} student={student} state={presentationState} onRefresh={onRefreshPresentation} /></details>}
  </div>;
}
