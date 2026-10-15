import QRCode from 'qrcode';

const PAGE_WIDTH = 2480;
const PAGE_HEIGHT = 3508;
const CARDS_PER_PAGE = 8;
const PAGE_POINTS = [595.28, 841.89];

function pdfFromJpegPages(pages) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const push = (value) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, body) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (Array.isArray(body)) body.forEach(push);
    else push(body);
    push('\nendobj\n');
  };
  push('%PDF-1.4\n');
  const ids = pages.map((_, index) => ({ image: 3 + index * 3, content: 4 + index * 3, page: 5 + index * 3 }));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${ids.map(({ page }) => `${page} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach(({ jpeg, width, height }, index) => {
    const { image, content, page } = ids[index];
    const data = Uint8Array.from(atob(jpeg.split(',')[1]), (character) => character.charCodeAt(0));
    object(image, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`, data, '\nendstream']);
    const drawing = `q ${PAGE_POINTS[0]} 0 0 ${PAGE_POINTS[1]} 0 0 cm /Im${index} Do Q`;
    object(content, `<< /Length ${encoder.encode(drawing).length} >>\nstream\n${drawing}\nendstream`);
    object(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_POINTS.join(' ')}] /Resources << /XObject << /Im${index} ${image} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  const startXref = length;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('QR 이미지를 PDF에 넣지 못했습니다.'));
    image.src = url;
  });
}

function fitText(context, value, maxWidth) {
  let text = String(value || '');
  while (text && context.measureText(text).width > maxWidth) text = `${text.slice(0, -2)}…`;
  return text;
}

export async function createStudentQrPdf({ className, assignmentName, students }) {
  const linked = students.filter((student) => student.slideUrl);
  if (!linked.length) throw new Error('슬라이드가 연결된 학생이 없어 QR PDF를 만들 수 없습니다.');
  const pages = [];
  for (let start = 0; start < linked.length; start += CARDS_PER_PAGE) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PDF를 만들 수 없는 브라우저입니다.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.fillStyle = '#20342b'; context.font = '700 66px system-ui, "Malgun Gothic", sans-serif';
    context.fillText('학생별 슬라이드 QR', 135, 170);
    context.font = '36px system-ui, "Malgun Gothic", sans-serif'; context.fillStyle = '#587060';
    context.fillText(fitText(context, `${className}  ·  ${assignmentName}`, PAGE_WIDTH - 270), 135, 235);
    context.textAlign = 'right'; context.font = '30px system-ui, "Malgun Gothic", sans-serif';
    context.fillText(`${Math.floor(start / CARDS_PER_PAGE) + 1} / ${Math.ceil(linked.length / CARDS_PER_PAGE)}`, PAGE_WIDTH - 135, 170);
    context.textAlign = 'left';
    for (let index = 0; index < CARDS_PER_PAGE && start + index < linked.length; index++) {
      const student = linked[start + index];
      const column = index % 2, row = Math.floor(index / 2);
      const x = 135 + column * 1118, y = 320 + row * 735;
      context.strokeStyle = '#cedbd0'; context.lineWidth = 3;
      context.strokeRect(x, y, 1092, 695);
      context.fillStyle = '#f5f8f4'; context.fillRect(x + 2, y + 2, 1088, 106);
      context.fillStyle = '#20342b'; context.font = '700 43px system-ui, "Malgun Gothic", sans-serif';
      context.fillText(fitText(context, `${student.number ?? '—'}번  ${student.name}`, 980), x + 36, y + 72);
      const qr = await QRCode.toDataURL(student.slideUrl, { width: 540, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#20342b', light: '#ffffff' } });
      context.drawImage(await loadImage(qr), x + 36, y + 132, 520, 520);
      context.fillStyle = '#20342b'; context.font = '700 40px system-ui, "Malgun Gothic", sans-serif';
      context.fillText('내 슬라이드 열기', x + 590, y + 300);
      context.fillStyle = '#617768'; context.font = '31px system-ui, "Malgun Gothic", sans-serif';
      context.fillText('QR을 스캔하세요.', x + 590, y + 360);
      context.font = '26px system-ui, "Malgun Gothic", sans-serif';
      context.fillText('개인별로 잘라서 배부', x + 590, y + 550);
    }
    context.fillStyle = '#718579'; context.font = '27px system-ui, "Malgun Gothic", sans-serif';
    context.fillText('G배움로그  ·  이 종이에는 학생별 편집 링크가 포함되어 있습니다.', 135, PAGE_HEIGHT - 95);
    pages.push({ jpeg: canvas.toDataURL('image/jpeg', 0.92), width: PAGE_WIDTH, height: PAGE_HEIGHT });
  }
  return pdfFromJpegPages(pages);
}

export { pdfFromJpegPages };
