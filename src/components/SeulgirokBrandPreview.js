'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './SeulgirokBrandPreview.module.css';

const CONCEPTS = [
  {
    id: 'trace',
    name: '작업 흔적',
    subtitle: '슬라이드 + 기록점',
    description: '노란 슬라이드 위에 초록 기록이 쌓이며 학생의 변화가 차곡차곡 남는 모습을 표현했습니다.',
    src: '/brand/seulgirok-trace.svg',
    recommended: true,
  },
  {
    id: 'bookmark',
    name: '수업 책갈피',
    subtitle: '슬라이드 + 저장',
    description: '중요한 수업 장면을 놓치지 않고 표시해 두는 교사의 관찰 도구를 담았습니다.',
    src: '/brand/seulgirok-bookmark.svg',
  },
  {
    id: 'line',
    name: '이어진 기록',
    subtitle: '변화의 흐름',
    description: '한 줄로 이어지는 모양을 통해 시간에 따라 계속되는 학생의 작업 과정을 표현했습니다.',
    src: '/brand/seulgirok-line.svg',
  },
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 18 18" fill="none">
      <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.76 2.13c1.62-1.49 2.53-3.69 2.53-6.46Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.76-2.13c-.76.51-1.74.82-3.2.82-2.46 0-4.54-1.66-5.28-3.9L.96 12.75C2.43 15.89 5.5 18 9 18Z" />
      <path fill="#FBBC05" d="M3.72 10.6c-.19-.58-.3-1.2-.3-1.8s.11-1.22.3-1.8L.96 4.9C.32 6.18 0 7.6 0 9s.32 2.82.96 4.1l2.76-2.5Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0 5.5 0 2.43 2.11.96 5.25L3.72 7.75C4.46 5.52 6.54 3.58 9 3.58Z" />
    </svg>
  );
}

function BrandLockup({ concept, compact = false }) {
  return (
    <div className={`${styles.lockup} ${compact ? styles.lockupCompact : ''}`}>
      <Image src={concept.src} width={compact ? 38 : 52} height={compact ? 38 : 52} alt="" unoptimized />
      <div>
        <strong>슬기록</strong>
        {!compact && <span>슬라이드 수업의 과정을 슬기롭게</span>}
      </div>
    </div>
  );
}

export default function SeulgirokBrandPreview() {
  const [selectedId, setSelectedId] = useState('trace');
  const selected = CONCEPTS.find((concept) => concept.id === selectedId) || CONCEPTS[0];

  return (
    <main className={styles.page}>
      <section className={styles.review} aria-labelledby="brand-review-title">
        <div className={styles.reviewIntro}>
          <p>슬기록 브랜드 제안</p>
          <h1 id="brand-review-title">어떤 기록의 모습이 가장 잘 어울리나요?</h1>
          <span>로고를 선택하면 아래 시작 화면에 바로 적용됩니다.</span>
        </div>

        <div className={styles.conceptGrid}>
          {CONCEPTS.map((concept) => {
            const selectedConcept = selectedId === concept.id;
            return (
              <button
                key={concept.id}
                type="button"
                className={`${styles.conceptCard} ${selectedConcept ? styles.conceptSelected : ''}`}
                onClick={() => setSelectedId(concept.id)}
                aria-pressed={selectedConcept}
              >
                <span className={styles.conceptIcon}>
                  <Image src={concept.src} width={72} height={72} alt="" unoptimized />
                </span>
                <span className={styles.conceptCopy}>
                  <span className={styles.conceptTitleRow}>
                    <strong>{concept.name}</strong>
                    {concept.recommended && <em>추천</em>}
                  </span>
                  <small>{concept.subtitle}</small>
                  <span>{concept.description}</span>
                </span>
                <span className={styles.selectMark} aria-hidden="true">{selectedConcept ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.previewSection} aria-labelledby="screen-preview-title">
        <div className={styles.previewHeading}>
          <div>
            <p>시작 화면 적용 모습</p>
            <h2 id="screen-preview-title">{selected.name} 로고</h2>
          </div>
          <div className={styles.palette} aria-label="브랜드 색상">
            <span style={{ background: '#203F35' }} title="깊은 초록" />
            <span style={{ background: '#246B55' }} title="기록 초록" />
            <span style={{ background: '#7FC5A2' }} title="새싹 민트" />
            <span style={{ background: '#F9AB00' }} title="슬라이드 노랑" />
          </div>
        </div>

        <div className={styles.browserFrame}>
          <div className={styles.browserBar} aria-hidden="true">
            <span /><span /><span />
            <div>seulgirok.chorok.app</div>
          </div>

          <div className={styles.loginCanvas}>
            <header className={styles.loginHeader}>
              <BrandLockup concept={selected} compact />
              <span>학생의 작업 과정을 살피는 도구</span>
            </header>

            <div className={styles.loginLayout}>
              <section className={styles.heroCopy}>
                <p className={styles.heroLabel}>결과보다 과정을 봅니다</p>
                <h3>슬라이드에 남은 작은 변화,<br /><span>배움의 과정이 됩니다.</span></h3>
                <p className={styles.heroDescription}>
                  학생마다 다른 작업 흐름을 살피고, 필요한 도움을 제때 전해 보세요.
                </p>

                <div className={styles.traceVisual} aria-hidden="true">
                  <div className={styles.slideBack} />
                  <div className={styles.slideFront}>
                    <span className={styles.slideTitle} />
                    <span className={styles.slideTextOne} />
                    <span className={styles.slideTextTwo} />
                    <div className={styles.slideImage} />
                  </div>
                  <div className={styles.traceLine}>
                    <i /><i /><i /><i />
                  </div>
                  <div className={styles.changeNote}>텍스트와 이미지가 추가되었어요</div>
                </div>
              </section>

              <section className={styles.loginCard} aria-labelledby="login-card-title">
                <BrandLockup concept={selected} />
                <div className={styles.loginCardCopy}>
                  <h3 id="login-card-title">선생님, 반갑습니다.</h3>
                  <p>Google 계정으로 연결하고<br />학급의 기록을 이어서 확인하세요.</p>
                </div>
                <button type="button" disabled>
                  <GoogleMark />
                  <span>Google 계정으로 계속하기</span>
                  <b aria-hidden="true">›</b>
                </button>
                <div className={styles.scopeNote}>선택한 파일과 슬기록이 만든 자료만 연결합니다.</div>
                <div className={styles.driveNote}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  수업 자료는 선생님의 Google Drive에 저장됩니다.
                </div>
              </section>
            </div>

            <footer className={styles.loginFooter}>
              <span>made by 초록덕후</span>
              <span>개인정보처리방침&nbsp;&nbsp;&nbsp;이용 안내</span>
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}
