import { classroomName, classroomKeywords } from './googleClassroom.mjs';

export function assignmentWithSettings(assignment, settings = {}) {
  const sourceName = assignment.sourceName || assignment.name;
  const title = typeof settings.title === 'string' && settings.title.trim() ? settings.title.trim() : sourceName;
  return {
    ...assignment,
    sourceName,
    name: title,
    keywords: Array.isArray(settings.keywords) ? classroomKeywords(settings.keywords) : assignment.keywords || [],
    studentEntry: settings.studentEntry || assignment.studentEntry || null,
  };
}

export function assignmentDetailsPayload(title, keywords) {
  const name = classroomName(title);
  const words = classroomKeywords(keywords);
  if (words.join(', ').length > 500) throw new Error('키워드는 전체 500자까지 추가할 수 있습니다.');
  return { title: name, keywords: words };
}
