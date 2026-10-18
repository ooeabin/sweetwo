import { expect, it } from 'vitest';
import {
  duePayments,
  weddingMonths,
  weddingOver,
  weddingSummary,
  type WeddingItemIn,
} from './wedding';

const item = (p: Partial<WeddingItemIn> & { id: string }): WeddingItemIn => ({
  budget: 0,
  deposit_amount: null,
  deposit_on: null,
  balance_amount: null,
  balance_on: null,
  payer: 'us',
  ...p,
});

it('요약: 결제 완료, 남은 결제, 부족액(각자 낼 항목 빼고), 여유', () => {
  const items = [
    item({ id: 'a', budget: 15_000_000 }),
    item({ id: 'b', budget: 5_000_000, payer: 'groom' }),
  ];
  const s = weddingSummary({
    budget: 30_000_000,
    support: 5_000_000,
    saved: 8_000_000,
    monthlyPlan: 1_000_000,
    monthsLeft: 9,
    items,
    payments: [{ item_id: 'a', part: 'deposit', amount: 1_000_000 }],
  });
  // 3,000 − 500 − 800 − 500 − 900 = 300만 부족
  expect(s).toEqual({ paid: 1_000_000, remaining: 29_000_000, shortfall: 3_000_000, surplus: 0 });
  const t = weddingSummary({
    budget: 30_000_000,
    support: 10_000_000,
    saved: 12_000_000,
    monthlyPlan: 1_000_000,
    monthsLeft: 9,
    items,
    payments: [],
  });
  expect(t.surplus).toBe(1_200_000 * 5);
});

it('이번 달 결제할 것: 날짜가 이번 달이고 아직 기록 안 한 부분', () => {
  const items = [
    item({
      id: 'a',
      deposit_amount: 1_000_000,
      deposit_on: '2026-10-14',
      balance_amount: 4_000_000,
      balance_on: '2026-12-01',
    }),
  ];
  expect(duePayments(items, [], '2026-10')).toEqual([
    { id: 'a', part: 'deposit', amount: 1_000_000 },
  ]);
  expect(duePayments(items, [{ item_id: 'a', part: 'deposit', amount: 1 }], '2026-10')).toEqual([]);
});

it('월별: 모아둔 돈에서 나갈 돈을 빼고 모일 돈을 더함, 모자라면 그달 금액', () => {
  const items = [
    item({
      id: 'a',
      deposit_amount: 3_000_000,
      deposit_on: '2026-11-05',
      balance_amount: 2_000_000,
      balance_on: '2026-12-05',
    }),
    item({ id: 'b', deposit_amount: 9_000_000, deposit_on: '2026-12-10', payer: 'family' }),
  ];
  const r = weddingMonths({
    from: '2026-10',
    to: '2026-12',
    saved: 1_000_000,
    monthlyPlan: 500_000,
    items,
    payments: [],
  });
  expect(r.months).toEqual([
    { month: '2026-10', out: 0, income: 500_000, short: 0 },
    { month: '2026-11', out: 3_000_000, income: 500_000, short: 1_000_000 },
    { month: '2026-12', out: 2_000_000, income: 500_000, short: 1_500_000 },
  ]);
  expect(r.total).toBe(2_500_000);
});

it('예산 넘은 금액: 결제한 부분은 실제, 아직은 계획', () => {
  const i = item({
    id: 'a',
    budget: 5_000_000,
    deposit_amount: 1_000_000,
    balance_amount: 4_000_000,
  });
  expect(weddingOver(i, [{ item_id: 'a', part: 'balance', amount: 4_500_000 }])).toBe(500_000);
  expect(weddingOver(i, [])).toBe(0);
});
