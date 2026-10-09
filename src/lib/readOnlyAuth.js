import { READ_ONLY_SCOPES } from './googleReadOnly.mjs';
import { WORKSPACE_SCOPES } from './googleWorkspace.mjs';

const CONFIG_KEY = 'gbaeum_readonly_client_id';
// Tokens stay in memory and never overwrite slidesight_access_token.
let session = null;
let workspaceSession = null;
export function readOnlyClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID || (typeof window !== 'undefined' ? localStorage.getItem(CONFIG_KEY) : '') || '';
}
export function saveReadOnlyClientId(value) {
  const id = value.trim();
  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id)) throw new Error('웹 애플리케이션 OAuth 클라이언트 ID를 입력해 주세요.');
  localStorage.setItem(CONFIG_KEY, id);
}
export function clearReadOnlySession() { session = null; workspaceSession = null; }
export function clearWorkspaceSession() { workspaceSession = null; }
export function currentReadOnlySession() {
  return session?.expiresAt > Date.now() + 30000 ? session : null;
}
export function currentWorkspaceSession() { return workspaceSession?.expiresAt > Date.now() + 30000 ? workspaceSession : null; }
export function adoptWorkspaceSession() { if (currentWorkspaceSession()) session = workspaceSession; }
export function signInReadOnly() { return requestSession(READ_ONLY_SCOPES, false); }
export function signInWorkspace() { return requestSession(WORKSPACE_SCOPES, true); }
export function signInClassroom() { return requestSession([...WORKSPACE_SCOPES, 'https://www.googleapis.com/auth/drive'], true); }
function requestSession(scopes, writable) {
  return new Promise((resolve, reject) => {
    const clientId = readOnlyClientId();
    if (!clientId) { reject(new Error('Google 연결 설정에서 OAuth 클라이언트 ID를 등록해 주세요.')); return; }
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) { reject(new Error('Google 로그인 모듈이 아직 준비되지 않았습니다. 잠시 후 다시 눌러 주세요.')); return; }
    const client = oauth.initTokenClient({
      client_id: clientId, scope: scopes.join(' '), include_granted_scopes: false,
      callback(response) {
        if (response.error || !response.access_token) { reject(new Error('Google 로그인을 완료하지 못했습니다.')); return; }
        if (!oauth.hasGrantedAllScopes(response, ...scopes)) { reject(new Error(writable ? '파일 읽기와 앱에서 사용하는 파일의 편집 권한을 모두 허용해 주세요.' : 'Drive와 Sheets의 읽기 권한을 모두 허용해 주세요.')); return; }
        const result = { accessToken: response.access_token, expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000, scopes: [...scopes] };
        if (writable) workspaceSession = result; else { session = result; workspaceSession = null; }
        resolve(result);
      },
      error_callback() { reject(new Error('로그인 창이 닫혔거나 열리지 않았습니다. 다시 로그인해 주세요.')); },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
