import { expect, it } from 'vitest';
import {
  BundleViewListSchema,
  MoneyInPeriodSchema,
  PartnerPlanViewSchema,
  RankPairSchema,
  NetworthSummarySchema,
  pushKindOn,
} from './v22';

it('money_in_period 응답 → core 모양(gapDays)', () => {
  expect(
    MoneyInPeriodSchema.parse({
      status: 'gap',
      start: '2026-10-03',
      end: '2026-11-01',
      day: null,
      received: 3_400_000,
      needed: 3_800_000,
      gap_days: 24,
    }),
  ).toEqual({
    status: 'gap',
    start: '2026-10-03',
    end: '2026-11-01',
    day: null,
    received: 3_400_000,
    needed: 3_800_000,
    gapDays: 24,
  });
  expect(() => MoneyInPeriodSchema.parse({ status: 'late', received: 0 })).toThrow();
});

it('bundle_view·rank·partner_plan_view·networth_summary', () => {
  const b = BundleViewListSchema.parse([
    {
      id: 'b',
      name: '결혼 비용',
      status: 'active',
      deadline: null,
      paused: false,
      percent_only: true,
      show_each: false,
      my_show_each: false,
      my_percent_only: true,
      pct: 72,
      total: null,
      target: null,
      mine: null,
      partner: null,
      goals: [{ id: 'g', mine: true, name: '결혼 비용' }],
    },
  ]);
  expect(b[0]?.pct).toBe(72);
  expect(RankPairSchema.parse({ mode: 'peer', band: '30s', median: 155_850_000 })).toEqual({
    mode: 'peer',
    band: '30s',
    median: 155_850_000,
  });
  expect(
    RankPairSchema.parse({
      mode: 'pair',
      net: 1,
      top_pct: 97,
      top_open: false,
      band: null,
      basis: 'all',
    }).mode,
  ).toBe('pair');
  expect(PartnerPlanViewSchema.parse(null)).toBeNull();
  expect(
    PartnerPlanViewSchema.parse({
      owner: 'y',
      nickname: null,
      share: 'done_only',
      mode: 'separate',
      hidden: false,
      income: null,
      payday: null,
      lines: [
        {
          id: 'l',
          kind: 'saving',
          goal_id: 'g',
          name: '여행',
          user_id: null,
          amount: null,
          in_checklist: true,
          auto_pay: false,
          state: null,
        },
      ],
    })?.lines[0]?.amount,
  ).toBeNull();
  expect(NetworthSummarySchema.parse({ assets: 3, debts: 1, net: 2, principal_net: 1 })).toEqual({
    assets: 3,
    debts: 1,
    net: 2,
    principalNet: 1,
  });
});

it('알림 종류: 없는 키 = 켬', () => {
  expect(pushKindOn({}, 'progress_news')).toBe(true);
  expect(pushKindOn({ progress_news: false }, 'progress_news')).toBe(false);
  expect(pushKindOn(null, 'care')).toBe(true);
});
