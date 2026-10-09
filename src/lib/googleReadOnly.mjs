import { adaptStoredAssignment, adaptDriveComments } from './storedWorkRecords.mjs';
import { adaptPresentation, parsePresentationId } from './slideContents.mjs';
import { parseWorkspaceEvents } from './liveWorkRecords.mjs';

// This module deliberately has no dependency on the legacy writer or gapi token.
export const READ_ONLY_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export function createGoogleReader(accessToken, fetcher = globalThis.fetch) {
  if (!accessToken) throw new Error('Google 로그인이 필요합니다.');
  async function get(service, path, entries = []) {
    const base = service === 'drive' ? 'https://www.googleapis.com/drive/v3/' : service === 'slides' ? 'https://slides.googleapis.com/v1/' : 'https://sheets.googleapis.com/v4/';
    const url = new URL(path, base);
    for (const [key, value] of entries) if (value !== undefined) url.searchParams.append(key, value);
    const response = await fetcher(url.toString(), {
      method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인해 주세요.' : response.status === 403 ? '파일 접근 권한 또는 Drive·Sheets·Slides API 활성화 상태를 확인해 주세요.' : response.status === 404 ? '원본 파일을 찾을 수 없거나 현재 계정에 접근 권한이 없습니다.' : 'Google 데이터를 불러오지 못했습니다. 다시 시도해 주세요.');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function listFiles(q) {
    const files = [];
    let pageToken;
    do {
      const result = await get('drive', 'files', [['q', q], ['fields', 'nextPageToken,files(id,name,createdTime,appProperties)'], ['pageSize', '100'], ['pageToken', pageToken]]);
      files.push(...(result.files || []));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return files;
  }

  return {
    async account() { const data = await get('drive', 'about', [['fields', 'user(permissionId,displayName)']]); return data.user; },
    async loadWorkspace(assignmentId) {
      const files = await listFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and appProperties has { key='gbaeumStore' and value='teacher-workspace-v2' }");
      const found = [];
      for (const file of files) {
        const info = await get('drive', `files/${encodeURIComponent(file.id)}`, [['fields', 'id,ownedByMe,appProperties,permissions(type,role)']]);
        if (info.appProperties?.sourceSheet === assignmentId) found.push(info);
      }
      if (found.length > 1) throw new Error('교사 저장소가 여러 개라 자동으로 선택하지 않았습니다.');
      if (!found.length) return null;
      const info = found[0];
      if (!info.ownedByMe || !info.permissions?.length || info.permissions.some((permission) => permission.role !== 'owner' || permission.type !== 'user')) throw new Error('교사 저장소가 비공개 파일인지 확인할 수 없어 메모를 불러오지 않았습니다.');
      const data = await get('sheets', `spreadsheets/${encodeURIComponent(info.id)}/values/${encodeURIComponent("'events'!A:F")}`);
      if (!data.values?.length) throw new Error('교사 기록 저장소의 헤더가 없습니다. 저장된 메모와 기록을 확인할 수 없어 불러오기를 중단했습니다.');
      return { storeId: info.id, ...parseWorkspaceEvents(data.values || []) };
    },
    async listClasses() {
      const files = await listFiles("(name = 'G배움로그_학급명단_저장소' or name = '슬라이드대시보드_학급명단_저장소') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const classes = [];
      for (const file of files) {
        const metadata = await get('sheets', `spreadsheets/${encodeURIComponent(file.id)}`, [['fields', 'sheets(properties(title))']]);
        for (const sheet of metadata.sheets || []) {
          const name = sheet.properties.title;
          const visible = file.appProperties?.gbaeumStore === 'class-roster-v2' ? name === file.appProperties.className : name !== 'Sheet1' && !name.startsWith('_');
          if (visible) classes.push({ id: `${file.id}:${name}`, name, rosterId: file.id });
        }
      }
      return classes;
    },
    async listAssignments(className) {
      // Filter exact class prefixes locally; a class name never becomes Drive query syntax.
      const files = await listFiles("name contains 'SlideSight_DB_' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const prefix = `SlideSight_DB_[${className}]_[`;
      return files.filter((file) => file.name.startsWith(prefix) && file.name.endsWith(']')).map((file) => ({ id: file.id, name: file.name.slice(prefix.length, -1), createdAt: file.createdTime || null, creationId: file.appProperties?.gbaeumCreation, coverSlideId: file.appProperties?.coverSlide, setupStatus: file.appProperties?.setupStatus, studentEntry: file.appProperties?.entryMode ? { mode: file.appProperties.entryMode, id: file.appProperties.joinSheet } : null }));
    },
    async loadCreationPlan(assignment) {
      if (!assignment.creationId) throw new Error('이 과제의 배부 정보를 찾을 수 없습니다.');
      const result = await get('sheets', `spreadsheets/${encodeURIComponent(assignment.id)}/values/${encodeURIComponent("'_setup'!A1:B2")}`);
      if (result.values?.[0]?.[1] !== assignment.creationId || result.values?.[1]?.[0] !== 'plan_json') throw new Error('과제 생성 정보를 확인할 수 없습니다.');
      return { ...JSON.parse(result.values[1][1]), jobId: assignment.creationId };
    },
    async loadRoster(classItem) {
      const title = String(classItem.name).replaceAll("'", "''");
      const result = await get('sheets', `spreadsheets/${encodeURIComponent(classItem.rosterId)}/values/${encodeURIComponent(`'${title}'!A2:B`)}`);
      return (result.values || []).filter((row) => String(row[1] || '').trim()).map((row, index) => ({
        id: `roster-${index + 2}`, name: String(row[1]).trim(),
        number: /^\d+$/.test(String(row[0] || '').trim()) && Number(row[0]) > 0 ? Number(row[0]) : null,
      }));
    },
    async loadAssignmentSummary(assignment, className) {
      // One Sheets read per assignment; opening this page never reads student presentations.
      const result = await get('sheets', `spreadsheets/${encodeURIComponent(assignment.id)}/values/${encodeURIComponent("'students'!A:O")}`);
      if (!['name', 'student_name'].includes(result.values?.[0]?.[1])) throw new Error('학생 목록을 확인할 수 없습니다.');
      const data = adaptStoredAssignment({ className, assignment, studentRows: result.values, logRows: [], loadedAt: new Date().toISOString() });
      return { studentCount: data.students.length, linkedCount: data.students.filter((student) => student.slideId).length, coverSlideId: data.students.find((student) => student.slideId)?.slideId || null };
    },
    async loadAssignmentCover(assignment) {
      let slideId = parsePresentationId(assignment.coverSlideId), source = 'template';
      if (!slideId && assignment.creationId) {
        const creationId = `${assignment.creationId}:template`.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
        const files = await listFiles(`mimeType = 'application/vnd.google-apps.presentation' and trashed = false and appProperties has { key='gbaeumCreation' and value='${creationId}' }`);
        if (files.length === 1) slideId = parsePresentationId(files[0].id);
      }
      if (!slideId && assignment.creationId) throw new Error('예시 슬라이드 표지를 찾을 수 없습니다.');
      if (!slideId) { slideId = parsePresentationId(assignment.summary?.coverSlideId); source = 'student'; }
      if (!slideId) return null;
      // Only one representative deck, with page IDs only; never poll all student slides.
      const presentation = await get('slides', `presentations/${encodeURIComponent(slideId)}`, [['fields', 'slides(objectId)']]);
      const pageId = presentation.slides?.[0]?.objectId;
      if (!pageId) throw new Error('슬라이드에 표시할 첫 장이 없습니다.');
      const thumbnail = await get('slides', `presentations/${encodeURIComponent(slideId)}/pages/${encodeURIComponent(pageId)}/thumbnail`, [['thumbnailProperties.thumbnailSize', 'MEDIUM']]);
      let url;
      try { url = new URL(thumbnail.contentUrl); } catch { throw new Error('첫 장 이미지를 불러오지 못했습니다.'); }
      if (url.protocol !== 'https:' || !Number.isFinite(thumbnail.width) || !Number.isFinite(thumbnail.height) || thumbnail.width <= 0 || thumbnail.height <= 0) throw new Error('첫 장 이미지를 불러오지 못했습니다.');
      return { url: url.href, width: thumbnail.width, height: thumbnail.height, source };
    },
    async loadAssignment(assignment, className) {
      const metadata = await get('sheets', `spreadsheets/${encodeURIComponent(assignment.id)}`, [['fields', 'sheets(properties(title))']]);
      const titles = (metadata.sheets || []).map((sheet) => sheet.properties.title);
      if (!titles.includes('students')) throw new Error('학생 데이터 탭(students)이 없는 과제입니다. 원본을 변경하지 않았습니다.');
      const ranges = ['students', ...(titles.includes('activity_logs') ? ['activity_logs'] : [])];
      const data = await get('sheets', `spreadsheets/${encodeURIComponent(assignment.id)}/values:batchGet`, ranges.map((title) => ['ranges', `'${title}'`]));
      return adaptStoredAssignment({ className, assignment, studentRows: data.valueRanges?.[0]?.values || [], logRows: data.valueRanges?.[1]?.values || [], loadedAt: new Date().toISOString() });
    },
    async loadComments(slideId) {
      const comments = [];
      let pageToken;
      do {
        const data = await get('drive', `files/${encodeURIComponent(slideId)}/comments`, [
          ['fields', 'nextPageToken,comments(id,content,createdTime,deleted,resolved,author(displayName,me,permissionId),replies(id,content,createdTime,deleted,author(displayName,me,permissionId)))'],
          ['pageSize', '100'], ['includeDeleted', 'false'], ['pageToken', pageToken],
        ]);
        comments.push(...(data.comments || []));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return adaptDriveComments(comments);
    },
    async loadPresentation(slideId) {
      const presentation = await get('slides', `presentations/${encodeURIComponent(slideId)}`);
      return adaptPresentation(presentation, new Date().toISOString());
    },
  };
}
