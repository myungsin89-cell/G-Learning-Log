import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { googlePickerConfig, pickGoogleDriveFiles } from '../src/lib/googlePicker.js';

const originalKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const originalAppId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

afterEach(() => {
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  else process.env.NEXT_PUBLIC_GOOGLE_API_KEY = originalKey;
  if (originalAppId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  else process.env.NEXT_PUBLIC_GOOGLE_APP_ID = originalAppId;
});

test('picker reads only its public browser configuration', () => {
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'public-browser-key';
  process.env.NEXT_PUBLIC_GOOGLE_APP_ID = '123456789';
  assert.deepEqual(googlePickerConfig(), { developerKey: 'public-browser-key', appId: '123456789' });
});

test('picker rejects unknown file kinds before opening a window', async () => {
  await assert.rejects(pickGoogleDriveFiles({ accessToken: 'token', kind: 'document' }), /파일 종류/);
});
