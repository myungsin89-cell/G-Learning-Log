'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BrandMark from './BrandMark';
import MadeByStamp from './MadeByStamp';
import KeywordInput from './KeywordInput';
import { previewAssignments, createPreviewStudents } from '@/lib/slidePreviewData';
import { parseRosterInput, studentLabel } from '@/lib/workRecords.mjs';
import styles from './ClassWorkspacePreview.module.css';

function Icon({ name, size = 18 }) {
  const paths = {
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    back: <path d="m14 6-6 6 6 6" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function PreviewDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialogHeader}>
        <h2 id={titleId}>{title}</h2>
        <button className={styles.iconButton} onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
      </div>
      {children}
    </dialog>
  );
}

export default function ClassWorkspacePreview({ className = '5학년 2반' }) {
  const [assignments, setAssignments] = useState(previewAssignments);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [roster, setRoster] = useState(() => createPreviewStudents(24, []).map(({ number, name }) => ({ number, name })));
  const [selectedNumbers, setSelectedNumbers] = useState(roster.map((student) => student.number));
  const [rosterError, setRosterError] = useState('');
  const [keywords, setKeywords] = useState([]), [keywordDraft, setKeywordDraft] = useState(''), [keywordError, setKeywordError] = useState('');
  const activeCount = assignments.filter((assignment) => !assignment.closed).length;
  const visibleAssignments = assignments.filter((assignment) => (
    (filter === 'all' || (filter === 'active' ? !assignment.closed : assignment.closed)) && assignment.name.includes(search.trim())
  ));

  function createAssignment(event) {
    event.preventDefault();
    if (keywordDraft.trim()) { setKeywordError('입력한 키워드는 추가를 눌러 목록에 넣어 주세요.'); return; }
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim();
    if (!name || selectedNumbers.length === 0) return;
    setAssignments((previous) => [{
      id: `preview-${previous.length}`, name, subject: '슬라이드 과제', date: '방금', closed: false,
      students: selectedNumbers.length, keywords,
      roster: roster.filter((student) => selectedNumbers.includes(student.number)),
      theme: 'earth', subtitle: '새로운 배움의 기록을 시작해요',
    }, ...previous]);
    setFilter('all');
    setSearch('');
    setModal(null);
    setNotice('시안에 새 과제가 추가되었습니다. Google Drive에는 저장되지 않습니다.');
  }

  function openCreate() {
    setSelectedNumbers(roster.map((student) => student.number));
    setKeywords([]); setKeywordDraft(''); setKeywordError('');
    setModal({ type: 'create' });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/design-preview/classes" className={styles.brand}><BrandMark size={36} /><span>G배움로그</span></Link>
          <Link className={styles.backLink} href="/design-preview/classes"><Icon name="back" size={15} /> 학급 목록</Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.classHeading}>
          <div>
            <p className={styles.context}>우리 학급의 배움 기록</p>
            <h1>{className}</h1>
            <p className={styles.description}>과제를 열고, 학생의 작업 과정을 이어서 살펴보세요.</p>
          </div>
          <button className={styles.rosterButton} onClick={() => { setRosterError(''); setModal({ type: 'roster' }); }}><Icon name="people" /><span>학생 <strong>{roster.length}명</strong></span><span className={styles.rosterLabel}>명단 보기</span></button>
        </div>

        <section className={styles.assignments} aria-labelledby="assignment-title">
          <div className={styles.sectionHeading}>
            <div className={styles.sectionTitle}><h2 id="assignment-title">수업 과제</h2><span>{assignments.length}개</span></div>
            <button className={styles.primaryButton} onClick={openCreate}><Icon name="plus" /> 새 과제 만들기</button>
          </div>
          <div className={styles.toolbar}>
            <div className={styles.filters} aria-label="과제 상태 필터">
              {[['all', '전체', assignments.length], ['active', '진행 중', activeCount], ['closed', '종료', assignments.length - activeCount]].map(([value, label, count]) => (
                <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={filter === value ? styles.selectedFilter : ''}>{label}<span>{count}</span></button>
              ))}
            </div>
            <label className={styles.search}><Icon name="search" size={17} /><input aria-label="과제 검색" placeholder="과제 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>

          <div className={styles.grid}>
            {visibleAssignments.map((assignment) => (
              <article key={assignment.id} className={`${styles.card} ${!assignment.closed ? styles.activeCard : ''}`}>
                <div className={styles.cardTop}>
                  <span className={styles.tool}><Image src="/google-slides.svg" width={17} height={21} alt="" /> Google Slides</span>
                  <span className={assignment.closed ? styles.closedBadge : styles.activeBadge}>{!assignment.closed && <i />} {assignment.closed ? '모니터링 종료' : '진행 중'}</span>
                </div>
                <div className={`${styles.slidePreview} ${styles[assignment.theme]}`} aria-hidden="true">
                  <div className={styles.slidePaper}><span>{assignment.subject}</span><strong>{assignment.name}</strong><p>{assignment.subtitle}</p><div className={styles.slideRule} /></div>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardDate}>{assignment.date} 배부</p>
                  <h3>{assignment.name}</h3>
                  <p className={styles.cardMeta}>학생 {assignment.roster?.length || roster.length}명에게 배부</p>
                  <div className={styles.keywords}>{assignment.keywords.slice(0, 3).map((keyword) => <span key={keyword}>{keyword}</span>)}{assignment.keywords.length === 0 && <span>키워드 없음</span>}</div>
                </div>
                <Link className={styles.cardButton} href={`/design-preview/dashboard?className=${encodeURIComponent(className)}&assignment=${assignment.id.startsWith('preview-') ? `custom&title=${encodeURIComponent(assignment.name)}&keywords=${encodeURIComponent(assignment.keywords.join(','))}&students=${assignment.students}` : assignment.id}&roster=${encodeURIComponent(JSON.stringify(assignment.roster || roster))}`}><span>{assignment.closed ? '활동 기록 살펴보기' : '학생 작업 살펴보기'}</span><Icon name="arrow" size={17} /></Link>
              </article>
            ))}
          </div>
          {visibleAssignments.length === 0 && <div className={styles.empty}><h3>조건에 맞는 과제가 없어요</h3><p>다른 과제 이름을 검색하거나 상태를 바꿔보세요.</p><button className={styles.secondaryButton} onClick={() => { setSearch(''); setFilter('all'); }}>전체 과제 보기</button></div>}
        </section>

        <div className={styles.guide}>
          <div className={styles.guideMark}><Image src="/google-slides.svg" width={22} height={28} alt="" /></div>
          <div><h2>슬라이드 하나로, 우리 반의 수업을 시작하세요.</h2><p>템플릿 링크를 넣으면 학생별 사본을 배부하고 작업 과정을 함께 살펴볼 수 있어요.</p></div>
          <button className={styles.textButton} onClick={openCreate}>과제 만들기 <Icon name="arrow" size={16} /></button>
        </div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <p className={styles.previewNote}>디자인 시안 · 학급과 과제는 예시이며, 입력한 내용은 새로고침하면 초기화됩니다.</p>
        <MadeByStamp />
      </main>

      {modal?.type === 'roster' && <PreviewDialog title={`${className} 학생 명단`} onClose={() => setModal(null)}><form onSubmit={(event) => { event.preventDefault(); try { const next = parseRosterInput(String(new FormData(event.currentTarget).get('roster'))); setRoster(next); setModal(null); setNotice('예시 명단을 변경했습니다. 출석번호는 빈 번호가 있어도 유지됩니다.'); } catch (error) { setRosterError(error.message); } }}><div className={styles.dialogBody}><p className={styles.dialogDescription}>출석번호와 이름 또는 가명을 한 줄에 한 명씩 입력해 주세요. 빈 출석번호는 자동으로 다시 매기지 않습니다.</p><label className={styles.field}>학생 명단<textarea name="roster" rows={10} defaultValue={roster.map((student) => `${student.number} ${student.name}`).join('\n')} required /></label>{rosterError && <p role="alert">{rosterError}</p>}</div><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setModal(null)}>닫기</button><button className={styles.primaryButton}>명단 저장</button></div></form></PreviewDialog>}

      {modal?.type === 'create' && <PreviewDialog title="새 과제 만들기" onClose={() => setModal(null)}>
        <form onSubmit={createAssignment}>
          <div className={styles.dialogBody}>
            <p className={styles.dialogDescription}>슬라이드 템플릿으로 학생들의 작업 공간을 준비해요.</p>
            <div className={styles.formTool}><Image src="/google-slides.svg" width={21} height={27} alt="" /><strong>Google Slides</strong><span>기본 지원</span></div>
            <label className={styles.field}>과제 이름<input name="name" placeholder="예: 기후 위기, 우리가 바꿀 수 있는 것" required maxLength={80} /></label>
            <label className={styles.field}>예시 슬라이드 주소<input name="template" type="url" placeholder="https://docs.google.com/presentation/d/..." required /><small>첫 장을 과제 카드 표지로 사용하고, 학생마다 사본을 만듭니다.</small></label>
            <div className={styles.field}><span>핵심 키워드 <span className={styles.optional}>선택</span></span><KeywordInput words={keywords} onChange={setKeywords} draft={keywordDraft} onDraftChange={(value) => { setKeywordDraft(value); setKeywordError(''); }} /><small>단어를 하나씩 추가하세요.</small>{keywordError && <p className={styles.formNote} role="alert">{keywordError}</p>}</div>
            <details className={styles.recipientPicker}><summary>배부 대상 <strong>{selectedNumbers.length} / {roster.length}명</strong></summary><div className={styles.recipientActions}><button type="button" className={styles.textButton} onClick={() => setSelectedNumbers(roster.map((student) => student.number))}>전체 선택</button><button type="button" className={styles.textButton} onClick={() => setSelectedNumbers([])}>선택 해제</button></div><div className={styles.checkGrid}>{roster.map((student) => <label key={student.number}><input type="checkbox" checked={selectedNumbers.includes(student.number)} onChange={(event) => setSelectedNumbers((previous) => event.target.checked ? [...previous, student.number] : previous.filter((number) => number !== student.number))} />{studentLabel(student)}</label>)}</div></details>
            <p className={styles.formNote}>시안에서는 목록만 추가됩니다. 실제 파일은 생성하지 않습니다.</p>
          </div>
          <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setModal(null)}>취소</button><button type="submit" className={styles.primaryButton} disabled={selectedNumbers.length === 0}>과제 만들기</button></div>
        </form>
      </PreviewDialog>}

    </div>
  );
}
