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
          <span className={styles.headerNote}>학생의 작업 과정을 살피는 도구</span>
        </header>

        <div className={styles.layout}>
          <section className={styles.story} aria-labelledby="hero-title">
            <div className={styles.eyebrow}><span className={styles.eyebrowLine} /> G배움로그를 소개합니다</div>
            <h1 id="hero-title" className={styles.headline}>
              학생의 슬라이드 작업,<br />
              <span>과정까지 한눈에.</span>
            </h1>
            <p className={styles.description}>
              구글 슬라이드로 수업할 때, 학생마다 다른 진행 상황을 살피고 필요한 도움을 제때 전할 수 있습니다.
            </p>
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
              Google Drive · Sheets · Slides와 연결됩니다.
            </div>

            <div className={styles.privacyNote}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none">
                <rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>수업 자료는 선생님의 Google Drive에 저장됩니다.</span>
            </div>
          </section>

          <section className={styles.steps} aria-labelledby="steps-title">
            <h2 id="steps-title">G배움로그에서 살펴볼 수 있는 것</h2>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <span>01</span>
                <strong>슬라이드 작업 기록</strong>
                <p>학생이 언제, 어떻게 내용을 바꿨는지 살펴봅니다.</p>
              </div>
              <div className={styles.step}>
                <span>02</span>
                <strong>복붙 의심 내역</strong>
                <p>짧은 시간에 크게 늘어난 텍스트를 확인합니다.</p>
              </div>
              <div className={styles.step}>
                <span>03</span>
                <strong>피드백 필요 학생</strong>
                <p>작업 흐름을 살펴 도움이 필요한 학생을 찾습니다.</p>
              </div>
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
