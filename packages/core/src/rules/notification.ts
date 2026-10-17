import { addDays, daysBetween, formatMonthDay, todayKst } from '../date';

// 알림 센터(docs/spec/14-notifications.md N-01 4·6번). 시각·묶음은 한국 시간 기준.

/** 시간 “방금” / “12분 전” / “2시간 전” / “어제” / “3일 전” / “10월 3일” */
export function notiTime(at: string, now: Date = new Date()) {
  const ms = now.getTime() - new Date(at).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}시간 전`;
  const days = daysBetween(todayKst(new Date(at)), todayKst(now));
  if (days <= 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return formatMonthDay(todayKst(new Date(at)));
}

export type NotiGroup = 'today' | 'week' | 'earlier';
/** 묶음: 오늘 / 이번 주(이번 주 월요일 ~ 어제) / 이전 */
export function notiGroup(at: string, now: Date = new Date()): NotiGroup {
  const day = todayKst(new Date(at));
  const today = todayKst(now);
  if (day === today) return 'today';
  const [y = 0, m = 1, d = 1] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = 일
  const monday = addDays(today, -((dow + 6) % 7));
  return day >= monday ? 'week' : 'earlier';
}

/** 금액 가리기 켜짐: 문구 속 금액 “•••”(30만 원, 320만 5,000원, 1억 2,000만 원, 300,000원) */
export const maskMoney = (text: string) =>
  text.replace(/(?:[\d,]+억\s?)?(?:[\d,]+만\s?)?(?:[\d,]+\s?)?원/g, (m) =>
    /\d/.test(m) ? '•••' : m,
  );
