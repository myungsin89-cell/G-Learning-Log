import { parsePresentationId } from './slideContents.mjs';

export const JOIN_HEADERS = ['student_number', 'student_name', 'slide_id', 'class_name', 'assignment_name'];
export function studentEntryUrl(origin, id) {
  if (!/^[\w-]+$/.test(id || '')) throw new Error('학생 접속 링크가 아직 준비되지 않았습니다.');
  const url = new URL(`/join/${encodeURIComponent(id)}`, origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('접속 주소를 확인해 주세요.');
  return url.href;
}
export function parseStudentEntry(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('접속 명단을 불러오지 못했습니다. 선생님께 링크를 확인해 주세요.');
  const data = JSON.parse(text.slice(start, end + 1));
  if (data.status === 'error' || !data.table || JSON.stringify(data.table.cols?.map((column) => column.label)) !== JSON.stringify(JOIN_HEADERS)) throw new Error('학생 접속 명단이 준비되지 않았습니다. 선생님께 확인해 주세요.');
  const students = [], seen = new Set();
  for (const row of data.table.rows || []) {
    const [number, name, rawId, className, assignmentName] = (row.c || []).map((cell) => cell?.v ?? '');
    const attendance = Number(number), slideId = parsePresentationId(rawId);
    if (!Number.isSafeInteger(attendance) || attendance < 1 || !String(name).trim() || seen.has(attendance)) throw new Error('학생 명단의 출석번호를 확인해 주세요.');
    seen.add(attendance);
    students.push({ number: attendance, name: String(name).trim(), slideUrl: slideId ? `https://docs.google.com/presentation/d/${encodeURIComponent(slideId)}/edit` : null, className: String(className), assignmentName: String(assignmentName) });
  }
  if (!students.length) throw new Error('배부된 학생이 없습니다. 선생님께 확인해 주세요.');
  return { className: students[0].className, assignmentName: students[0].assignmentName, students: students.sort((a, b) => a.number - b.number) };
}
export async function loadStudentEntry(id, fetcher = globalThis.fetch) {
  if (!/^[\w-]+$/.test(id || '')) throw new Error('학생 접속 주소를 확인해 주세요.');
  const url = new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json'); url.searchParams.set('sheet', 'students'); url.searchParams.set('headers', '1');
  const response = await fetcher(url.href, { method: 'GET', credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error('학생 접속 링크를 열 수 없습니다. 선생님께 공유 상태를 확인해 주세요.');
  return parseStudentEntry(await response.text());
}
