'use client';

import BrandMark from './BrandMark';
import styles from './EntryScreen.module.css';

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

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EntryScreen({ onLogin, preview = false, loading = false }) {
  return (
    <main className={styles.page}>
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div className={styles.brand} aria-label="G배움로그">
            <BrandMark size={42} />
            <span>G배움로그</span>
          </div>
          <span className={styles.headerNote}>교사를 위한 배움의 기록 공간</span>
        </header>

        <div className={styles.layout}>
          <section className={styles.story} aria-labelledby="hero-title">
            <div className={styles.eyebrow}><span className={styles.eyebrowLine} /> 함께 쌓이는 배움의 기록</div>
            <h1 id="hero-title" className={styles.headline}>
              수업의 순간을 모아,<br />
              <span>성장의 흐름을 보다.</span>
            </h1>
            <p className={styles.description}>
              과제를 나누고, 학생의 활동을 살피고,<br className={styles.desktopBreak} />
              필요한 피드백을 한곳에 남겨 보세요.
            </p>

            <div className={styles.featureRow} aria-label="주요 기능">
              <span>과제 배부</span>
              <span className={styles.featureDot} />
              <span>실시간 관찰</span>
              <span className={styles.featureDot} />
              <span>피드백 기록</span>
            </div>

            <div className={styles.sample} aria-hidden="true">
              <div className={styles.sampleTop}>
                <div>
                  <span className={styles.sampleOverline}>오늘의 수업</span>
                  <strong>우리 반의 배움이 이어지고 있어요</strong>
                </div>
                <span className={styles.liveBadge}><span /> 진행 중</span>
              </div>
              <div className={styles.sampleDivider} />
              <div className={styles.sampleRow}>
                <span className={styles.sampleIcon}>01</span>
                <div><strong>과제 나누기</strong><small>학생에게 활동 자료 전달</small></div>
                <span className={styles.sampleDone}>완료</span>
              </div>
              <div className={styles.sampleRow}>
                <span className={styles.sampleIcon}>02</span>
                <div><strong>배움 살펴보기</strong><small>활동 상황을 한눈에 확인</small></div>
                <span className={styles.sampleProgress}>진행 중</span>
              </div>
              <div className={styles.sampleRow}>
                <span className={styles.sampleIcon}>03</span>
                <div><strong>피드백 남기기</strong><small>다음 배움을 위한 기록</small></div>
                <span className={styles.sampleNext}>다음 단계</span>
              </div>
            </div>
          </section>

          <section className={styles.signInCard} aria-labelledby="sign-in-title">
            <div className={styles.cardOverline}>G배움로그 시작하기</div>
            <h2 id="sign-in-title">선생님, 반갑습니다.</h2>
            <p>Google 계정으로 연결하면<br />학급의 기록을 이어서 볼 수 있어요.</p>

            <button
              type="button"
              className={styles.googleButton}
              onClick={onLogin}
              disabled={preview || loading}
              aria-busy={loading}
              aria-describedby={preview ? 'preview-note' : undefined}
            >
              <GoogleMark />
              <span aria-live="polite">{loading ? 'Google 연결 준비 중...' : 'Google 계정으로 계속하기'}</span>
              <ArrowIcon />
            </button>

            <div className={styles.supported}>
              <span className={styles.supportedLabel}>함께 사용하는 도구</span>
              <div className={styles.supportedApps}>
                <span>Drive</span><span className={styles.separator} />
                <span>Sheets</span><span className={styles.separator} />
                <span>Slides</span>
              </div>
            </div>

            <div className={styles.privacyNote}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none">
                <rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>수업 자료는 선생님의 Google Drive에 저장됩니다.</span>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <span>made by 초록덕후</span>
          {preview && <span id="preview-note">디자인 시안 · 로그인 버튼은 연결되지 않았습니다.</span>}
        </footer>
      </div>
    </main>
  );
}
