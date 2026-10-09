export function studentLabel(student) {
  return `${student.number ? `${student.number}번 ` : ''}${student.name}`.trim();
}

export function parseRosterInput(text) {
  const numbers = new Set();
  const students = text.split('\n').filter((line) => line.trim()).map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\S.*)$/);
    if (!match) throw new Error('한 줄에 출석번호와 이름 또는 가명을 입력해 주세요. 예: 4 송명신');
    const number = Number(match[1]);
    if (number < 1 || !Number.isSafeInteger(number) || numbers.has(number)) throw new Error('출석번호는 양수이며 중복되지 않아야 합니다.');
    numbers.add(number);
    return { number, name: match[2].trim().slice(0, 40) };
  });
  if (!students.length || students.length > 50) throw new Error('학생은 1명부터 50명까지 입력해 주세요.');
  return students.sort((a, b) => a.number - b.number);
}

// A short interval alone is insufficient: both snapshots must belong to the
// same uninterrupted collection session. This is a review cue, never proof of paste.
export function isTextSurge({ charDelta, previousCheckedAt, checkedAt, continuous }) {
  const seconds = (Date.parse(checkedAt) - Date.parse(previousCheckedAt)) / 1000;
  return continuous === true && seconds > 0 && seconds <= 60 && charDelta >= 180;
}

export function authorRole(author) {
  if (author?.me === true) return 'teacher';
  if (author?.me === false && author?.displayName) return 'other';
  return 'unknown';
}

export function unreadStudentReplies(threads, readAt) {
  return threads.flatMap((thread) => thread.replies || []).filter((reply) =>
    !reply.deleted && reply.role === 'student' && Date.parse(reply.createdAt) > (Date.parse(readAt) || 0)
  ).length;
}

export function aggregateLessonRecords(records) {
  const bins = new Map();
  for (const record of records) {
    const key = record.bucket;
    if (!key) continue;
    if (!bins.has(key)) bins.set(key, { label: key, added: 0, removed: 0, records: [] });
    const bin = bins.get(key);
    bin.added += record.charsAdded || 0;
    bin.removed += record.charsRemoved || 0;
    bin.records.push(record);
  }
  return [...bins.values()];
}

function csvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet programs must treat exported names, notes and comments as text.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createSummaryCsv(students, { keywords, threads, memos, matched, readOnly = false, live = false, keywordsKnown = !readOnly }) {
  const rows = [['출석번호', '이름 또는 가명', '추가 글자', '슬라이드', '추가 이미지', '사용 키워드', '전체 키워드 수', '교사 피드백', '학생 답장', '교사 메모']];
  if (readOnly) rows[0].push('기타·미확인 작성자 글', '저장 확인 시각', '자료 구분');
  for (const student of students) {
    const key = student.id ?? student.number;
    const conversations = threads[key] || [];
    const messages = conversations.flatMap((thread) => [thread, ...(thread.replies || [])]);
    rows.push([student.number, student.name, student.chars, student.slides, student.images,
      matched(student).join(', '), keywordsKnown ? keywords.length : '',
      messages.filter((message) => message.role === 'teacher').map((message) => message.content).join('\n'),
      messages.filter((message) => message.role === 'student').map((message) => message.content).join('\n'),
      memos[key] || '']);
    if (readOnly) rows.at(-1).push(messages.filter((message) => !['teacher', 'student'].includes(message.role)).map((message) => message.content).join('\n'), student.checkedAt || '', live ? '실제 저장 기록 · 새 기록 연결' : '기존 저장 기록 · 읽기 전용');
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function createAnalysisExport({ className, assignment, students, keywords, threads, memos, readAt, reviewed, mode, matched }) {
  return {
    schemaVersion: '1.0', exportedAt: new Date().toISOString(), dataKind: 'design_preview_example',
    className, assignment: { name: assignment.name, id: assignment.id || 'custom', keywords, templateBaseline: { chars: 120, slides: 2, images: 1 } },
    definitions: {
      checkedAt: '앱이 상태를 확인한 시각. 학생의 실제 편집 시각이 아님.',
      charDelta: '두 확인 시점의 글자 수 차이. 모든 타이핑이나 편집 횟수를 의미하지 않음.',
      continuous_poll: '동일한 수집 세션에서 연속으로 확인한 변화.',
      gap_comparison: '연속 수집하지 못한 두 시점 사이의 차이. 실제 작성 시점은 알 수 없음.',
      null: '확인할 수 없는 값. 0과 구분.',
      template: '추가 글자·이미지는 기본 템플릿 분량을 제외. 슬라이드는 현재 전체 장수.',
      warnings: '텍스트 급증은 확인 필요 표시이며 붙여넣기 판정이 아님.',
      replies: '교사 작성 글과 학생 답장, 작성자 확인 불가를 구분. 다른 작성자를 자동으로 학생이라고 단정하지 않음.',
    },
    collection: { mode, backgroundCollection: false, completeHistory: false },
    averages: { chars: students.reduce((sum, s) => sum + s.chars, 0) / students.length,
      slides: students.reduce((sum, s) => sum + s.slides, 0) / students.length,
      images: students.reduce((sum, s) => sum + s.images, 0) / students.length },
    students: students.map((student) => ({ number: student.number, name: student.name,
      current: { chars: student.chars, slides: student.slides, addedSlides: Math.max(0, student.slides - 2), images: student.images, keywordsUsed: matched(student) },
      records: mode === 'lesson' ? student.lessonRecords : student.projectRecords,
      conversations: threads[student.number] || [], teacherMemo: memos[student.number] || '',
      feedbackReadAt: readAt[student.number] || null, surgeReviewed: reviewed.includes(student.number),
    })),
  };
}
