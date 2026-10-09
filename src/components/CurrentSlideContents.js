'use client';

import { formatAmount, formatCheckedAt } from '@/lib/storedWorkRecords.mjs';
import styles from './SlideDashboardPreview.module.css';

export default function CurrentSlideContents({ student, state, onRefresh }) {
  const data = state?.data;
  return <section className={styles.slideTextSection} aria-label="슬라이드에 쓴 글">
    <div className={styles.panelHeading}><h3>각 장에 쓴 글</h3>{student.slideId && <button className={styles.secondaryButton} disabled={state?.loading} onClick={onRefresh}>{state?.loading ? '글 불러오는 중…' : data ? '최신 글 다시 불러오기' : '슬라이드 글 불러오기'}</button>}</div>
    {state?.loading && <p className={styles.smallNote} role="status">현재 슬라이드를 읽는 중입니다.{data ? ' 아래는 이전에 확인한 내용입니다.' : ''}</p>}
    {state?.error && <p className={styles.slideError} role="alert">{state.error}{data ? ' 아래는 이전에 확인한 내용입니다.' : ''}</p>}
    {!student.slideId && <p className={styles.smallNote}>저장된 슬라이드 주소가 없어 내용을 읽을 수 없습니다.</p>}
    {student.slideId && !state && <p className={styles.smallNote}>‘슬라이드 글 불러오기’를 누르면 현재 작성된 글을 가져옵니다.</p>}
    {data && <>
      <p className={styles.slideReadTime}>{formatCheckedAt(data.checkedAt)} 확인 · {data.title}</p>
      <div className={styles.currentSlideMetrics}><span>현재 전체 글자 <strong>{formatAmount(data.charCount)}자</strong></span><span>슬라이드 <strong>{formatAmount(data.slideCount)}장</strong></span><span>현재 전체 이미지 <strong>{formatAmount(data.imageCount)}개</strong></span></div>
      <p className={styles.smallNote}>기본 템플릿을 포함한 전체 수치입니다. 글자는 본문·발표자 노트의 공백을 제외하고, 이미지는 삽입된 이미지 개체만 셉니다. 최근에 편집한 장을 뜻하지 않습니다.</p>
      <div className={styles.slideContentsList}>{data.pages.map((page) => <details className={styles.slideContentsPage} key={page.id || page.number}>
        <summary><strong>{page.number}장</strong><span>{page.text.replace(/\s+/g, ' ').slice(0, 70) || (page.images ? '이미지가 있는 슬라이드' : page.notes ? '발표자 노트가 있는 슬라이드' : '텍스트·이미지 개체 없음')}</span><small>{page.chars}자 · 이미지 {page.images}개</small></summary>
        <div className={styles.slideContentsBody}><p>{page.text || '이 장에는 읽을 수 있는 본문 텍스트가 없습니다.'}</p>{page.notes && <div className={styles.slideNotes}><h4>발표자 노트</h4><p>{page.notes}</p></div>}
          <a className={styles.textAction} href={`${student.slideUrl}${page.id ? `#slide=id.${encodeURIComponent(page.id)}` : ''}`} target="_blank" rel="noopener noreferrer">원본에서 {page.number}장 열기 ↗</a>
        </div>
      </details>)}</div>
      {data.pages.length === 0 && <p className={styles.smallNote}>원본에 슬라이드가 없습니다.</p>}
    </>}
  </section>;
}
