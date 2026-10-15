export const ASSIGNMENT_FILE_PREFIX = 'G배움로그_과제_';
const LEGACY_ASSIGNMENT_FILE_PREFIX = 'SlideSight_DB_';

export function assignmentFileName(className, assignmentName) {
  return `${ASSIGNMENT_FILE_PREFIX}[${className}]_[${assignmentName}]`;
}

export function parseAssignmentFileName(value) {
  const name = String(value || '');
  for (const prefix of [ASSIGNMENT_FILE_PREFIX, LEGACY_ASSIGNMENT_FILE_PREFIX]) {
    if (!name.startsWith(prefix)) continue;
    const match = name.slice(prefix.length).match(/^\[([^\]]+)\]_\[(.*)\]$/);
    if (match) return { className: match[1], assignmentName: match[2], legacy: prefix === LEGACY_ASSIGNMENT_FILE_PREFIX };
  }
  return null;
}
