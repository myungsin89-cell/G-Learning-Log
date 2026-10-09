import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { JOIN_HEADERS, parseStudentEntry, loadStudentEntry, studentEntryUrl } from '../src/lib/studentEntry.mjs';

const response = (rows) => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: { cols: JOIN_HEADERS.map((label) => ({ label })), rows: rows.map((values) => ({ c: values.map((v) => ({ v })) })) } })});`;
test('public student picker preserves real attendance numbers and builds only safe Slides destinations', () => {
  const data = parseStudentEntry(response([[4, '송명신', 'slide-four', '학급', '과제'], [1, '김누리', 'slide-one', '학급', '과제'], [8, '가명', '', '학급', '과제']]));
  assert.deepEqual(data.students.map((student) => student.number), [1, 4, 8]);
  assert.equal(data.students[1].slideUrl, 'https://docs.google.com/presentation/d/slide-four/edit');
  assert.equal(data.students[2].slideUrl, null);
  assert.equal(parseStudentEntry(response([[1, '학생', 'https://unsafe.invalid/', '학급', '과제']])).students[0].slideUrl, null);
  assert.throws(() => parseStudentEntry(response([[1, '학생', 'slide-one'], [1, '중복', 'slide-two']])));
  assert.throws(() => parseStudentEntry('<html>login required</html>'));
});
test('student access reads only its public picker without teacher auth, API key, or write requests', async () => {
  let call;
  const data = await loadStudentEntry('public-picker', async (url, options) => { call = { url: new URL(url), options }; return { ok: true, text: async () => response([[4, '가명', 'slide-four', '학급', '과제']]) }; });
  assert.equal(data.students.length, 1); assert.equal(call.options.method, 'GET'); assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.headers, undefined);
  assert.equal(call.url.hostname, 'docs.google.com'); assert.equal(call.url.searchParams.get('sheet'), 'students'); assert.equal(call.url.searchParams.get('headers'), '1');
  assert.equal(call.url.searchParams.has('key'), false);
  await assert.rejects(loadStudentEntry('../unsafe'));
});
test('student link and downloadable QR encode the exact deployed destination', async () => {
  const link = studentEntryUrl('https://example-school.vercel.app', 'public-picker');
  assert.equal(link, 'https://example-school.vercel.app/join/public-picker');
  const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
  assert.equal(qr.segments.map((segment) => typeof segment.data === 'string' ? segment.data : new TextDecoder().decode(segment.data)).join(''), link);
  assert.match(await QRCode.toDataURL(link, { width: 1000, margin: 4 }), /^data:image\/png;base64,/);
});
