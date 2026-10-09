// Read presentation content without inferring edit times or modifying stored history.
export function parsePresentationId(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (/^[\w-]+$/.test(text)) return text;
    try {
      const url = new URL(text);
      const match = url.pathname.match(/^\/presentation\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/);
      if (url.protocol === 'https:' && url.hostname === 'docs.google.com' && match) return match[1];
    } catch { /* Try the next saved field. */ }
  }
  return null;
}

const textOf = (text) => (text?.textElements || []).map((element) => element.textRun?.content || '').join('');
function extractElements(elements) {
  const blocks = [];
  let images = 0;
  for (const element of elements || []) {
    if (element.elementGroup) {
      const group = extractElements(element.elementGroup.children);
      blocks.push(group.text);
      images += group.images;
    }
    if (element.image) images++;
    if (element.shape?.text) blocks.push(textOf(element.shape.text));
    if (element.wordArt?.renderedText) blocks.push(element.wordArt.renderedText);
    if (element.table) blocks.push((element.table.tableRows || []).map((row) => (row.tableCells || []).map((cell) => textOf(cell.text).trimEnd()).join('\t')).join('\n'));
  }
  return { text: blocks.filter(Boolean).join('\n').trim(), images };
}

export function adaptPresentation(presentation, checkedAt) {
  if (!Array.isArray(presentation.slides)) throw new Error('슬라이드 본문을 읽지 못했습니다. 원본이 Google Slides 파일인지 확인해 주세요.');
  const pages = presentation.slides.map((slide, index) => {
    const body = extractElements(slide.pageElements);
    const notes = extractElements((slide.slideProperties?.notesPage?.pageElements || []).filter((element) => element.shape?.placeholder?.type === 'BODY'));
    const text = [body.text, notes.text].filter(Boolean).join('\n');
    return { number: index + 1, id: slide.objectId, text: body.text, notes: notes.text,
      chars: text.replace(/\s/g, '').length, images: body.images };
  });
  return { presentationId: presentation.presentationId, title: presentation.title || '학생 슬라이드',
    checkedAt, source: 'on_demand_google_slides', pages,
    charCount: pages.reduce((sum, page) => sum + page.chars, 0),
    slideCount: pages.length, imageCount: pages.reduce((sum, page) => sum + page.images, 0) };
}
