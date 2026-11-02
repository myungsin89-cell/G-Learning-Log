'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BrandMark from './BrandMark';
import styles from './GuideCarousel.module.css';

const cards = [
  { label: '시작', title: '첫 슬라이드 수업,\n이 순서대로 시작해요.', body: '학급을 만들고 과제를 배부한 뒤, 수업 중의 변화를 살펴보고 필요한 학생에게 피드백을 전합니다.', visual: 'cover' },
  { label: '01 · 연결', title: '선생님의 Google 계정으로 연결해요.', body: '학급 명단과 수업 기록은 선생님의 Google Drive에 저장됩니다. 출석번호가 있는 명단을 준비해 주세요. 예시 슬라이드는 없어도 됩니다.', points: ['Google 계정으로 계속하기를 누르세요.', '학생 접속 화면에는 별도 로그인이 없어요. Google 슬라이드는 학교 계정으로 열어요.'], shots: [{ src: 'home', caption: '메인 화면 · Google 계정으로 계속하기', alt: '메인 화면의 Google 계정으로 계속하기 버튼', x: 78, y: 57 }] },
  { label: '02 · 학급', title: '우리 반과 학생 명단을 등록해요.', body: '첫 학급 등록하기에서 학급 이름을 적고, 학생을 한 줄에 한 명씩 입력합니다. 번호와 이름 또는 가명을 함께 넣어 주세요.', points: ['학급 목록에서 첫 학급 등록하기를 누르세요.', '예: 1 김누리, 4 송명신'], shots: [{ src: 'first-class', caption: '① 학급 목록에서 시작', alt: '첫 학급 등록하기 버튼이 있는 학급 목록', x: 50, y: 64 }, { src: 'create-class', caption: '② 학급 이름과 명단 입력', alt: '학급 이름과 학생 명단을 입력하는 창', x: 51, y: 54 }] },
  { label: '03 · 과제', title: '예시 또는 빈 슬라이드로 배부해요.', body: '새 과제 만들기에서 제목을 입력하고 예시 슬라이드 사용 또는 빈 슬라이드로 시작을 고릅니다. 키워드는 선택 사항이며 나중에도 바꿀 수 있습니다.', points: ['새 과제 만들기를 누르세요.', '배부할 학생과 접속 방식을 확인한 뒤 생성하세요.'], shots: [{ src: 'classroom', caption: '① 학급 화면에서 새 과제 만들기', alt: '학급 과제 목록 오른쪽의 새 과제 만들기 버튼', x: 88, y: 36 }, { src: 'create-assignment', caption: '② 빈 슬라이드로 시작 선택', alt: '예시 슬라이드 사용과 빈 슬라이드로 시작 중 선택하는 창', x: 52, y: 37 }] },
  { label: '04 · 학생 접속', title: '학생에게 링크나 QR을 보내요.', body: '과제의 학생 접속 안내에서 기본 링크를 복사하거나 QR을 보여 주세요. 공통 링크를 받은 학생은 자기 이름을 선택해 슬라이드를 엽니다.', points: ['링크 복사 또는 QR 다운로드를 사용하세요.', '필요하면 학생별 링크·QR 방식도 선택할 수 있어요.'], shots: [{ src: 'student-share', caption: '① 교사 화면에서 링크·QR 안내', alt: '학생 접속 안내 창의 QR과 링크 복사 버튼', x: 36, y: 57 }, { src: 'student-view', caption: '② 학생 화면에서 이름 선택', alt: '학생이 자신의 이름을 선택하는 접속 화면', x: 50, y: 49 }] },
  { label: '05 · 수업 시작', title: '수업을 시작할 때 모니터링을 켜요.', body: '현재 기준으로 모니터링 시작을 누르면 그때의 슬라이드 상태를 첫 기준으로 저장합니다. 이후 확인된 변화부터 작업 기록과 그래프에 표시됩니다.', points: ['전날 만들어 둔 과제도 수업 시작 시 눌러 주세요.', '시작 전의 글자 수를 새 작업량으로 계산하지 않아요.'], visual: 'monitor' },
  { label: '06 · 먼저 보기', title: '먼저 살펴볼 학생을 찾아요.', body: '답변을 기다리는 댓글, 텍스트 급증, 변화가 없는 학생을 한 화면에서 확인합니다. 텍스트 급증은 확인할 신호이며 복사·붙여넣기의 확정 판정은 아닙니다.', points: ['왼쪽의 먼저 살펴볼 학생을 확인하세요.', '학생 카드를 누르면 자세한 기록을 볼 수 있어요.'], shots: [{ src: 'dashboard', caption: '작업 현황 · 먼저 살펴볼 학생', alt: '먼저 살펴볼 학생과 학생별 작업 카드가 있는 대시보드', x: 14, y: 57 }] },
  { label: '07 · 작업 기록', title: '변화의 흐름을 읽어 보세요.', body: '학생 카드를 열면 확인 시각별 작업 기록과 글자·이미지·슬라이드 변화를 볼 수 있습니다. 그래프는 슬.기록이 확인한 시점 사이의 변화입니다.', points: ['학생 카드를 눌러 오른쪽 작업 기록을 여세요.', '그래프와 확인 시각을 함께 살펴보세요.'], visual: 'record' },
  { label: '08 · 피드백', title: '댓글을 보고 필요한 답을 전해요.', body: '학생의 슬라이드 댓글을 확인하고 답글을 남길 수 있습니다. 답이 필요 없는 댓글은 답글 없이 확인 완료로 정리할 수 있어요.', points: ['답변 대기 표시가 있는 학생을 여세요.', '답글 남기기 또는 답글 없이 확인 완료를 선택하세요.'], visual: 'feedback' },
  { label: '완료', title: '이제 우리 반 수업을 열어 보세요.', body: '학급 → 과제 → 학생 접속 → 모니터링 → 기록 확인 → 피드백. 첫 수업에서는 이 순서만 기억하면 됩니다.', visual: 'finish' },
];

