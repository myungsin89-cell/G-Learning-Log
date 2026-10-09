import { authorRole } from './workRecords.mjs';
import { parsePresentationId } from './slideContents.mjs';

const numeric = (value) => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const stamp = (value) => value && Number.isFinite(Date.parse(value)) ? value : null;
export const studentKey = (student) => student.id ?? student.number;
export const formatAmount = (value) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';
export const formatCheckedAt = (value) => stamp(value) ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '확인 시각 미기록';

// Project the same history used in the detail drawer onto the student card.
// Stored counts remain counts: old rows never become inferred change intervals.
export function summarizeStudentCard(student) {
  const records = [...(student.records || [])].sort((a, b) => (Date.parse(a.checkedAt) || 0) - (Date.parse(b.checkedAt) || 0));
  const latest = records.at(-1);
  let recent = '저장된 작업 기록 없음';
  let comparisonLabel = null;
  if (latest?.source === 'legacy_unverified') {
    recent = '최근 변화량 미확인';
  } else if (latest?.source === 'first_snapshot') {
    recent = '최근 확인 완료';
  } else if (latest && ['continuous_poll', 'gap_comparison'].includes(latest.source) && stamp(latest.previousCheckedAt) && stamp(latest.checkedAt) && Date.parse(latest.checkedAt) > Date.parse(latest.previousCheckedAt)) {
    comparisonLabel = `${formatCheckedAt(latest.previousCheckedAt)} → ${formatCheckedAt(latest.checkedAt)} 확인 사이`;
    const changes = [['charDelta', '글자', '자'], ['imageDelta', '이미지', '개'], ['slideDelta', '슬라이드', '장']]
      .filter(([key]) => Number.isFinite(latest[key]) && latest[key] !== 0)
      .map(([key, label, unit]) => `${label} ${latest[key] > 0 ? '+' : ''}${formatAmount(latest[key])}${unit}`);
    recent = changes.length ? `최근 변화 · ${changes.join(' · ')}` : latest.charDelta === 0 && latest.imageDelta === 0 && latest.slideDelta === 0 ? '최근 변화 · 변화 없음' : '최근 변화량 미확인';
  } else if (latest) {
    recent = '최근 변화량 미확인';
  }
  return { recordCount: records.length, historyLabel: records.length ? `작업 기록 ${records.length}개` : '저장 기록 없음', recent, comparisonLabel,
    latestRecordedAt: latest?.checkedAt || null, checkedAt: student.checkedAt || latest?.checkedAt || null,
    wholeChars: student.currentCounts?.charCount ?? null };
}

// Legacy rows contain stored amounts, not verified edit deltas. Keep their
// values and source intact; the daily view uses the day's last stored row.
export function storedHistoryBins(records, metric = 'charCount', grouping = 'day') {
  if (!['charCount', 'imageCount', 'slideCount'].includes(metric)) throw new Error('알 수 없는 기록 수치입니다.');
  const dated = records.filter((record) => record.source === 'legacy_unverified' && stamp(record.checkedAt))
    .slice().sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
  const dates = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const groups = new Map();
  dated.forEach((record, index) => {
    const date = dates.format(new Date(record.checkedAt));
    const id = grouping === 'day' ? `stored-day:${date}` : `stored-record:${record.id || index}`;
    if (!groups.has(id)) groups.set(id, { id, label: grouping === 'day' ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : formatCheckedAt(record.checkedAt), records: [] });
    groups.get(id).records.push(record);
  });
  return [...groups.values()].map((bin) => {
    const latest = bin.records.at(-1);
    return { ...bin, checkedAt: latest.checkedAt, value: Number.isFinite(latest[metric]) && latest[metric] >= 0 ? latest[metric] : null };
  });
}

