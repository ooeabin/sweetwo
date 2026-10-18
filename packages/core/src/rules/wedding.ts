import type { Won } from '../money';
import { addMonths, monthsBetween, type YearMonth } from '../onboarding/month';

// 결혼 비용 상세(22 G-07, 06 11장). 항목·결제는 서버 표(wedding_item, wedding_payment), 계산은 여기.

/** 기본 항목(G-07 4번). 안 쓰는 항목은 숨김 = 표에 없음, G-07a에서 고름 */
export const WEDDING_ITEMS = [
  { key: 'venue', name: '예식장' },
  { key: 'sdm', name: '스드메' },
  { key: 'jewelry', name: '예물' },
  { key: 'yedan', name: '예단' },
  { key: 'honsu', name: '혼수' },
  { key: 'honeymoon', name: '신혼여행' },
  { key: 'move_in', name: '입주 비용' },
  { key: 'etc', name: '기타' },
] as const;

export type WeddingPayer = 'us' | 'groom' | 'bride' | 'family';
export type WeddingPart = 'deposit' | 'balance';

export interface WeddingItemIn {
  id: string;
  budget: Won;
  deposit_amount: Won | null;
  deposit_on: string | null;
  balance_amount: Won | null;
  balance_on: string | null;
  payer: WeddingPayer;
}
export interface WeddingPaymentIn {
  item_id: string;
  /** 'deposit' | 'balance' */
  part: string;
  amount: Won;
}

const paidOf = (pays: WeddingPaymentIn[], id: string, part: WeddingPart) =>
  pays.find((p) => p.item_id === id && p.part === part);

/**
 * 요약(2·3번). 결제 완료 = 기록한 결제 합, 남은 결제 = 총예산 − 결제 완료(0 하한).
 * 부족액 = 총예산 − 양가 지원 − 모아둔 돈 − 각자 낼 예정 항목 − 예식 전까지 남은 모으기 계획액. 0 이하면 여유.
 */
export function weddingSummary(o: {
  budget: Won;
  support: Won;
  saved: Won;
  monthlyPlan: Won;
  monthsLeft: number;
  items: WeddingItemIn[];
  payments: WeddingPaymentIn[];
}) {
  const paid = o.payments.reduce((t, p) => t + p.amount, 0);
  const personal = o.items
    .filter((i) => i.payer === 'groom' || i.payer === 'bride')
    .reduce((t, i) => t + i.budget, 0);
  const gap = o.budget - o.support - o.saved - personal - o.monthlyPlan * Math.max(o.monthsLeft, 0);
  return {
    paid,
    remaining: Math.max(o.budget - paid, 0),
    shortfall: Math.max(gap, 0),
    surplus: Math.max(-gap, 0),
  };
}

/** 이번 달 결제일인데 아직 기록 안 한 부분(6번 ‘결제했어요’, H-P2) */
export function duePayments(items: WeddingItemIn[], pays: WeddingPaymentIn[], month: YearMonth) {
  const out: { id: string; part: WeddingPart; amount: Won }[] = [];
  for (const i of items)
    for (const part of ['deposit', 'balance'] as const) {
      const on = part === 'deposit' ? i.deposit_on : i.balance_on;
      const amount = (part === 'deposit' ? i.deposit_amount : i.balance_amount) ?? 0;
      if (on && on.slice(0, 7) === month && !paidOf(pays, i.id, part))
        out.push({ id: i.id, part, amount });
    }
  return out;
}

/**
 * 월별 막대(8번): 이번 달부터 예식 달까지 나갈 돈(결혼 준비 통장에서 낼, 아직 안 낸 계약금·잔금) / 모일 돈(월 모으기 계획).
 * 모아둔 돈에서 시작해 달마다 더하고 빼며, 모자라면 그달 모자라는 금액(이어지는 달은 0에서 다시). total = 모자라는 금액 합.
 */
export function weddingMonths(o: {
  from: YearMonth;
  to: YearMonth;
  saved: Won;
  monthlyPlan: Won;
  items: WeddingItemIn[];
  payments: WeddingPaymentIn[];
}) {
  const n = Math.max(monthsBetween(o.from, o.to), 0) + 1;
  let bal = o.saved;
  const months = Array.from({ length: n }, (_, k) => {
    const month = addMonths(o.from, k);
    const out = o.items
      .filter((i) => i.payer === 'us')
      .reduce((t, i) => {
        let s = 0;
        for (const part of ['deposit', 'balance'] as const) {
          const on = part === 'deposit' ? i.deposit_on : i.balance_on;
          const amt = (part === 'deposit' ? i.deposit_amount : i.balance_amount) ?? 0;
          if (on && on.slice(0, 7) === month && !paidOf(o.payments, i.id, part)) s += amt;
        }
        return t + s;
      }, 0);
    const income = o.monthlyPlan;
    bal += income - out;
    const short = bal < 0 ? -bal : 0;
    if (bal < 0) bal = 0;
    return { month, out, income, short };
  });
  return { months, total: months.reduce((t, x) => t + x.short, 0) };
}

/** 결제 기록 뒤 예산 넘은 금액(서버 record_wedding_payment와 같음): 결제한 부분은 실제, 아직은 계획 금액 */
export function weddingOver(item: WeddingItemIn, pays: WeddingPaymentIn[]) {
  const dep = paidOf(pays, item.id, 'deposit')?.amount ?? item.deposit_amount ?? 0;
  const bal = paidOf(pays, item.id, 'balance')?.amount ?? item.balance_amount ?? 0;
  return Math.max(dep + bal - item.budget, 0);
}
