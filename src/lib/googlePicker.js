'use client';

const MIME = {
  presentation: 'application/vnd.google-apps.presentation',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
};

let pickerLoader = null;

export function googlePickerConfig() {
  const developerKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || '';
  return { developerKey, appId };
}
function loadPicker() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google 파일 선택은 브라우저에서 사용할 수 있습니다.'));
  if (window.google?.picker) return Promise.resolve(window.google.picker);
  if (!window.gapi?.load) return Promise.reject(new Error('Google 파일 선택 모듈이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.'));
  pickerLoader ||= new Promise((resolve, reject) => {
    window.gapi.load('picker', {
      callback: () => window.google?.picker ? resolve(window.google.picker) : reject(new Error('Google 파일 선택 화면을 준비하지 못했습니다.')),
      onerror: () => reject(new Error('Google 파일 선택 화면을 불러오지 못했습니다.')),
      timeout: 12000,
      ontimeout: () => reject(new Error('Google 파일 선택 화면을 불러오는 데 시간이 오래 걸리고 있습니다. 다시 시도해 주세요.')),
    });
  }).catch((error) => { pickerLoader = null; throw error; });
  return pickerLoader;
}

export async function pickGoogleDriveFiles({ accessToken, kind, multiple = false, title }) {
  if (!accessToken) throw new Error('Google 연결이 만료됐습니다. 다시 로그인해 주세요.');
  if (!MIME[kind]) throw new Error('선택할 Google 파일 종류를 확인해 주세요.');
  const { developerKey, appId } = googlePickerConfig();
  if (!developerKey || !appId) throw new Error('Google 파일 선택 설정이 아직 완료되지 않았습니다. 운영자에게 알려 주세요.');
  const picker = await loadPicker();
  return new Promise((resolve, reject) => {
    const view = new picker.DocsView(picker.ViewId.DOCS);
    view.setMimeTypes(MIME[kind]);
    view.setOwnedByMe(true);
    let builder = new picker.PickerBuilder()
      .addView(view)
      .setSelectableMimeTypes(MIME[kind])
      .setOAuthToken(accessToken)
      .setDeveloperKey(developerKey)
      .setAppId(appId)
      .setOrigin(window.location.origin)
      .setLocale('ko')
      .setTitle(title || 'Google Drive에서 파일 선택')
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          const documents = data[picker.Response.DOCUMENTS] || data.docs || [];
          resolve(documents.map((document) => ({
            id: document[picker.Document.ID] || document.id,
            name: document[picker.Document.NAME] || document.name || 'Google 파일',
            mimeType: document[picker.Document.MIME_TYPE] || document.mimeType || MIME[kind],
            url: document[picker.Document.URL] || document.url || '',
          })).filter((document) => document.id));
        } else if (data.action === picker.Action.CANCEL) resolve([]);
        else if (data.action === picker.Action.ERROR) reject(new Error('Google 파일을 선택하지 못했습니다. 다시 시도해 주세요.'));
      });
    if (multiple) builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
}

