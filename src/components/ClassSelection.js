'use client';

import BrandMark from './BrandMark';
import styles from './ClassSelection.module.css';

export function ClassSelectionHeader({ onLogout, preview = false }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand} aria-label="G배움로그">
          <BrandMark size={36} />
          <span>G배움로그</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.headerLabel}>내 학급</span>
          {!preview && (
            <button type="button" className={styles.logout} onClick={onLogout}>
              로그아웃
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function ClassSelection({
  classNames = [],
  loading = false,
  onCreate,
  onSelect,
  onDelete,
  preview = false,
}) {
  return (
    <section className={styles.selection} aria-labelledby="class-selection-title">
      <div className={styles.headingRow}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>내 학급</span>
          <h1 id="class-selection-title">어느 학급을 살펴볼까요?</h1>
          <p>학급을 선택해 과제를 열고, 학생의 작업 과정을 살펴보세요.</p>
        </div>
        {!loading && classNames.length > 0 && (
          <button type="button" className={styles.createButton} onClick={onCreate} disabled={preview}>
            <span aria-hidden="true">＋</span> 새 학급 등록
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading} role="status">학급 목록을 불러오는 중입니다...</div>
      ) : classNames.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark} aria-hidden="true">＋</div>
          <h2>첫 학급을 등록해 보세요</h2>
          <p>학생 명단을 등록하면 슬라이드 과제를 배부하고 작업 과정을 살펴볼 수 있어요.</p>
          <button type="button" className={styles.createButton} onClick={onCreate} disabled={preview}>
            첫 학급 등록하기
          </button>
        </div>
      ) : (
        <>
          <div className={styles.listHeading}>
            <h2>학급 목록</h2>
            <span>{classNames.length}개 학급</span>
          </div>
          <div className={styles.grid}>
            {classNames.map((className) => (
              <article key={className} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardAction}
                  onClick={() => onSelect?.(className)}
                  disabled={preview}
                  aria-label={`${className} 과제 목록 보기`}
                >
                  <span className={styles.cardLabel}>학급</span>
                  <strong className={styles.cardTitle}>{className}</strong>
                  <span className={styles.cardDescription}>과제를 선택하고 학생의 작업을 살펴보세요.</span>
                  <span className={styles.cardFooter}>
                    <span>과제 목록 보기</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                </button>
                <details className={styles.moreMenu}>
                  <summary aria-label={`${className} 관리 메뉴`} title="학급 관리">···</summary>
                  <div className={styles.menuPanel}>
                    <button type="button" onClick={() => onDelete?.(className)} disabled={preview}>
                      학급 삭제
                    </button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
