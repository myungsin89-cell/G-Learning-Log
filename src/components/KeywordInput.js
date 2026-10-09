'use client';

import { useId, useRef, useState } from 'react';
import styles from './KeywordInput.module.css';

export default function KeywordInput({ words, onChange, draft, onDraftChange, disabled = false }) {
  const inputId = useId(), input = useRef(null), composing = useRef(false);
  const [error, setError] = useState('');
  function add() {
    const word = draft.trim();
    if (disabled || !word) return;
    if (words.includes(word)) { setError('이미 추가된 키워드입니다.'); return; }
    if ([...words, word].join(', ').length > 500) { setError('키워드는 전체 500자까지 추가할 수 있습니다.'); return; }
    onChange([...words, word]); onDraftChange(''); setError(''); input.current?.focus();
  }
  return <div className={styles.editor}>
    <label htmlFor={inputId}>키워드 입력</label>
    <div className={styles.row}><input ref={input} id={inputId} value={draft} onChange={(event) => { onDraftChange(event.target.value); setError(''); }} placeholder="예: 보름달" maxLength={500} disabled={disabled} autoComplete="off" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => { if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); add(); } }} /><button type="button" onClick={add} disabled={disabled || !draft.trim()}>추가</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.list}><p>추가한 키워드 <strong>{words.length}개</strong></p><div className={styles.chips}>{words.map((word) => <span key={word}><span>{word}</span><button type="button" aria-label={`${word} 삭제`} onClick={() => { onChange(words.filter((item) => item !== word)); setError(''); }} disabled={disabled}>×</button></span>)}{!words.length && <p className={styles.empty}>추가한 키워드가 없어요.</p>}</div></div>
  </div>;
}
