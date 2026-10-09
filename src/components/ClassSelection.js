'use client';

import Link from 'next/link';
import BrandMark from './BrandMark';
import styles from './ClassSelection.module.css';

export function ClassSelectionHeader({ onLogout, preview = false, displayName, onReconnect, loading = false }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand} aria-label="G배움로그">
          <BrandMark size={36} />
          <span>G배움로그</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.headerLabel}>{displayName ? `${displayName} 선생님` : '내 학급'}</span>
          {onReconnect && <button type="button" className={styles.logout} onClick={onReconnect} disabled={loading}>다시 로그인</button>}
          {!preview && (
            <button type="button" className={styles.logout} onClick={onLogout} disabled={loading}>
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
  previewNavigation = false,
  classItems,
  disabled = false,
  onRefresh,
}) {
  const items = classItems || classNames.map((name) => ({ id: name, name }));
  const canCreate = Boolean(onCreate || preview);
  const CardAction = preview && previewNavigation ? Link : 'button';
  return (
    <section className={styles.selection} aria-labelledby="class-selection-title">
      <div className={styles.headingRow}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>내 학급</span>
          <h1 id="class-selection-title">어느 학급을 살펴볼까요?</h1>
          <p>학급을 선택해 과제를 열고, 학생의 작업 과정을 살펴보세요.</p>
        </div>
        {!loading && items.length > 0 && canCreate && (
          <button type="button" className={styles.createButton} onClick={onCreate} disabled={preview || disabled}>
            <span aria-hidden="true">＋</span> 새 학급 만들기
          </button>
        )}
        {!canCreate && onRefresh && <button type="button" className={styles.refreshButton} onClick={onRefresh} disabled={disabled}>목록 새로고침</button>}
      </div>

      {loading ? (
        <div className={styles.loading} role="status">학급 목록을 불러오는 중입니다...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark} aria-hidden="true">{canCreate ? '＋' : '▤'}</div>
          <h2>{canCreate ? '첫 학급을 등록해 보세요' : '등록된 학급이 없어요'}</h2>
          <p>{canCreate ? '학생 명단을 등록하면 슬라이드 과제를 배부하고 작업 과정을 살펴볼 수 있어요.' : '학급을 등록한 Google 계정으로 로그인했는지 확인해 주세요.'}</p>
          {canCreate && <button type="button" className={styles.createButton} onClick={onCreate} disabled={preview || disabled}>
            첫 학급 등록하기
          </button>}
        </div>
      ) : (
        <>
          <div className={styles.listHeading}>
            <h2>학급 목록</h2>
            <span>{items.length}개 학급</span>
          </div>
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <CardAction
                  {...(preview && previewNavigation
                    ? { href: `/design-preview/classroom?className=${encodeURIComponent(item.name)}` }
                    : { type: 'button', onClick: () => onSelect?.(classItems ? item : item.name), disabled: preview || disabled })}
                  className={styles.cardAction}
                  aria-label={`${item.name} 과제 목록 보기`}
                >
                  <span className={styles.cardLabel}>학급</span>
                  <strong className={styles.cardTitle}>{item.name}</strong>
                  <span className={styles.cardDescription}>과제를 선택하고 학생의 작업을 살펴보세요.</span>
                  <span className={styles.cardFooter}>
                    <span>과제 목록 보기</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                </CardAction>
                {(onDelete || preview) && <details className={styles.moreMenu}>
                  <summary aria-label={`${item.name} 관리 메뉴`} title="학급 관리">···</summary>
                  <div className={styles.menuPanel}>
                    <button type="button" onClick={() => onDelete?.(item.name)} disabled={preview || disabled}>
                      학급 삭제
                    </button>
                  </div>
                </details>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
