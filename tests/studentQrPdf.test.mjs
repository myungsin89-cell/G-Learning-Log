import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfFromJpegPages } from '../src/lib/studentQrPdf.mjs';

test('student QR print sheets contain one A4 PDF page per rendered card sheet', async () => {
  const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
  const pdf = pdfFromJpegPages([{ jpeg, width: 2480, height: 3508 }, { jpeg, width: 2480, height: 3508 }]);
  assert.equal(pdf.type, 'application/pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  assert.match(text, /^%PDF-1\.4\n/);
  assert.match(text, /\/Count 2/);
  assert.equal((text.match(/\/Type \/Page\b/g) || []).length, 2);
  assert.equal((text.match(/\/Subtype \/Image\b/g) || []).length, 2);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  const xref = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
});
