import { addMonths, monthsBetween, parseYm, type YearMonth } from '../onboarding/month';

// 목표 상세 진행 그래프(22 G-02 9번)와 월별 저금 막대(10a번).
// - 계획 = 이미 모은 돈 + 매달 넣는 돈 × (만든 달부터 센 달 수). 실제 = 이미 모은 돈 + 그달까지 더한 돈(체크한 저금, 넣기 − 빼기 − 꺼내 쓰기)
// - 막대: 최근 6개월(기록이 짧으면 있는 달만), 그달 저금 줄 금액 대비 실제로 넣은 돈의 차이. 이번 달이 마지막

/** 그달에 모은 돈이 바뀐 것(체크한 저금 +, 넣기 +, 빼기·꺼내 쓰기 −) */
export interface GoalFlow {
  ym: string;
  amount: number;
}
/** 체크리스트 저금 줄 한 달(그달 계획, 실제로 넣은 돈. 못 함·체크 안 함이면 0) */
export interface GoalMonthLine {
  ym: string;
  planned: number;
  actual: number;
}
export interface GoalProgressPoint {
  ym: YearMonth;
  plan: number;
  actual: number;
}

export function goalProgress(p: {
  start: string;
  now: string;
  held: number;
  monthly: number;
  flows: GoalFlow[];
}): GoalProgressPoint[] {
  const n = Math.max(monthsBetween(p.start.slice(0, 7), p.now.slice(0, 7)), 0);
  const out: GoalProgressPoint[] = [];
  let actual = p.held;
  // 만든 달보다 앞선 기록은 첫 달에 넣음
  const by = new Map<string, number>();
  for (const f of p.flows) {
    const k = f.ym < p.start.slice(0, 7) ? p.start.slice(0, 7) : f.ym.slice(0, 7);
    by.set(k, (by.get(k) ?? 0) + f.amount);
  }
  for (let i = 0; i <= n; i++) {
    const ym = addMonths(p.start.slice(0, 7), i);
    actual += by.get(ym) ?? 0;
    out.push({ ym, plan: p.held + p.monthly * (i + 1), actual });
  }
  return out;
}

export interface GoalBar {
  ym: YearMonth;
  month: number;
  planned: number;
  actual: number;
  diff: number;
  now: boolean;
}

/** 최근 6개월 저금 막대(이번 달 포함, 저금 줄이 있는 달만) */
export function goalBars(lines: GoalMonthLine[], now: string, months = 6): GoalBar[] {
  const cur = now.slice(0, 7);
  const from = addMonths(cur, -(months - 1));
  const by = new Map<string, GoalMonthLine>();
  for (const l of lines) {
    const k = l.ym.slice(0, 7);
    if (k < from || k > cur) continue;
    const o = by.get(k);
    by.set(
      k,
      o ? { ym: k, planned: o.planned + l.planned, actual: o.actual + l.actual } : { ...l, ym: k },
    );
  }
  return [...by.values()]
    .sort((a, b) => (a.ym < b.ym ? -1 : 1))
    .map((l) => ({
      ym: l.ym as YearMonth,
      month: parseYm(l.ym).m,
      planned: l.planned,
      actual: l.actual,
      diff: l.actual - l.planned,
      now: l.ym === cur,
    }));
}
