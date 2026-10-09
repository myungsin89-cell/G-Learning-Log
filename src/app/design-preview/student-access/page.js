'use client';

import { useState } from 'react';
import StudentAccess from '@/components/StudentAccess';

export default function Page() {
  const [open, setOpen] = useState(true);
  return <main style={{ minHeight: '100svh', background: '#f8faf7', padding: 40 }}><button onClick={() => setOpen(true)}>학생 접속 안내 시안 열기</button>{open && <StudentAccess className="5학년 2반" assignment={{ name: '달의 모양 관찰하기' }} students={[{ id: 'one', number: 1, name: '김누리' }, { id: 'four', number: 4, name: '송명신' }]} entry={{ mode: 'shared' }} preview onClose={() => setOpen(false)} />}</main>;
}
