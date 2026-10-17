import { describe, expect, it } from 'vitest';
import {
  careRound,
  familyCostSummary,
  familyRows,
  monthlyOut,
  roundOccurrences,
  rowsTotal,
  type RoundCare,
} from './family-cost';

// 24 Y-06 예시: 결혼기념일 4월 18일, 오늘 10월, “288만 원 중 150만 원 썼어요”, “매달 13만 원씩”, “남은 6개월”
const care = (p: Partial<RoundCare> & Pick<RoundCare, 'id' | 'kind' | 'budget'>): RoundCare => ({
  category: 'family',
  date_rule: 'solar_yearly',
  month: null,
  day: null,
  leap: false,
  once_on: null,
  ...p,
});
const cares = [
  care({ id: 's', kind: 'seollal', budget: 500_000, date_rule: 'lunar_yearly', month: 1, day: 1 }),
  care({ id: 'c', kind: 'chuseok', budget: 500_000, date_rule: 'lunar_yearly', month: 8, day: 15 }),
  care({ id: 'b1', kind: 'birthday', budget: 300_000, parent: true, month: 10, day: 14 }),
  care({ id: 'b2', kind: 'birthday', budget: 300_000, parent: true, month: 5, day: 20 }),
  care({ id: 'b3', kind: 'birthday', budget: 300_000, parent: true, month: 1, day: 3 }),
  care({ id: 'b4', kind: 'birthday', budget: 300_000, parent: true, month: 7, day: 2 }),
  care({ id: 'p', kind: 'parents_day', budget: 200_000, month: 5, day: 8 }),
  care({ id: 'o', kind: 'wedding', budget: 180_000, date_rule: 'once', once_on: '2026-12-05' }),
  care({ id: 'x', kind: 'anniversary', budget: 0, category: 'couple', month: 4, day: 18 }),
];

describe('양가 비용 회차', () => {
  const r = careRound('2025-04-18', '2026-10-07');
  it('결혼기념일 기준 1년', () => {
    expect(r).toEqual({ start: '2026-04-18', end: '2027-04-17' });
    expect(careRound('2025-04-18', '2027-04-18').start).toBe('2027-04-18');
    expect(careRound(null, '2026-10-07')).toEqual({ start: '2026-10-07', end: '2027-10-06' });
  });
  const occ = roundOccurrences(cares, r);
  it('회차 안 양가 날만(우리 둘 빼고)', () => {
    // 설(2027-02-06), 추석(2026-09-25), 생신 4번, 어버이날(2026-05-08 회차 안), 결혼식
    expect(occ.map((o) => o.care.id)).toEqual(['p', 'b2', 'b4', 'c', 'b1', 'o', 'b3', 's']);
  });
  it('항목 4행 단가 × 횟수, 1년 합계', () => {
    const rows = familyRows(occ);
    expect(rows.map((x) => [x.key, x.unit, x.count, x.total])).toEqual([
      ['holiday', 500_000, 2, 1_000_000],
      ['birthday', 300_000, 4, 1_200_000],
      ['parents_day', 200_000, 1, 200_000],
      ['other', 180_000, 1, 180_000],
    ]);
    expect(rowsTotal(rows)).toBe(2_580_000);
    expect(rowsTotal(rows, { birthday: 250_000 })).toBe(2_380_000);
  });
  it('남은 달마다 나갈 돈', () => {
    const out = monthlyOut(occ, r, '2026-10-07');
    expect(out).toHaveLength(7);
    expect(out[0]).toEqual({ month: '2026-10-01', amount: 300_000 });
    expect(out[2]).toEqual({ month: '2026-12-01', amount: 180_000 });
    expect(out[3]).toEqual({ month: '2027-01-01', amount: 300_000 });
  });
  it('기획서 예시: 288만 중 150만 썼고 60만 모아둠 → 매달 13만, 남은 6개월', () => {
    const s = familyCostSummary({
      total: 2_880_000,
      spent: 1_500_000,
      held: 600_000,
      round: r,
      today: '2026-10-07',
      next: { date: '2026-10-14', budget: 300_000 },
    });
    expect(s).toMatchObject({ left: 1_380_000, monthsLeft: 6, monthly: 130_000, enough: true });
  });
  it('모아둔 돈이 다음 날보다 적으면 더 모을 돈(1천 원 올림)', () => {
    const s = familyCostSummary({
      total: 2_880_000,
      spent: 1_500_000,
      held: 100_000,
      round: r,
      today: '2026-10-07',
      next: { date: '2026-12-05', budget: 180_000 },
    });
    expect(s).toMatchObject({ enough: false, extra: 40_000 });
  });
});
