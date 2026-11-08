import { describe, expect, it } from 'vitest';
import {
  jointRefill,
  joinerSplit,
  leftover,
  recommendSplit,
  round10k,
  type SavingPlanItem,
} from './salary-split';

// 기획서 예시(06 3-2, 17 O-50, 18 P-06): 찬우 실수령 350만, 오늘 2026년 10월.
// 저금 항목 내 집 마련(목표 1억 5,000만, 기한 2031년 10월), 적금(목표 금액 없음, 지금 30만)
const now = new Date('2026-10-26T03:00:00Z');
const home: SavingPlanItem = { id: 'h', target: 150_000_000, saved: 0, deadline: '2031-10' };
const savings: SavingPlanItem = { id: 's', target: null, saved: 0, deadline: null };

describe('recommendSplit: 온보딩 직후(저금 항목 없음)', () => {
  const lines = recommendSplit({
    income: 3_500_000,
    people: [{ userId: 'chanwoo', income: 3_500_000 }],
    items: [],
    now,
  });
  const amount = (k: string) => lines.find((l) => l.kind === k)?.amount;
  it('찬우 350만 예시: 고정 88, 생활 88, 용돈 35', () => {
    expect(amount('fixed')).toBe(880_000);
    expect(amount('living')).toBe(880_000);
    expect(amount('allowance')).toBe(350_000);
  });
  it('저금 줄 없이 남는 돈 139만(비상금 기본 항목 없음)', () => {
    expect(lines.some((l) => l.kind === 'saving')).toBe(false);
    expect(leftover(3_500_000, lines)).toBe(1_390_000);
  });
  it('월급이 없으면 모두 0원', () => {
    const z = recommendSplit({ income: 0, people: [{ userId: 'c', income: 0 }], items: [], now });
    expect(z.every((l) => l.amount === 0)).toBe(true);
  });
  it('합쳐서: 용돈은 사람마다 그 사람 실수령의 10%', () => {
    const j = recommendSplit({
      income: 6_200_000,
      people: [
        { userId: 'chanwoo', income: 3_500_000 },
        { userId: 'yebin', income: 2_700_000 },
      ],
      items: [],
      now,
    });
    expect(j.filter((l) => l.kind === 'allowance').map((l) => l.amount)).toEqual([
      350_000, 270_000,
    ]);
  });
});

describe('recommendSplit: 추천값으로 다시 채우기(06 3-2 두 번째 예시)', () => {
  const lines = recommendSplit({
    income: 3_500_000,
    people: [{ userId: 'chanwoo', income: 3_500_000 }],
    items: [savings, home],
    current: { s: 300_000, h: 0 },
    now,
  });
  it('목표 금액 없는 적금은 지금 금액 그대로 30만', () =>
    expect(lines.find((l) => l.goalId === 's')?.amount).toBe(300_000));
  it('남은 109만 → 내 집 마련 109만(월 필요액 246만 중)', () => {
    expect(lines.find((l) => l.goalId === 'h')?.amount).toBe(1_090_000);
    expect(lines.find((l) => l.goalId === 'h')?.need).toBe(2_460_000);
  });
  it('남는 돈 0원, 저금 줄이 쓰는 돈 줄보다 먼저', () => {
    expect(leftover(3_500_000, lines)).toBe(0);
    expect(lines.map((l) => l.kind)).toEqual(['saving', 'saving', 'fixed', 'living', 'allowance']);
  });
  it('파트너 탭: 파트너 저금 줄은 그대로 두고 그만큼 빼고 채움', () => {
    const l = recommendSplit({
      income: 2_700_000,
      people: [{ userId: 'yebin', income: 2_700_000 }],
      items: [home],
      keep: { h: 300_000 },
      now,
    });
    expect(l.find((x) => x.goalId === 'h')?.amount).toBe(300_000);
  });
  it('1만 원 반올림', () => expect(round10k(875_000)).toBe(880_000));
});

describe('합류 P-06 각자: joinerSplit', () => {
  it('예빈 270만: 고정 68, 생활 68, 용돈 27, 저금 줄 없음, 남는 돈 107', () => {
    const r = joinerSplit({ income: 2_700_000, userId: 'yebin' });
    expect(r.map((l) => [l.kind, l.userId ?? '', l.amount])).toEqual([
      ['fixed', '', 680_000],
      ['living', '', 680_000],
      ['allowance', 'yebin', 270_000],
    ]);
    expect(leftover(2_700_000, r)).toBe(1_070_000);
  });
});

describe('합류 P-06 합쳐서: jointRefill', () => {
  it('620만: 있던 줄은 그대로, 예빈 용돈 27, 내 집 95 → 246, 적금 30 그대로, 남는 돈 106', () => {
    const lines = [
      { kind: 'saving' as const, goalId: 'h', amount: 950_000 },
      { kind: 'saving' as const, goalId: 's', amount: 300_000 },
      { kind: 'fixed' as const, amount: 880_000 },
      { kind: 'living' as const, amount: 880_000 },
      { kind: 'allowance' as const, userId: 'chanwoo', amount: 350_000 },
    ];
    const r = jointRefill({
      lines,
      income: 2_700_000,
      userId: 'yebin',
      items: [home, savings],
      now,
    });
    expect(r.map((l) => l.amount)).toEqual([
      2_460_000, 300_000, 880_000, 880_000, 350_000, 270_000,
    ]);
    expect(r.at(-1)).toMatchObject({ kind: 'allowance', userId: 'yebin' });
    expect(leftover(6_200_000, r)).toBe(1_060_000);
  });
});
