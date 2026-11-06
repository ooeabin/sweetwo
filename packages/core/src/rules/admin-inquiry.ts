import { todayKst } from '../date';

// 어드민 문의 경과(27 AD-06 2번): 1영업일 넘으면 경과 시간 강조. 영업일 = KST 기준 주말과 공휴일을 뺀 날.
// 접수 시각부터 지금까지 영업일에 들어가는 시간만 셈(한 시간 단위).
const HOUR = 3_600_000;
const weekday = (d: string) => {
  const [y = 0, m = 1, day = 1] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
};

/** 영업일에 든 시간(시간 단위, 내림) */
export function businessHoursSince(
  fromIso: string,
  holidays: ReadonlySet<string> = new Set(),
  now: Date = new Date(),
): number {
  const start = new Date(fromIso).getTime();
  const end = now.getTime();
  if (!(end > start)) return 0;
  let n = 0;
  // 60일 넘게 지난 문의는 어차피 강조(계산 줄이기)
  const stop = Math.min(end, start + 60 * 24 * HOUR);
  for (let t = start; t + HOUR <= stop; t += HOUR) {
    const d = todayKst(new Date(t));
    const w = weekday(d);
    if (w !== 0 && w !== 6 && !holidays.has(d)) n++;
  }
  return end > stop ? Math.max(n, 24) : n;
}

/** 1영업일(24 영업 시간) 넘었는지 */
export const inquiryOverdue = (
  fromIso: string,
  holidays: ReadonlySet<string> = new Set(),
  now: Date = new Date(),
) => businessHoursSince(fromIso, holidays, now) >= 24;
