export const previewAssignments = [
  { id: 'climate', name: '기후 위기, 우리가 바꿀 수 있는 것', subject: '사회', date: '2026. 10. 08.', closed: false, students: 24, keywords: ['기후 변화', '탄소 중립', '실천'], theme: 'earth', subtitle: '우리의 작은 실천이 만드는 변화' },
  { id: 'book', name: '내가 추천하는 책 한 권', subject: '국어', date: '2026. 10. 02.', closed: true, students: 24, keywords: ['인물', '추천 이유', '인상 깊은 장면'], theme: 'book', subtitle: '함께 읽고 싶은 이야기를 소개해요' },
  { id: 'town', name: '우리 동네를 소개합니다', subject: '사회', date: '2026. 09. 25.', closed: true, students: 24, keywords: ['지역', '장소', '특징'], theme: 'town', subtitle: '매일 지나던 곳에서 발견한 이야기' },
];

export function createPreviewStudents(count, keywords, roster = null) {
  return Array.from({ length: count }, (_, index) => {
    const number = roster?.[index]?.number || (index < 2 ? index + 1 : index + 2);
    const status = number === 7 ? 'surge' : [2, 9, 15, 21].includes(number) ? 'idle' : [12, 24].includes(number) ? 'unstarted' : 'active';
    const chars = status === 'unstarted' ? 0 : status === 'idle' ? 74 + number * 11 : 240 + ((number * 113) % 800);
    const matchedKeywords = status === 'unstarted' ? [] : keywords.slice(0, number % 4);
    return {
      number, name: roster?.[index]?.name || (number === 4 ? '송명신' : ['달토끼', '별빛', '초록잎', '바다', '햇살', '구름'][index % 6]), status, chars,
      slides: status === 'unstarted' ? 2 : 2 + number % 4,
      images: status === 'unstarted' ? 0 : number % 5,
      matchedKeywords,
      text: `${matchedKeywords.join(', ')}${matchedKeywords.length ? '에 대해 조사하고 ' : ''}자료에서 알게 된 내용을 정리했습니다. 우리 생활과 어떤 관련이 있는지 살펴보고, 친구들과 나누고 싶은 생각을 적었습니다.`,
      lessonRecords: createLessonRecords(number, chars, status),
      projectRecords: createProjectRecords(number, chars),
      updated: status === 'unstarted' ? '첫 기록 확인' : status === 'idle' ? '지난 확인 이후 변화 없음' : '변경 감지 · 1분 전',
    };
  });
}

function createLessonRecords(number, chars, status) {
  if (!chars) return [{ id: `${number}-first`, source: 'first_snapshot', previousCheckedAt: null, checkedAt: '2026-10-08T12:00:00+09:00', charDelta: null, charsAdded: null, charsRemoved: null }];
  const weights = status === 'idle' ? [.15, .25, .3, .2, .1, 0] : [.08, .17, .22, .18, .15, .2];
  const beforeSurge = status === 'surge' ? chars - 286 : chars;
  const targets = weights.map((_, i) => Math.round(beforeSurge * weights.slice(0, i + 1).reduce((a, b) => a + b, 0)));
  let count = 0;
  return Array.from({ length: 288 }, (_, index) => {
    const bin = Math.floor(index / 48);
    const startCount = bin ? targets[bin - 1] : 0;
    let next = startCount + Math.round((targets[bin] - startCount) * ((index % 48 + 1) / 48));
    if (status === 'surge' && index === 286) next = beforeSurge;
    if (status === 'surge' && index === 287) next += 286;
    const charsRemoved = index === 120 ? 40 : 0;
    const charsAdded = next - count + charsRemoved;
    const previousCheckedAt = new Date(Date.parse('2026-10-08T10:00:00+09:00') + index * 25000).toISOString();
    const checkedAt = new Date(Date.parse(previousCheckedAt) + 25000).toISOString();
    const record = { id: `${number}-lesson-${index}`, source: 'continuous_poll', previousCheckedAt, checkedAt,
      bucket: ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40'][bin],
      charDelta: next - count, charsAdded, charsRemoved, imageDelta: index === 170 ? number % 5 : 0, slideDelta: index === 220 ? number % 4 : 0, charCount: next };
    count = next;
    return record;
  });
}

function createProjectRecords(number, chars) {
  if (!chars) return [{ id: `${number}-project-first`, source: 'first_snapshot', previousCheckedAt: null, checkedAt: '2026-10-08T12:00:00+09:00', charDelta: null, charsAdded: null, charsRemoved: null }];
  const dates = ['2026-09-20', '2026-09-23', '2026-09-26', '2026-09-29', '2026-10-02', '2026-10-05', '2026-10-08'];
  const weights = number % 2 ? [.12, .18, .16, .22, .12, .2] : [0, .08, 0, .12, .2, .6];
  let count = 0;
  return weights.map((weight, index) => {
    const next = Math.round(chars * weights.slice(0, index + 1).reduce((a, b) => a + b, 0));
    const record = { id: `${number}-project-${index}`, source: 'gap_comparison', previousCheckedAt: `${dates[index]}T12:00:00+09:00`, checkedAt: `${dates[index + 1]}T12:00:00+09:00`, charDelta: next - count, charsAdded: null, charsRemoved: null, charCount: next, imageDelta: index === 4 ? number % 5 : 0, slideDelta: index === 3 ? number % 4 : 0 };
    count = next;
    return record;
  });
}

export function createPreviewConversations(students) {
  return Object.fromEntries(students.map((student) => [student.number, student.chars ? [{
    id: `thread-${student.number}`, role: 'teacher', origin: 'google_slides', content: '조사한 내용을 잘 정리했어요. 자신의 생각과 연결한 설명을 한 가지 더 적어볼까요?', createdAt: '2026-10-08T11:30:00+09:00',
    replies: [{ id: `teacher-reply-${student.number}`, role: 'teacher', content: '자료의 출처도 함께 남겨주세요.', createdAt: '2026-10-08T11:35:00+09:00' },
      ...(student.number % 3 === 1 ? [{ id: `student-reply-${student.number}`, role: 'student', content: '네! 생활 속에서 실천할 수 있는 방법을 추가했어요.', createdAt: '2026-10-08T11:50:00+09:00' }] : [])],
  }] : []]));
}
