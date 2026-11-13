import { firstChecklistStart, formatMonthDay, todayKst } from '@sweetwo/core';
import type { Me } from './data';

/**
 * 첫 월급날(“11월 25일”): 온보딩 O-55·O-60 문구. 첫 확인 목록은 소급하지 않고 오늘 이후 처음 오는 월급날(07 3-1, core
 * firstChecklistStart). 월급이 없거나 날짜가 정해지지 않았으면 null
 */
export function firstPaydayLabel(
  me: Pick<Me, 'monthly_income' | 'payday' | 'payday_last' | 'payday_none'> | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!me?.monthly_income || me.payday_none) return null;
  const base = me.payday_last ? ('last' as const) : me.payday;
  if (base == null) return null;
  const d = firstChecklistStart(todayKst(now), base);
  return d ? formatMonthDay(d) : null;
}
