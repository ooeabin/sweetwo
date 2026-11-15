import { prefs } from '../auth';

/**
 * 합류를 마친 뒤 화면(P-09·P-10·P-11)을 이 기기에 기억(2026-11-16 r5 A1). 그 사이 앱을 다시 열면 A-06 권장보다 먼저
 * 이 화면부터(auth routeAfterLogin). 홈으로 갈 때(P-10 ‘홈으로 가기’, P-11) 지움
 */
export const RESUMABLE_JOIN = new Set(['p-09', 'p-10', 'p-11']);
export const markJoinAfter = (uid: string, id: string) => {
  if (RESUMABLE_JOIN.has(id)) prefs.setJoinAfter(uid, id);
};
export const clearJoinAfter = () => prefs.setJoinAfter(null, null);
