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
const CHOROK_ORIGIN = 'https://baeumlog.chorok.app';
const VERCEL_ORIGIN = 'https://g-learning-log-next.vercel.app';

export default function StudentAccess({ className, assignment, students, entry, onConfigure, onClose, preview = false }) {
  const dialog = useRef(null), inFlight = useRef(false), titleId = useId();
  const [choice, setChoice] = useState(null), [updated, setUpdated] = useState(null), [large, setLarge] = useState(false);
  const [shareOrigin, setShareOrigin] = useState(VERCEL_ORIGIN);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [selectedQr, setSelectedQr] = useState(null), [individualQr, setIndividualQr] = useState(null), [pdfBusy, setPdfBusy] = useState(false);
  const activeEntry = updated || entry, mode = choice || activeEntry?.mode || 'shared';
  const linkedStudents = students.filter((student) => student.slideUrl);
  const origin = useSyncExternalStore(subscribeOrigin, currentOrigin, serverOrigin);
  const hasShareDomains = !preview && [CHOROK_ORIGIN, VERCEL_ORIGIN].includes(origin);
  const linkOrigin = hasShareDomains ? shareOrigin : origin;
  const link = !origin ? '' : preview ? `${origin}/design-preview/student` : activeEntry?.id ? studentEntryUrl(linkOrigin, activeEntry.id) : '';
  const qrUrl = qr?.link === link ? qr.url : '';
  const individualQrUrl = individualQr?.link === selectedQr?.link ? individualQr?.url : '';
  const local = link && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(link).hostname);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 1000, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#20342b', light: '#ffffff' } }).then((url) => { if (!cancelled) setQr({ link, url }); }).catch(() => { if (!cancelled) setError('QR코드를 만들지 못했습니다. 링크를 복사해 주세요.'); });
    return () => { cancelled = true; };
  }, [link]);
  useEffect(() => {
    if (!selectedQr) return;
    let cancelled = false;
    QRCode.toDataURL(selectedQr.link, { width: 1000, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#20342b', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setIndividualQr({ link: selectedQr.link, url }); })
      .catch(() => { if (!cancelled) setError('학생 QR을 만들지 못했습니다. 링크를 사용해 주세요.'); });
    return () => { cancelled = true; };
  }, [selectedQr]);
  const close = () => { if (!busy && !pdfBusy) onClose(); };
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
  async function downloadPdf() {
    if (pdfBusy || !linkedStudents.length) return;
    setPdfBusy(true); setError(''); setMessage('');
    try {
      const { createStudentQrPdf } = await import('@/lib/studentQrPdf.mjs');
      const blob = await createStudentQrPdf({ className, assignmentName: assignment.name, students: linkedStudents });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `G배움로그_${className}_${assignment.name}_학생별QR.pdf`.replace(/[\\/:*?"<>|]/g, '_');
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${linkedStudents.length}명 학생 QR PDF를 내려받았습니다.`);
    } catch (err) { setError(err.message || '학생 QR PDF를 만들지 못했습니다.'); }
    finally { setPdfBusy(false); }
  }
  return <dialog ref={dialog} className={`${styles.dialog} ${large ? styles.large : ''}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (large) setLarge(false); else close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <header><div><p>{className}</p><h2 id={titleId}>{large ? assignment.name : '학생 접속 안내'}</h2></div><button onClick={large ? () => setLarge(false) : close} disabled={busy || pdfBusy} aria-label={large ? '크게 보기 닫기' : '닫기'}>×</button></header>
    {!large && <div className={styles.tabs} aria-label="학생 접속 방식"><button className={mode === 'shared' ? styles.selected : ''} aria-pressed={mode === 'shared'} onClick={() => { setChoice('shared'); setError(''); }} disabled={busy || pdfBusy}>공통 링크 · 이름 선택</button><button className={mode === 'individual' ? styles.selected : ''} aria-pressed={mode === 'individual'} onClick={() => { setChoice('individual'); setError(''); }} disabled={busy || pdfBusy}>학생별 링크 · QR 전달</button></div>}
    <div className={styles.body}>{preview && <p className={styles.localNote}>디자인 시안 · QR은 예시 학생 화면으로 연결됩니다.</p>}
      {mode === 'shared' ? <>
        {!large && <p className={styles.description}>공통 링크 소지자는 학생 목록과 슬라이드 연결 정보를 볼 수 있습니다. 이름 선택은 본인인증이 아니며, 가명을 사용할 수 있습니다.</p>}
        {link && hasShareDomains && !large && <div className={styles.shareDomains} role="group" aria-label="학생 링크 주소"><span>학생 링크 주소</span><button className={shareOrigin === VERCEL_ORIGIN ? styles.selectedDomain : ''} aria-pressed={shareOrigin === VERCEL_ORIGIN} onClick={() => setShareOrigin(VERCEL_ORIGIN)}>Vercel 주소</button><button className={shareOrigin === CHOROK_ORIGIN ? styles.selectedDomain : ''} aria-pressed={shareOrigin === CHOROK_ORIGIN} onClick={() => setShareOrigin(CHOROK_ORIGIN)}>초록 주소</button></div>}
        {link ? <div className={styles.common}><div className={styles.qr}>{qrUrl ? <Image src={qrUrl} width={1000} height={1000} unoptimized alt="학생 공통 접속 QR코드" /> : <p>QR코드 만드는 중…</p>}</div><div className={styles.instructions}><h3>QR코드를 찍고<br />내 이름을 선택하세요.</h3><p>자신의 슬라이드에서 작업을 시작해요.</p><a className={styles.url} href={link} target="_blank" rel="noopener noreferrer">{link}</a></div></div> : <div className={styles.prepare}><strong>하나의 링크로 학급 전체가 접속해요.</strong><p>학생 명단과 슬라이드 연결 정보를 담은 접속 화면을 만듭니다.<br />공통 링크를 가진 학생은 목록에서 자기 이름을 선택합니다.</p>{onConfigure && <button className={styles.primary} onClick={configure} disabled={busy}>{busy ? '학생 접속 링크 만드는 중…' : '공통 학생 링크 만들기'}</button>}</div>}
        {local && !preview && <p className={styles.localNote}>현재 QR은 개발용 localhost 주소입니다. 학생 기기에서 사용할 링크와 QR은 배포한 주소에서 생성해 주세요.</p>}
        {link && <div className={styles.actions}><button onClick={() => copy(link)}>학생 링크 복사</button><a href={link} target="_blank" rel="noopener noreferrer">접속 화면 확인 ↗</a>{qrUrl && <a href={qrUrl} download={`${assignment.name}_학생접속_QR.png`}>QR 다운로드</a>}<button className={styles.primary} onClick={() => setLarge((value) => !value)}>{large ? '작게 보기' : '크게 보기'}</button></div>}
      </> : <><p className={styles.description}>학생별 QR은 각자의 Google 슬라이드로 바로 연결됩니다. QR이 인쇄된 카드는 학생별로 잘라 배부해 주세요. 링크 편집으로 공유된 슬라이드는 링크 소지자가 편집할 수 있습니다.</p><div className={styles.list}>{students.map((student) => <div key={studentKey(student)}><span><strong>{studentLabel(student)}</strong>{student.shareStatus && student.shareStatus !== 'link-editor' && <small>{student.shareStatus === 'private' ? 'Google 슬라이드에서 편집 권한을 공유해 주세요.' : '편집 공유 미완료 · 과제 목록에서 배부 이어하기'}</small>}</span>{student.slideUrl ? <><a href={student.slideUrl} target="_blank" rel="noopener noreferrer">열기</a><button onClick={() => copy(student.slideUrl)} aria-label={`${studentLabel(student)} 링크 복사`}>복사</button><button onClick={() => setSelectedQr((current) => current?.key === studentKey(student) ? null : { key: studentKey(student), label: studentLabel(student), link: student.slideUrl })} aria-expanded={selectedQr?.key === studentKey(student)}>{selectedQr?.key === studentKey(student) ? 'QR 닫기' : 'QR 보기'}</button></> : <small>슬라이드 미연결</small>}</div>)}</div>{selectedQr && <div className={styles.individualQr}><strong>{selectedQr.label} · 개인 슬라이드 QR</strong>{individualQrUrl ? <><Image src={individualQrUrl} width={1000} height={1000} unoptimized alt={`${selectedQr.label} 개인 슬라이드 QR코드`} /><a href={individualQrUrl} download={`${selectedQr.label}_슬라이드_QR.png`}>QR 이미지 다운로드</a></> : <p>QR코드 만드는 중…</p>}</div>}<div className={styles.actions}><button onClick={() => copy(linkedStudents.map((student) => `${studentLabel(student)}\t${student.slideUrl}`).join('\n'))} disabled={!linkedStudents.length}>전체 링크 복사</button><button className={styles.primary} onClick={downloadPdf} disabled={pdfBusy || !linkedStudents.length}>{pdfBusy ? 'PDF 만드는 중…' : `우리 반 학생 QR PDF 다운로드 (${linkedStudents.length}명)`}</button></div>{linkedStudents.length < students.length && <p className={styles.localNote}>슬라이드가 연결되지 않은 {students.length - linkedStudents.length}명은 PDF에서 제외됩니다.</p>}</>}
      {!large && onConfigure && mode !== (activeEntry?.mode || 'shared') && <button className={styles.preference} onClick={configure} disabled={busy}>{busy ? '저장 중…' : '이 접속 방식을 기본으로 저장'}</button>}
      {message && <p className={styles.message} role="status">{message}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </dialog>;
}
