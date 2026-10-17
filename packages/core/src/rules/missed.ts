// 놓친 달(docs/spec/21-month-close.md ‘놓친 달’, 07 5장).

export interface PastPlanLike {
  id: string;
  labelMonth: string;
  status: string;
  mergedClose: boolean;
  closed: boolean;
}

/**
 * 정리하지 않고 지나간 플랜: 가장 최근 것부터 이어서(사이에 정리했거나 쉬어간 달이 있으면 거기서 멈춤).
 * 첫 사이클을 다음과 합친 플랜(merged_close)은 다음 플랜과 함께 정리하므로 놓친 달이 아님
 */
export function missedPlans<T extends PastPlanLike>(recentFirst: T[]): T[] {
  const out: T[] = [];
  for (const p of recentFirst) {
    if (p.closed || p.status === 'skipped' || p.status === 'closed') break;
    if (p.mergedClose) continue;
    out.push(p);
  }
  return out;
}

/** 밀린 달 이름: 하나면 “10월”, 여럿이면 “8~10월”(오래된 달 ~ 최근 달) */
export function missedRange(recentFirst: { labelMonth: string }[]): string {
  const months = recentFirst.map((p) => Number(p.labelMonth.slice(5, 7)));
  const last = months[0];
  const first = months[months.length - 1];
  if (last === undefined || first === undefined) return '';
  return months.length > 1 ? `${first}~${last}월` : `${last}월`;
}
