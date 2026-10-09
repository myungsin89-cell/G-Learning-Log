import { EVENT_HEADERS, eventRow, parseWorkspaceEvents } from './liveWorkRecords.mjs';
import { adaptDriveComments } from './storedWorkRecords.mjs';

export const WORKSPACE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.file'];
const mimeType = 'application/vnd.google-apps.spreadsheet';
const marker = 'teacher-workspace-v2';
const fields = 'id,name,mimeType,ownedByMe,appProperties,permissions(type,role)';
const commentFields = 'id,content,createdTime,resolved,author(displayName,me,permissionId),replies(id,content,createdTime,author(displayName,me,permissionId))';

export function createGoogleWorkspace(accessToken, assignment, students, fetcher = globalThis.fetch) {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'readonly') throw new Error('이 배포는 읽기 전용입니다. 저장 기능을 사용할 수 없습니다.');
  if (!accessToken || !assignment?.id) throw new Error('저장 연결과 원본 과제 ID가 필요합니다.');
  const allowedSlides = new Set(students.map((student) => student.slideId).filter(Boolean));
  let storeId = null, queue = Promise.resolve();
  const locked = (action) => { const next = queue.then(action); queue = next.catch(() => {}); return next; };
  async function request(service, path, { method = 'GET', body, params = [] } = {}) {
    const url = new URL(path, service === 'drive' ? 'https://www.googleapis.com/drive/v3/' : 'https://sheets.googleapis.com/v4/');
    for (const [key, value] of params) if (value != null) url.searchParams.append(key, value);
    const response = await fetcher(url.toString(), { method, cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? '저장 연결 로그인이 만료됐습니다. 다시 연결해 주세요.' : response.status === 403 ? '이 파일에 쓸 수 없습니다. 앱에서 만든 슬라이드인지, Google에서 파일 편집 권한을 허용했는지 확인해 주세요.' : response.status === 429 ? 'Google 요청 한도에 도달했습니다. 잠시 후 수동으로 다시 확인해 주세요.' : '저장을 완료하지 못했습니다. 새로고침으로 저장 여부를 확인한 뒤 다시 시도해 주세요.');
      error.status = response.status; throw error;
    }
    return response.json();
  }
  async function assertPrivate() {
    if (!storeId || storeId === assignment.id || allowedSlides.has(storeId)) throw new Error('원본 자료에는 기록을 저장할 수 없습니다.');
    const file = await request('drive', `files/${encodeURIComponent(storeId)}`, { params: [['fields', fields]] });
    if (file.mimeType !== mimeType || !file.ownedByMe || file.appProperties?.gbaeumStore !== marker || file.appProperties?.sourceSheet !== assignment.id || !file.permissions?.length || file.permissions.some((permission) => permission.role !== 'owner' || permission.type !== 'user')) throw new Error('교사 기록 저장소가 비공개 소유 파일인지 확인할 수 없습니다. 공유 설정을 변경하지 않았으며 저장을 중단했습니다.');
  }
  async function readEvents() {
    const values = await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}/values/${encodeURIComponent("'events'!A:F")}`);
    if (!values.values?.length) throw new Error('교사 저장소의 기록 헤더가 없습니다. 내용을 덮어쓰지 않았습니다.');
    return parseWorkspaceEvents(values.values || []);
  }
  return {
    async initialize() {
      return locked(async () => {
        const files = [];
        let pageToken;
        do {
          const result = await request('drive', 'files', { params: [['q', `mimeType = '${mimeType}' and trashed = false and appProperties has { key='gbaeumStore' and value='${marker}' }`], ['fields', `nextPageToken,files(${fields})`], ['pageSize', '100'], ['pageToken', pageToken]] });
          files.push(...(result.files || []).filter((file) => file.appProperties?.sourceSheet === assignment.id)); pageToken = result.nextPageToken;
        } while (pageToken);
        if (files.length > 1) throw new Error('이 과제의 교사 저장소가 여러 개입니다. 파일을 합치거나 덮어쓰지 않았습니다.');
        if (files.length) storeId = files[0].id;
        else {
          const file = await request('drive', 'files', { method: 'POST', params: [['fields', 'id']], body: { name: `G배움로그_새기록_[${assignment.id}]`, mimeType, appProperties: { gbaeumStore: marker, sourceSheet: assignment.id }, description: `${assignment.name} · 교사 비공개 작업기록과 메모. 학생에게 공유하지 마세요.` } });
          storeId = file.id;
        }
        await assertPrivate();
        const metadata = await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}`, { params: [['fields', 'sheets(properties(title))']] });
        if (!metadata.sheets?.some((sheet) => sheet.properties.title === 'events')) await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}:batchUpdate`, { method: 'POST', body: { requests: [{ addSheet: { properties: { title: 'events' } } }] } });
        const values = await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}/values/${encodeURIComponent("'events'!A:F")}`);
        if (!values.values?.length) await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}/values/${encodeURIComponent("'events'!A1:F1")}`, { method: 'PUT', params: [['valueInputOption', 'RAW']], body: { values: [EVENT_HEADERS] } });
        const parsed = values.values?.length ? parseWorkspaceEvents(values.values) : { events: [], invalidRows: [] };
        return { storeId, ...parsed };
      });
    },
    async load() { return locked(async () => { await assertPrivate(); return { storeId, ...await readEvents() }; }); },
    async append(events) {
      return locked(async () => {
        await assertPrivate();
        const saved = await readEvents(), ids = new Set(saved.events.map((event) => event.id));
        const pending = events.filter((event) => !ids.has(event.id));
        if (!pending.length) return { storeId, ...saved };
        const rows = pending.map(eventRow);
        try {
          await request('sheets', `spreadsheets/${encodeURIComponent(storeId)}/values/${encodeURIComponent("'events'!A:F")}:append`, { method: 'POST', params: [['valueInputOption', 'RAW'], ['insertDataOption', 'INSERT_ROWS']], body: { values: rows } });
        } catch (error) {
          // A lost response must not cause a duplicate write; read back before any retry.
          const confirmed = await readEvents();
          if (!pending.every((event) => confirmed.events.some((item) => item.id === event.id))) throw error;
          return { storeId, ...confirmed };
        }
        return { storeId, ...await readEvents() };
      });
    },
    async feedback(slideId, content, commentId = null) {
      if (!allowedSlides.has(slideId)) throw new Error('현재 과제에 등록된 학생 슬라이드만 피드백을 작성할 수 있습니다.');
      const text = content.trim();
      if (!text || text.length > 2000) throw new Error('피드백은 1~2,000자로 작성해 주세요.');
      const path = `files/${encodeURIComponent(slideId)}/comments${commentId ? `/${encodeURIComponent(commentId)}/replies` : ''}`;
      const response = await request('drive', path, { method: 'POST', params: [['fields', commentId ? 'id,content,createdTime,author(displayName,me,permissionId)' : commentFields]], body: { content: text } });
      return commentId ? response : adaptDriveComments([response])[0];
    },
  };
}