function Shot({ shot }) {
  const src = `/guide/${shot.src}.png`;
  return <figure className={styles.shot}>
    <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`${shot.caption} 화면 크게 보기 (새 탭)`}>
      <Image src={src} width={1440} height={900} alt={shot.alt} loading="eager" unoptimized />
      <span className={styles.marker} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} aria-hidden="true">
        <svg viewBox="0 0 28 34" fill="none" focusable="false">
          <path d="M3.5 2.5v23.8l6.6-5.9L15.6 31l4.5-2.3-5.4-10.2H24L3.5 2.5Z" fill="#f5c542" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M3.5 2.5v23.8l6.6-5.9L15.6 31l4.5-2.3-5.4-10.2H24L3.5 2.5Z" stroke="#285644" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </span>
    </a>
    <figcaption>{shot.caption}<span>크게 보기 ↗</span></figcaption>
  </figure>;
}

function CoverVisual({ finish = false }) {
  if (finish) return <div className={styles.finishVisual}><span>✓</span><strong>첫 수업 준비 완료</strong><p>필요할 때 언제든 이 가이드를 다시 볼 수 있어요.</p></div>;
  return <div className={styles.coverVisual}><div className={styles.coverMark}><BrandMark size={62} /><strong>슬.기록</strong></div><div className={styles.flow}>{['학급', '과제', '학생 접속', '모니터링', '피드백'].map((item, index) => <div key={item}><small>{String(index + 1).padStart(2, '0')}</small><strong>{item}</strong></div>)}</div><p>슬라이드의 기록을, 슬기롭게 읽다.</p></div>;
}

function MonitorVisual() {
  return <div className={styles.mockMonitor} aria-label="모니터링 시작 전 화면을 가명으로 재구성한 예시">
    <div className={styles.mockTop}><span>● 모니터링 전</span><b>현재 기준으로 모니터링 시작</b></div>
    <div className={styles.mockSummary}><span>전체 학생 <strong>24명</strong></span><span>변화 기록 <strong>0명</strong></span><span>변화량 미확인 <strong>24명</strong></span></div>
    <div className={styles.mockContent}><aside><strong>먼저 살펴볼 학생</strong><p>시작 후 표시돼요.</p></aside><div className={styles.mockCards}><i /><i /><i /><i /><div className={styles.mockOverlay}><span>▶</span><strong>아직 모니터링을 시작하지 않았어요</strong><p>수업을 시작할 때 현재 상태를 기준으로 저장해요.</p><b>현재 기준으로 모니터링 시작</b></div></div></div>
    <small className={styles.mockCaption}>실제 화면을 바탕으로 재구성한 가명 예시</small>
  </div>;
}

