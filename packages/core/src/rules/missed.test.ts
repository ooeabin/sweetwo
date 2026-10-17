import { expect, test } from 'vitest';
import { missedPlans, missedRange } from './missed';

const p = (
  m: number,
  o: Partial<{ status: string; mergedClose: boolean; closed: boolean }> = {},
) => ({
  id: `p${m}`,
  labelMonth: `2026-${String(m).padStart(2, '0')}-01`,
  status: 'created',
  mergedClose: false,
  closed: false,
  ...o,
});

test('놓친 달: 최근부터 이어서, 정리한 달에서 멈춤', () => {
  expect(missedPlans([p(10), p(9, { closed: true }), p(8)]).map((x) => x.id)).toEqual(['p10']);
  expect(missedPlans([p(10), p(9), p(8, { status: 'skipped' })]).map((x) => x.id)).toEqual([
    'p10',
    'p9',
  ]);
  expect(missedPlans([p(10, { closed: true })])).toEqual([]);
});

test('첫 사이클을 합친 플랜은 놓친 달이 아님', () => {
  expect(missedPlans([p(10), p(9, { mergedClose: true })]).map((x) => x.id)).toEqual(['p10']);
});

test('밀린 달 이름: 10월 / 8~10월', () => {
  expect(missedRange([p(10)])).toBe('10월');
  expect(missedRange([p(10), p(9), p(8)])).toBe('8~10월');
  expect(missedRange([])).toBe('');
});
