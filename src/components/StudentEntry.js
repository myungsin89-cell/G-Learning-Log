'use client';

import { useEffect, useState } from 'react';
import { loadStudentEntry } from '@/lib/studentEntry.mjs';
import BrandMark from './BrandMark';
import MadeByStamp from './MadeByStamp';
import styles from './StudentEntry.module.css';

export default function StudentEntry({ sheetId, example = null }) {
  const [data, setData] = useState(example), [error, setError] = useState(''), [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (example) return;
    let cancelled = false;
    loadStudentEntry(sheetId).then((result) => { if (!cancelled) { setData(result); setError(''); } }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [sheetId, example, retry]);
  const visible = (data?.students || []).filter((student) => `${student.number} ${student.name}`.includes(search.trim()));
  return <div className={styles.page}><header className={styles.brand}><BrandMark size={36} /><span>G배움로그</span></header><main className={styles.main}>
    {example && <span className={styles.example}>디자인 시안</span>}
    <div className={styles.heading}><p>{data?.className || '우리 학급'}</p><h1>{data?.assignmentName || '수업 과제 접속'}</h1><span>내 이름을 선택해 슬라이드를 열어 보세요.</span></div>
    {error ? <div className={styles.empty} role="alert"><p>{error}</p><button onClick={() => { setError(''); setRetry((value) => value + 1); }}>다시 불러오기</button></div> : !data ? <p className={styles.empty} role="status">학생 명단을 불러오는 중이에요…</p> : <>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="내 이름 찾기" placeholder="번호 또는 이름 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className={styles.grid}>{visible.map((student) => <button key={student.number} onClick={() => setSelected(student)}><span>{student.number}번</span><strong>{student.name}</strong><i aria-hidden="true">↗</i></button>)}</div>
      {!visible.length && <p className={styles.empty}>검색한 이름이 없어요. 번호나 이름을 다시 확인해 보세요.</p>}
      {selected && <section className={styles.confirm} aria-label="선택한 학생 확인"><p><strong>{selected.number}번 {selected.name}</strong> 학생이 맞나요?</p>{selected.slideUrl && !example ? <a href={selected.slideUrl} target="_blank" rel="noopener noreferrer">내 슬라이드 열기 ↗</a> : <p>{example ? '실제 접속 화면에서는 자신의 슬라이드가 열립니다.' : '슬라이드를 준비 중이에요. 선생님께 확인해 주세요.'}</p>}<button onClick={() => setSelected(null)}>이름 다시 선택</button></section>}
    </>}
    <MadeByStamp />
  </main></div>;
}