function DetailVisual({ feedback = false }) {
  return <div className={styles.mockDetail} aria-label={feedback ? '댓글과 피드백 화면의 가명 예시' : '학생 작업 기록 화면의 가명 예시'}>
    <Image src="/guide/dashboard.png" width={1440} height={900} alt="가명 학생 카드가 있는 대시보드 배경" loading="eager" unoptimized />
    <div className={styles.mockDrawer}>
      <div className={styles.mockDrawerHeader}>7번 구름 작업 기록 <span>×</span></div>
      {feedback ? <><div className={styles.mockSection}>슬라이드 댓글과 피드백 <small>새 댓글 1개</small></div><div className={styles.mockComment}><span className={styles.mockBadge}>1</span><small>학생 댓글 · 답변 대기</small><p>이 부분을 다시 설명해 주실 수 있나요?</p><div><b>답글 남기기</b><span>답글 없이 확인 완료</span></div></div><div className={styles.mockSection}>학생에게 전할 피드백</div><div className={styles.mockTextarea}>잘한 점이나 다음에 살펴볼 내용을 적어 주세요.</div></> : <><div className={styles.mockRows}><span>10:04 → 10:23 <b>글자 +154자</b></span><span>10:23 → 10:42 <b>글자 +47자</b></span><span>10:42 → 11:01 <b>이미지 +1개</b></span></div><div className={styles.mockSection}>작업 흐름</div><div className={styles.mockChart}><div>{[12, 77, 84, 31, 42, 18, 25, 36, 44, 52].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><small>10:04　　　　　　　　　10:42　　　　　11:01</small></div></>}
    </div><small className={styles.mockCaption}>실제 화면을 바탕으로 재구성한 가명 예시</small>
  </div>;
}

function Visual({ card }) {
  if (card.visual === 'cover') return <CoverVisual />;
  if (card.visual === 'finish') return <CoverVisual finish />;
  if (card.visual === 'monitor') return <MonitorVisual />;
  if (card.visual === 'record') return <DetailVisual />;
  if (card.visual === 'feedback') return <DetailVisual feedback />;
  return <div className={`${styles.shots} ${card.shots.length > 1 ? styles.twoShots : ''}`}>{card.shots.map((shot) => <Shot key={shot.src} shot={shot} />)}<p className={styles.exampleNote}>개인정보가 없는 설명용 예시 화면입니다. 화면을 누르면 크게 볼 수 있어요.</p></div>;
}

export default function GuideCarousel({ initialStep = 0 }) {
  const [index, setIndex] = useState(() => Math.min(cards.length - 1, initialStep));
  const touchX = useRef(null);
  const card = cards[index];
  const last = index === cards.length - 1;
  const go = (next) => setIndex(Math.max(0, Math.min(cards.length - 1, next)));

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(cards.length - 1, current + 1));
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <main className={styles.page} onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchX.current === null) return; const distance = event.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(distance) < 65) return; event.preventDefault(); go(index + (distance < 0 ? 1 : -1)); }}>
    <div className={styles.shell}>
      <header className={styles.header}><Link href="/" className={styles.brand}><BrandMark size={35} /><span>슬.기록</span></Link><span className={styles.headerTitle}>시작 가이드</span><Link href="/" className={styles.close}>가이드 닫기 ×</Link></header>
      <div className={styles.progressMeta}><span>{card.label}</span><span>{index + 1} / {cards.length}</span></div>
      <div className={styles.progress} aria-label={`가이드 ${cards.length}장 중 ${index + 1}장`}><span style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div>
      <section className={styles.card} aria-live="polite" aria-labelledby="guide-title" key={index}>
        <div className={styles.copy}><span className={styles.kicker}>슬.기록 시작 가이드</span><h1 id="guide-title">{card.title}</h1><p className={styles.body}>{card.body}</p>{card.points && <ul className={styles.points}>{card.points.map((point) => <li key={point}>{point}</li>)}</ul>}{last && <Link href="/" className={styles.startLink}>슬.기록 시작하기 <span aria-hidden="true">↗</span></Link>}</div>
        <div className={styles.visual}><Visual card={card} /></div>
      </section>
      <nav className={styles.navigation} aria-label="가이드 페이지"><button type="button" onClick={() => go(index - 1)} disabled={index === 0}>← 이전</button><div className={styles.dots}>{cards.map((item, itemIndex) => <button key={item.label} type="button" aria-label={`${itemIndex + 1}장: ${item.label}`} aria-current={itemIndex === index ? 'step' : undefined} className={itemIndex === index ? styles.activeDot : ''} onClick={() => go(itemIndex)} />)}</div>{last ? <Link href="/" className={styles.next}>시작하기 ↗</Link> : <button type="button" className={styles.next} onClick={() => go(index + 1)}>다음 →</button>}</nav>
    </div>
  </main>;
}