export function adaptStoredAssignment({ className, assignment, studentRows, logRows, loadedAt }) {
  const studentHeaders = studentRows[0] || [];
  const logHeaders = logRows[0] || [];
  const rows = studentRows.slice(1);
  const history = logRows.slice(1);
  const baselineRow = history.findLast((row) => row[0] === 'SYSTEM_BASELINE');
  const baseline = baselineRow ? { chars: numeric(baselineRow[2]), slides: numeric(baselineRow[3]), images: numeric(baselineRow[4]), recordedAt: stamp(baselineRow[1]) } : null;
  const names = new Map();
  const numbers = new Map();
  for (const row of rows) if (row[1]) names.set(row[1], (names.get(row[1]) || 0) + 1);
  for (const row of rows) if (numeric(row[0]) !== null) numbers.set(numeric(row[0]), (numbers.get(numeric(row[0])) || 0) + 1);
  const valueAt = (row, header) => {
    const index = logHeaders.indexOf(header);
    return index < 0 ? null : row[index];
  };
  const usedRows = new Set();
  const students = rows.map((row, index) => {
    if (!row.some((value) => value !== '' && value != null)) return null;
    const id = `row-${index + 2}`;
    const number = numeric(row[0]);
    const name = row[1] || '이름 미기록';
    const records = [];
    history.forEach((record, logIndex) => {
      if (record[0] === 'SYSTEM_BASELINE') return;
      const logNumber = numeric(valueAt(record, 'student_number'));
      // Never attach a same-name student's history to multiple students.
      const matches = logNumber !== null ? number !== null && logNumber === number && numbers.get(number) === 1 : record[0] === name && names.get(name) === 1;
      if (!matches) return;
      usedRows.add(logIndex);
      const storedSource = valueAt(record, 'record_source');
      const checkedAt = stamp(record[1]);
      const previousCheckedAt = stamp(valueAt(record, 'previous_checked_at'));
      const duration = Date.parse(checkedAt) - Date.parse(previousCheckedAt);
      const validInterval = checkedAt && previousCheckedAt && duration > 0;
      const source = storedSource === 'first_snapshot' ? 'first_snapshot' : validInterval && ['continuous_poll', 'gap_comparison'].includes(storedSource) ? (storedSource === 'continuous_poll' && duration > 60000 ? 'gap_comparison' : storedSource) : 'legacy_unverified';
      const verified = source === 'continuous_poll' || source === 'gap_comparison';
      records.push({ id: `log-${logIndex + 2}`, source, storedSource: storedSource || null, checkedAt, previousCheckedAt,
        charDelta: verified ? numeric(valueAt(record, 'char_delta')) : null,
        imageDelta: verified ? numeric(valueAt(record, 'image_delta')) : null,
        slideDelta: verified ? numeric(valueAt(record, 'slide_delta')) : null,
        charsAdded: null, charsRemoved: null,
        charCount: numeric(record[2]), imageCount: numeric(record[4]), slideCount: numeric(record[3]),
        raw: [...record],
      });
    });
    const lastCheckedIndex = studentHeaders.indexOf('last_checked_at');
    const checkedAt = lastCheckedIndex < 0 ? null : stamp(row[lastCheckedIndex]);
    const sorted = [...records].sort((a, b) => (Date.parse(a.checkedAt) || 0) - (Date.parse(b.checkedAt) || 0));
    const latest = sorted.at(-1);
    // Old statuses may contain judgements. A saved snapshot never implies live activity.
    const changed = latest?.charDelta != null && (latest.charDelta !== 0 || latest.imageDelta || latest.slideDelta);
    const status = changed ? 'active' : latest?.charDelta === 0 && !latest.imageDelta && !latest.slideDelta ? 'idle' : 'unstarted';
    const slideId = parsePresentationId(row[2], row[3]);
    return { id, number, name, slideId, slideUrl: slideId ? `https://docs.google.com/presentation/d/${encodeURIComponent(slideId)}/edit` : null, shareStatus: studentRows[0]?.[15] === 'share_status' ? row[15] || 'pending' : null,
      chars: numeric(row[6]), slides: numeric(row[7]), images: numeric(row[8]),
      keywordsUsed: String(row[10] || '').split(',').map((word) => word.trim()).filter(Boolean),
      checkedAt, lastActiveAt: stamp(row[5]), status, records: sorted, storedFeedback: row[13] || '', raw: [...row] };
  }).filter(Boolean);
  const keywords = [...new Set(students.flatMap((student) => student.keywordsUsed))];
  const threads = Object.fromEntries(students.map((student) => [student.id, student.storedFeedback ? [{
    id: `${student.id}-stored-feedback`, role: 'unknown', origin: 'stored_feedback', content: student.storedFeedback,
    createdAt: null, replies: [],
  }] : []]));
  return { className, assignment: { ...assignment, keywords, templateBaseline: baseline }, students, keywords, threads, loadedAt,
    rawSource: { studentHeaders: [...studentHeaders], logHeaders: [...logHeaders], studentRows: rows.map((row) => [...row]), logRows: history.map((row) => [...row]) },
    unmatchedRecords: history.filter((row, index) => row[0] !== 'SYSTEM_BASELINE' && !usedRows.has(index)),
  };
}

