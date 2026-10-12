'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ClassroomCreation from './ClassroomCreation';
import styles from './ClassWorkspacePreview.module.css';

// Only this design-preview route simulates creation. It never calls Google.
const roster = Array.from({ length: 30 }, (_, index) => ({ number: index + 1, name: `학생${String(index + 1).padStart(2, '0')}` }));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CreationPreview() {
  const [kind, setKind] = useState(null), [scenario, setScenario] = useState('success'), [notice, setNotice] = useState('');
  const attempts = useRef(0);
  const open = (value) => { attempts.current = 0; setNotice(''); setKind(value); };
  async function simulate({ name, roster: recipients, onProgress }) {
    const attempt = ++attempts.current;
    const total = recipients?.length || 0;
    const report = (message, percent, completed = 0) => onProgress(message, { percent, completed, total });
    await pause(700);
    if (kind === 'class') {
      report('학급 저장 공간을 준비했어요.', 30);
      await pause(700); report('학생 명단 저장 중…', 70);
      await pause(700); report('학급과 학생 명단을 저장했어요.', 100);
      return { name };
    }
    report('과제 저장 공간과 배부 원본 준비 중…', 5);
    await pause(700);
    report('학생 슬라이드 생성 준비를 마쳤어요.', 20);
    for (let completed = 1; completed <= total; completed++) {
      await pause(350);
      report(`${recipients[completed - 1].number}번 ${recipients[completed - 1].name} 슬라이드를 만들었어요.`, 20 + Math.floor(completed / total * 65), completed);
      if (scenario === 'failure' && attempt === 1 && completed === Math.min(12, total)) throw new Error('Google 연결이 끊어졌습니다. 다시 연결하고 이어서 진행해 주세요.');
    }
    await pause(700); report('핵심 키워드와 과제 설정 저장 중…', 85, total);
    await pause(700); report('공통 학생 접속 링크 만드는 중…', 92, total);
    await pause(700); report('생성 결과 마무리 중…', 97, total);
    await pause(500); report('생성을 완료했습니다.', 100, total);
    return { assignment: { name }, students: recipients, warnings: scenario === 'warning' && attempt === 1 ? ['학생 슬라이드는 만들었지만 일부 편집 공유 설정을 완료하지 못했습니다.'] : [] };
  }
  return <main className={styles.page}><div className={styles.main}>
    <Link href="/design-preview/classes" className={styles.textButton}>학급 화면 시안으로</Link>
    <div className={styles.classHeading}><div><h1>슬라이드 생성 화면 시안</h1><p className={styles.description}>예시 진행률로 화면을 확인합니다. Google Drive에 파일을 만들지 않습니다.</p></div></div>
    <label className={styles.field}>확인할 상황<select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="success">생성 완료</option><option value="failure">중간 연결 실패 후 재시도</option><option value="warning">생성 완료 후 공유 확인</option></select></label>
    <div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={() => open('class')}>학급 생성 시안</button><button className={styles.primaryButton} onClick={() => open('assignment')}>학생 슬라이드 생성 시안</button></div>
    {notice && <p role="status">{notice}</p>}
    {kind && <ClassroomCreation kind={kind} className="5학년 2반" roster={roster} onCreate={simulate} onClose={() => setKind(null)} onCreated={(created) => { setNotice(`${created.assignment?.name || created.name} · 생성 결과를 확인했습니다.`); setKind(null); }} />}
  </div></main>;
}
