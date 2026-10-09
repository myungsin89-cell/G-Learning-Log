import { parseRosterInput } from './workRecords.mjs';
import { parsePresentationId, adaptPresentation } from './slideContents.mjs';
import { createGoogleWorkspace } from './googleWorkspace.mjs';
import { foldWorkspace } from './liveWorkRecords.mjs';
import { JOIN_HEADERS } from './studentEntry.mjs';

const studentHeaders = ['student_number', 'student_name', 'slide_id', 'slide_url', 'status', 'last_active_at', 'current_char_count', 'current_slide_count', 'image_count', 'keyword_count', 'keywords_used', 'blank_slide_count', 'focus_ratio', 'teacher_feedback', 'last_checked_at', 'share_status'];
const logHeaders = ['student_name', 'timestamp', 'char_count', 'slide_count', 'image_count', 'keyword_count', 'copied_text', 'record_source', 'previous_checked_at', 'student_number', 'char_delta', 'image_delta', 'slide_delta'];
const quote = (text) => String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const range = (title) => `'${title.replaceAll("'", "''")}'`;
export function classroomName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 80 || /[\[\]\\/:?*\r\n]/.test(name)) throw new Error('이름은 1~80자로 입력하고 [ ] / \\ : ? * 문자와 줄바꿈은 제외해 주세요.');
  return name;
}
export function classroomKeywords(value) { return [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,\n]/)).map((word) => String(word).trim()).filter(Boolean))]; }