export function adaptDriveComments(comments) {
  return comments.filter((comment) => !comment.deleted).map((comment) => ({
    id: comment.id, role: authorRole(comment.author), authorName: comment.author?.displayName || null,
    authorId: comment.author?.permissionId || null,
    origin: 'google_slides', content: comment.content || '', createdAt: comment.createdTime || null, resolved: comment.resolved === true,
    replies: (comment.replies || []).filter((reply) => !reply.deleted).map((reply) => ({ id: reply.id,
      role: authorRole(reply.author), authorName: reply.author?.displayName || null,
      authorId: reply.author?.permissionId || null,
      content: reply.content || '', createdAt: reply.createdTime || null,
    })),
  }));
}

export function createStoredAnalysisExport(data, threads, commentsLoaded, presentations = {}) {
  return {
    schemaVersion: '1.0', dataKind: 'stored_google_records', exportedAt: new Date().toISOString(),
    className: data.className, assignment: data.assignment, loadedAt: data.loadedAt,
    collection: { readOnly: true, liveSlideCollection: false, onDemandSlideReads: true, backgroundCollection: false, completeHistory: false },
    definitions: {
      current: '기존 앱에 저장된 추가 글자·이미지와 전체 슬라이드 장수. 현재 슬라이드를 다시 수집한 값이 아님.',
      checkedAt: '앱이 확인한 시각. 학생의 실제 편집 시각이 아님. 미기록 값은 null.',
      charDelta: '저장된 두 확인 시점 사이의 순차이. 모든 타이핑·추가·삭제 횟수가 아님.',
      legacy_unverified: '과거 추정 기록이 섞일 수 있음. 확인된 작업 시점이나 꾸준함의 근거로 사용하지 않음.',
      keywords: '저장된 사용 키워드만 포함. 전체 과제 키워드 목록은 기존 브라우저에만 있을 수 있음.',
      comments: '열어 본 학생의 댓글만 조회. other/unknown 작성자를 학생으로 단정하지 않음.',
      slideContents: '학생 상세를 열거나 내용 새로고침을 누른 시점의 슬라이드 본문·노트와 수치. 기본 템플릿을 포함한 전체 수치이며 저장된 추가량이나 작업 이력이 아님. 미조회 학생은 null.',
      teacherMemo: '이번 읽기 전용 연결에는 비공개 메모 저장소를 연결하지 않음.',
    },
    students: data.students.map((student) => ({ ...student, conversations: threads[student.id] || [], commentsLoaded: commentsLoaded.includes(student.id), currentPresentation: presentations[student.id]?.data || null })),
    unmatchedRecords: data.unmatchedRecords, rawSource: data.rawSource,
  };
}
