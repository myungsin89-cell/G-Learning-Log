export const ROSTER_NOTICE_VERSION = '2026-10-12';

export function assertRosterConfirmation(confirmed) {
  if (confirmed !== true) throw new Error('학생 명단 등록 전 개인정보 안내와 필요한 동의 또는 처리 근거를 확인해 주세요.');
}
