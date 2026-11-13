import { addDays, daysBetween } from '../date';
import type { Won } from '../money';

// 날짜 없는 사람의 기간(docs/spec/07 6장, 06 2-2, plan v2.2 2-3, G8).
// 서버 money_in_period(p_user, p_today)(마이그레이션 20261203090000_v22_saving_together 계약 6)와 같은 결과.
// 기간 = 30일(S, E = S + 29). 첫 S = 처음 돈 들어온 날. 다음 S = E 뒤 처음 돈 들어온 날. 그 사이는 ‘빈 날’.

/** 기간 하나의 길이(일) */
export const PERIOD_DAYS = 30;
/** bar(막대)가 시작되는 날째(S + 15 = 16일째) */
export const PERIOD_BAR_FROM_DAY = 16;

export type MoneyInPeriodStatus = 'none' | 'early' | 'bar' | 'gap';

export interface MoneyInRow {
  amount: Won;
  received_on: string;
  deleted_at?: string | null;
}

export interface MoneyInPeriod {
  status: MoneyInPeriodStatus;
  /** 기간 시작 S */
  start: string | null;
  /** 기간 끝 E = S + 29 */
  end: string | null;
  /** 오늘이 기간 몇째 날(1~30). 기간 밖이면 null */
  day: number | null;
  /** 그 기간 [S, min(E, 오늘)]에 들어온 돈 합(종류 상관없음). 기간 없으면 0 */
  received: Won;
  /** 필요한 돈(월급 계획 모든 줄 합). 기간이 없으면 null */
  needed: Won | null;
  /** 빈 날 일수 = 오늘 − 마지막 돈 들어온 날(gap일 때만) */
  gapDays: number | null;
}

/**
 * 필요한 돈(06 2-2): 월급 계획 모든 줄 합(저금 + 고정지출 + 생활비 + 용돈 + 직접 추가 + 같이 쓰는 통장 + 보내기,
 * ‘체크리스트에 넣기’와 상관없음). 여유 자금은 줄이 아니라 빠짐.
 * (설계는 ‘기간 시작 때’ 월급 계획이지만 계획 기록이 없어 서버·core 모두 지금 계획으로 셈)
 */
export const periodNeeded = (lines: readonly { amount: Won }[]): Won =>
  lines.reduce((t, l) => t + Math.max(l.amount, 0), 0);

/**
 * 기간 계산(07 6장). moneyIns: 내 돈 들어온 기록(지운 것·오늘 뒤는 빠짐), today: KST 오늘, needed: periodNeeded 결과.
 * 오늘이 [S, E] 안이면 1~15일째 early, 16일째부터 bar. 마지막 E 뒤면 gap. 한 번도 없으면 none
 */
export function moneyInPeriod(
  moneyIns: readonly MoneyInRow[],
  today: string,
  needed: Won | null = null,
): MoneyInPeriod {
  const rows = moneyIns.filter((r) => !r.deleted_at && r.received_on <= today);
  const days = [...new Set(rows.map((r) => r.received_on))].sort();
  let s: string | null = null;
  let e: string | null = null;
  let last: string | null = null;
  for (const d of days) {
    if (s === null || e === null || d > e) {
      s = d;
      e = addDays(d, PERIOD_DAYS - 1);
    }
    last = d;
  }
  if (s === null || e === null || last === null)
    return {
      status: 'none',
      start: null,
      end: null,
      day: null,
      received: 0,
      needed: null,
      gapDays: null,
    };
  const from = s;
  const to = e < today ? e : today;
  const received = rows
    .filter((r) => r.received_on >= from && r.received_on <= to)
    .reduce((t, r) => t + r.amount, 0);
  if (today > e)
    return {
      status: 'gap',
      start: s,
      end: e,
      day: null,
      received,
      needed,
      gapDays: daysBetween(last, today),
    };
  const day = daysBetween(s, today) + 1;
  return {
    status: day < PERIOD_BAR_FROM_DAY ? 'early' : 'bar',
    start: s,
    end: e,
    day,
    received,
    needed,
    gapDays: null,
  };
}

/** 막대 채움 %(06 2-2): 들어온 돈 ÷ 필요한 돈 × 100 내림, 0~100. 필요한 돈이 0이거나 없으면 null */
export function periodFillPct(received: Won, needed: Won | null): number | null {
  if (needed === null || needed <= 0) return null;
  return Math.min(Math.max(Math.floor((Math.max(received, 0) * 100) / needed), 0), 100);
}

/** 보여 줄 모양(H-13): bar인데 필요한 돈이 0이면 막대 없이 early 문장(06 2-2) */
export function periodDisplay(p: MoneyInPeriod): MoneyInPeriodStatus {
  if (p.status === 'bar' && periodFillPct(p.received, p.needed) === null) return 'early';
  return p.status;
}

/** 다 찼나(보조 “남는 돈은 저금에 넣을 수 있어요”): bar이고 들어온 돈 ≥ 필요한 돈(> 0) */
export const periodFull = (p: MoneyInPeriod) =>
  p.status === 'bar' && p.needed !== null && p.needed > 0 && p.received >= p.needed;

/** 분석 money_in_period_viewed.filled_band(10% 구간, 32 8-4). 막대가 없으면 null */
export const periodFilledBand = (p: MoneyInPeriod) => {
  const pct = periodFillPct(p.received, p.needed);
  return pct === null ? null : Math.min(Math.floor(pct / 10) * 10, 100);
};
