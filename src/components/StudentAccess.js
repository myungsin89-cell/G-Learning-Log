'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { studentEntryUrl } from '@/lib/studentEntry.mjs';
import { studentLabel } from '@/lib/workRecords.mjs';
import { studentKey } from '@/lib/storedWorkRecords.mjs';
import styles from './StudentAccess.module.css';

const subscribeOrigin = () => () => {};
const currentOrigin = () => window.location.origin;
const serverOrigin = () => '';

export default function StudentAccess({ className, assignment, students, entry, onConfigure, onClose, preview = false }) {
  const dialog = useRef(null), inFlight = useRef(false), titleId = useId();
  const [choice, setChoice] = useState(null), [updated, setUpdated] = useState(null), [large, setLarge] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const activeEntry = updated || entry, mode = choice || activeEntry?.mode || 'shared';
  const origin = useSyncExternalStore(subscribeOrigin, currentOrigin, serverOrigin);
  const link = !origin ? '' : preview ? `${origin}/design-preview/student` : activeEntry?.id ? studentEntryUrl(origin, activeEntry.id) : '';
  const local = link && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(link).hostname);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 1000, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#20342b', light: '#ffffff' } }).then((url) => { if (!cancelled) setQr(url); }).catch(() => { if (!cancelled) setError('QR코드를 만들지 못했습니다. 링크를 복사해 주세요.'); });
    return () => { cancelled = true; };
  }, [link]);
  const close = () => { if (!busy) onClose(); };
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setMessage('복사했습니다.'); }
    catch { setError('복사를 완료하지 못했습니다. 표시된 링크를 직접 복사해 주세요.'); }
  }
  async function configure() {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await onConfigure(mode); setUpdated(result); setMessage(mode === 'shared' ? '공통 학생 접속 링크를 준비했습니다.' : '학생별 링크 전달을 기본으로 저장했습니다.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <dialog ref={dialog} className={`${styles.dialog} ${large ? styles.large : ''}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (large) setLarge(false); else close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <header><div><p>{className}</p><h2 id={titleId}>{large ? assignment.name : '학생 접속 안내'}</h2></div><button onClick={large ? () => setLarge(false) : close} disabled={busy} aria-label={large ? '크게 보기 닫기' : '닫기'}>×</button></header>
    {!large && <div className={styles.tabs} aria-label="학생 접속 방식"><button className={mode === 'shared' ? styles.selected : ''} aria-pressed={mode === 'shared'} onClick={() => { setChoice('shared'); setError(''); }} disabled={busy}>공통 링크 · 이름 선택</button><button className={mode === 'individual' ? styles.selected : ''} aria-pressed={mode === 'individual'} onClick={() => { setChoice('individual'); setError(''); }} disabled={busy}>학생별 링크 전달</button></div>}
    <div className={styles.body}>{preview && <p className={styles.localNote}>디자인 시안 · QR은 예시 학생 화면으로 연결됩니다.</p>}
      {mode === 'shared' ? <>
        {link ? <div className={styles.common}><div className={styles.qr}>{qr ? <Image src={qr} width={1000} height={1000} unoptimized alt="학생 공통 접속 QR코드" /> : <p>QR코드 만드는 중…</p>}</div><div className={styles.instructions}><h3>QR코드를 찍고<br />내 이름을 선택하세요.</h3><p>자신의 슬라이드에서 작업을 시작해요.</p><a className={styles.url} href={link} target="_blank" rel="noopener noreferrer">{link}</a></div></div> : <div className={styles.prepare}><strong>하나의 링크로 학급 전체가 접속해요.</strong><p>학생 명단과 슬라이드 연결 정보를 담은 접속 화면을 만듭니다.<br />공통 링크를 가진 학생은 목록에서 자기 이름을 선택합니다.</p>{onConfigure && <button className={styles.primary} onClick={configure} disabled={busy}>{busy ? '학생 접속 링크 만드는 중…' : '공통 학생 링크 만들기'}</button>}</div>}
        {local && !preview && <p className={styles.localNote}>현재 QR은 개발용 localhost 주소입니다. 학생 기기에서 사용할 링크와 QR은 배포한 주소에서 생성해 주세요.</p>}
        {link && <div className={styles.actions}><button onClick={() => copy(link)}>학생 링크 복사</button><a href={link} target="_blank" rel="noopener noreferrer">접속 화면 확인 ↗</a>{qr && <a href={qr} download={`${assignment.name}_학생접속_QR.png`}>QR 다운로드</a>}<button className={styles.primary} onClick={() => setLarge((value) => !value)}>{large ? '작게 보기' : '크게 보기'}</button></div>}
      </> : <><p className={styles.description}>각 학생에게 자신의 슬라이드 링크를 전달하세요.</p><div className={styles.list}>{students.map((student) => <div key={studentKey(student)}><span><strong>{studentLabel(student)}</strong>{student.shareStatus && student.shareStatus !== 'link-editor' && <small>{student.shareStatus === 'private' ? 'Google 슬라이드에서 편집 권한을 공유해 주세요.' : '편집 공유 미완료 · 과제 목록에서 배부 이어하기'}</small>}</span>{student.slideUrl ? <><a href={student.slideUrl} target="_blank" rel="noopener noreferrer">열기</a><button onClick={() => copy(student.slideUrl)} aria-label={`${studentLabel(student)} 링크 복사`}>복사</button></> : <small>슬라이드 미연결</small>}</div>)}</div><div className={styles.actions}><button onClick={() => copy(students.filter((student) => student.slideUrl).map((student) => `${studentLabel(student)}\t${student.slideUrl}`).join('\n'))}>전체 링크 복사</button></div></>}
      {!large && onConfigure && mode !== (activeEntry?.mode || 'shared') && <button className={styles.preference} onClick={configure} disabled={busy}>{busy ? '저장 중…' : '이 접속 방식을 기본으로 저장'}</button>}
      {message && <p className={styles.message} role="status">{message}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </dialog>;
}
