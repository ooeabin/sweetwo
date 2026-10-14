// 날짜는 KST 하나만 쓴다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 KST 기준 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