// Only new files bearing this creation ID may be changed. Original rosters,
// assignment sheets and the source template never enter the write path.
export function createGoogleClassroom(accessToken, fetcher = globalThis.fetch) {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'readonly') throw new Error('이 배포는 읽기 전용입니다.');
  if (!accessToken) throw new Error('Google 저장 권한을 연결해 주세요.');
  async function request(service, path, { method = 'GET', body, params = [] } = {}) {
    const base = service === 'drive' ? 'https://www.googleapis.com/drive/v3/' : service === 'slides' ? 'https://slides.googleapis.com/v1/' : 'https://sheets.googleapis.com/v4/';
    const url = new URL(path, base);
    for (const [key, value] of params) url.searchParams.append(key, value);
    const response = await fetcher(url.toString(), { method, cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인하고 재시도해 주세요.' : response.status === 403 ? 'Google 파일 생성·복사·공유 권한을 확인해 주세요. 학교 계정의 공유 정책에 따라 제한될 수 있습니다.' : 'Google 저장을 완료하지 못했습니다. 완료된 파일은 유지합니다. 다시 시도해 주세요.');
    return response.status === 204 ? {} : response.json();
  }
  async function find(jobId) {
    const result = await request('drive', 'files', { params: [['q', `trashed = false and appProperties has { key='gbaeumCreation' and value='${quote(jobId)}' }`], ['fields', 'files(id,name,mimeType,appProperties)']] });
    if (result.files?.length > 1) throw new Error('같은 생성 기록의 파일이 여러 개입니다. 자동으로 합치거나 덮어쓰지 않았습니다.');
    return result.files?.[0] || null;
  }
  async function ensureFile(jobId, name, kind, source = null, extraProperties = {}) {
    const known = await find(jobId);
    if (known) return known;
    const body = { name, appProperties: { ...extraProperties, gbaeumCreation: jobId, gbaeumStore: kind, ...(kind === 'classroom-assignment-v2' ? { setupStatus: 'creating' } : {}) }, ...(source ? {} : { mimeType: 'application/vnd.google-apps.spreadsheet' }) };
    try { return await request('drive', source ? `files/${encodeURIComponent(source)}/copy` : 'files', { method: 'POST', body, params: [['fields', 'id,name,mimeType,appProperties'], ['ignoreDefaultVisibility', 'true']] }); }
    catch (err) { const recovered = await find(jobId); if (recovered) return recovered; throw err; }
  }
  async function assertJob(fileId, jobId, kind) {
    const file = await request('drive', `files/${encodeURIComponent(fileId)}`, { params: [['fields', 'id,ownedByMe,appProperties,permissions(type,role)']] });
    if (!file.ownedByMe || file.appProperties?.gbaeumCreation !== jobId || file.appProperties?.gbaeumStore !== kind) throw new Error('이번에 생성한 파일인지 확인하지 못해 변경하지 않았습니다.');
    const approved = (permission) => (permission.type === 'user' && permission.role === 'owner') || (kind === 'student-join-v2' && permission.type === 'anyone' && permission.role === 'reader');
    if (kind !== 'student-copy-v2' && (!file.permissions?.length || file.permissions.some((permission) => !approved(permission)))) throw new Error('명단과 교사 기록은 비공개 시트에만 저장할 수 있습니다.');
    return file;
  }
  async function tabs(fileId, names) {
    const metadata = await request('sheets', `spreadsheets/${encodeURIComponent(fileId)}`, { params: [['fields', 'sheets(properties(title))']] });
    const existing = new Set((metadata.sheets || []).map((sheet) => sheet.properties.title));
    const missing = names.filter((name) => !existing.has(name));
    if (missing.length) await request('sheets', `spreadsheets/${encodeURIComponent(fileId)}:batchUpdate`, { method: 'POST', body: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) } });
    return [...existing, ...missing];
  }
  const read = async (id, address) => (await request('sheets', `spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(address)}`)).values || [];
  const write = (id, address, values) => request('sheets', `spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(address)}`, { method: 'PUT', params: [['valueInputOption', 'RAW']], body: { values } });
  async function plan(file, jobId, kind, value, titles) {
    await assertJob(file.id, jobId, kind); await tabs(file.id, [...titles, '_setup']);
    const saved = await read(file.id, "'_setup'!A1:B2");
    if (saved.length && (saved[0]?.[0] !== 'creation_id' || saved[0]?.[1] !== jobId || saved[1]?.[1] !== JSON.stringify(value))) throw new Error('진행 중인 생성 정보와 입력 내용이 다릅니다. 원래 입력으로 배부를 이어서 진행해 주세요.');
    if (!saved.length) await write(file.id, "'_setup'!A1:B2", [['creation_id', jobId], ['plan_json', JSON.stringify(value)]]);
  }
  async function studentEntry({ assignment, className, students, jobId, onProgress = () => {} }) {
    if (!assignment?.id || !jobId || !students.length) throw new Error('학생 접속 링크를 만들 과제와 명단이 필요합니다.');
    parseRosterInput(students.map((student) => `${student.number} ${student.name}`).join('\n'));
    onProgress('공통 학생 접속 링크 만드는 중…');
    const file = await ensureFile(jobId, `G배움로그_학생접속_[${className}]_[${assignment.name}]`, 'student-join-v2');
    await assertJob(file.id, jobId, 'student-join-v2');
    const titles = await tabs(file.id, ['students']);
    for (const title of titles.filter((title) => title !== 'students')) {
      if ((await read(file.id, `${range(title)}!A:Z`)).some((row) => row.some((cell) => cell !== ''))) throw new Error('학생 접속용 시트의 다른 탭에 내용이 있어 공유하지 않았습니다.');
    }
    // This public file contains only the student picker. Never copy logs,
    // teacher feedback, settings or private notes into this sheet.
    const old = await read(file.id, "'students'!A:Z");
    if (old.length && (JSON.stringify(old[0]) !== JSON.stringify(JOIN_HEADERS) || old.some((row) => row.slice(5).some((cell) => cell !== '')))) throw new Error('학생 접속용 시트에 다른 내용이 있어 공유나 덮어쓰기를 중단했습니다.');
    await write(file.id, "'students'!A1:E" + (students.length + 1), [JOIN_HEADERS, ...students.map((student) => [student.number, student.name, student.slideId || '', className, assignment.name])]);
    const permissions = await request('drive', `files/${encodeURIComponent(file.id)}/permissions`, { params: [['fields', 'permissions(type,role)']] });
    if (!permissions.permissions?.some((permission) => permission.type === 'anyone' && permission.role === 'reader')) await request('drive', `files/${encodeURIComponent(file.id)}/permissions`, { method: 'POST', body: { type: 'anyone', role: 'reader', allowFileDiscovery: false } });
    const workspace = createGoogleWorkspace(accessToken, assignment, students, fetcher);
    const saved = await workspace.initialize();
    const entry = { id: file.id, mode: 'shared' };
    if (JSON.stringify(foldWorkspace(saved.events).settings.studentEntry) !== JSON.stringify(entry)) await workspace.append([{ id: crypto.randomUUID(), type: 'settings', studentId: '', createdAt: new Date().toISOString(), payload: { studentEntry: entry } }]);
    return entry;
  }
  return {
    createStudentEntry: studentEntry,
    async createClass({ name: inputName, rosterText, jobId, onProgress = () => {} }) {
      if (!jobId || typeof jobId !== 'string') throw new Error('생성 식별자가 필요합니다.');
      const name = classroomName(inputName), students = parseRosterInput(rosterText);
      if (name === 'Sheet1' || name.startsWith('_')) throw new Error('학급 이름에는 Sheet1이나 _로 시작하는 이름을 사용할 수 없습니다.');
      onProgress('학급 명단 시트 만드는 중…');
      const file = await ensureFile(jobId, 'G배움로그_학급명단_저장소', 'class-roster-v2', null, { className: name });
      await plan(file, jobId, 'class-roster-v2', { name, students }, [name]);
      await write(file.id, `${range(name)}!A1:B${students.length + 1}`, [['student_number', 'student_name'], ...students.map((student) => [student.number, student.name])]);
      return { id: `${file.id}:${name}`, name, rosterId: file.id };
    },
    async createAssignment({ className: inputClass, name: inputName, templateUrl, roster, keywords: inputKeywords, keywordsText = '', shareSlides = true, entryMode = 'shared', jobId, onProgress = () => {} }) {
      if (!jobId || typeof jobId !== 'string') throw new Error('생성 식별자가 필요합니다.');
      const className = classroomName(inputClass), name = classroomName(inputName);
      const students = parseRosterInput(roster.map((student) => `${student.number} ${student.name}`).join('\n'));
      const templateId = parsePresentationId(templateUrl);
      if (!templateId) throw new Error('올바른 Google 슬라이드 템플릿 주소를 입력해 주세요.');
      const keywords = classroomKeywords(inputKeywords ?? keywordsText);
      onProgress('슬라이드 템플릿 확인 중…');
      const template = await request('drive', `files/${encodeURIComponent(templateId)}`, { params: [['fields', 'id,mimeType,capabilities(canCopy)']] });
      if (template.mimeType !== 'application/vnd.google-apps.presentation' || template.capabilities?.canCopy === false) throw new Error('복사할 수 있는 Google 슬라이드 템플릿을 선택해 주세요.');
      const file = await ensureFile(jobId, `SlideSight_DB_[${className}]_[${name}]`, 'classroom-assignment-v2');
      if (!['shared', 'individual'].includes(entryMode)) throw new Error('학생 접속 방식을 확인해 주세요.');
      const value = { className, name, templateUrl: templateId, roster: students, keywordsText: keywords.join(', '), ...(Array.isArray(inputKeywords) ? { keywords } : {}), shareSlides, entryMode };
      await plan(file, jobId, 'classroom-assignment-v2', value, ['students', 'activity_logs']);
      // Freeze the template once so a resumed distribution uses the same basis.
      const frozen = await ensureFile(`${jobId}:template`, `${name} · 배부 원본`, 'assignment-template-v2', templateId);
      await assertJob(frozen.id, `${jobId}:template`, 'assignment-template-v2');
      const baseline = adaptPresentation(await request('slides', `presentations/${encodeURIComponent(frozen.id)}`), new Date().toISOString());
      const oldRows = await read(file.id, "'students'!A:P");
      if (oldRows.length && JSON.stringify(oldRows[0]) !== JSON.stringify(studentHeaders)) throw new Error('새 과제의 학생 탭 형식이 달라 변경하지 않았습니다.');
      if (!oldRows.length) await write(file.id, "'students'!A1:P" + (students.length + 1), [studentHeaders, ...students.map((student) => [student.number, student.name, '', '', 'unstarted', '', 0, baseline.slideCount, 0, 0, '', 0, '', '', '', 'pending'])]);
      const logs = await read(file.id, "'activity_logs'!A1:M2");
      if (logs.length && JSON.stringify(logs[0]) !== JSON.stringify(logHeaders)) throw new Error('새 과제의 기록 탭 형식이 달라 변경하지 않았습니다.');
      if (!logs.length) await write(file.id, "'activity_logs'!A1:M2", [logHeaders, ['SYSTEM_BASELINE', baseline.checkedAt, baseline.charCount, baseline.slideCount, baseline.imageCount, 0, 'TEMPLATE_BASELINE']]);
      const savedStudents = [], warnings = [];
      for (let index = 0; index < students.length; index++) {
        const student = students[index]; onProgress(`${index + 1} / ${students.length}명 · ${student.number}번 ${student.name} 배부 중…`);
        const copyJob = `${jobId}:${student.number}`;
        const copy = await ensureFile(copyJob, `[${student.number}번 ${student.name}] ${name}`, 'student-copy-v2', frozen.id);
        await assertJob(copy.id, copyJob, 'student-copy-v2');
        let shared = 'private';
        if (shareSlides) {
          try {
            const permissions = await request('drive', `files/${encodeURIComponent(copy.id)}/permissions`, { params: [['fields', 'permissions(type,role)']] });
            if (!permissions.permissions?.some((permission) => permission.type === 'anyone' && permission.role === 'writer')) await request('drive', `files/${encodeURIComponent(copy.id)}/permissions`, { method: 'POST', body: { type: 'anyone', role: 'writer', allowFileDiscovery: false } });
            shared = 'link-editor';
          } catch (err) { shared = 'sharing-failed'; warnings.push(`${student.number}번 ${student.name}: ${err.message}`); }
        }
        const slideUrl = `https://docs.google.com/presentation/d/${encodeURIComponent(copy.id)}/edit`;
        const row = oldRows[index + 1] ? [...oldRows[index + 1]] : [student.number, student.name, '', '', 'unstarted', '', 0, baseline.slideCount, 0, 0, '', 0, '', '', '', 'pending'];
        if (Number(row[0]) !== student.number || row[1] !== student.name || (row[2] && row[2] !== copy.id)) throw new Error('학생 연결 정보가 달라 기존 값을 유지하고 중단했습니다.');
        row[2] = copy.id; row[3] = slideUrl; row[15] = shared;
        await write(file.id, `'students'!A${index + 2}:P${index + 2}`, [row]);
        savedStudents.push({ ...student, slideId: copy.id, slideUrl });
      }
      onProgress('핵심 키워드와 과제 설정을 시트에 저장 중…');
      const assignment = { id: file.id, name };
      const workspace = createGoogleWorkspace(accessToken, assignment, savedStudents, fetcher);
      await workspace.initialize();
      await workspace.append([{ id: `${jobId}:keywords`, type: 'settings', studentId: '', createdAt: new Date().toISOString(), payload: { keywords } }]);
      let entry = { mode: 'individual' };
      if (entryMode === 'shared') {
        try { entry = await studentEntry({ assignment, className, students: savedStudents, jobId: `join:${assignment.id}`, onProgress }); }
        catch (err) { warnings.push(`공통 학생 접속 링크: ${err.message}`); entry = { mode: 'shared', pending: true }; }
      }
      await request('drive', `files/${encodeURIComponent(file.id)}`, { method: 'PATCH', body: { appProperties: { setupStatus: warnings.length ? 'needs-sharing' : 'ready', coverSlide: frozen.id, entryMode, ...(entry.id ? { joinSheet: entry.id } : {}) } } });
      Object.assign(assignment, { studentEntry: entry });
      return { assignment, students: savedStudents, warnings };
    },
  };
}
