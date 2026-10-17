import { expect, test } from 'vitest';
import { allowanceAfterCut, amountBand, inLivingCheckWindow, livingCheckDay } from './living-check';

test('체크일 = 기준일 + 사이클 길이의 절반(반올림)', () => {
  // 10.25 ~ 11.24 = 31일 → 16일 뒤
  expect(livingCheckDay('2026-10-25', '2026-11-24')).toBe('2026-11-10');
  // 11.25 ~ 12.24 = 30일 → 15일 뒤
  expect(livingCheckDay('2026-11-25', '2026-12-24')).toBe('2026-12-10');
});

test('카드는 체크일 전후 2일', () => {
  expect(inLivingCheckWindow('2026-11-08', '2026-10-25', '2026-11-24')).toBe(true);
  expect(inLivingCheckWindow('2026-11-12', '2026-10-25', '2026-11-24')).toBe(true);
  expect(inLivingCheckWindow('2026-11-07', '2026-10-25', '2026-11-24')).toBe(false);
  expect(inLivingCheckWindow('2026-11-13', '2026-10-25', '2026-11-24')).toBe(false);
});

test('내 용돈에서: 찬우 용돈 50만 원에서 20만 원 → 30만 원, 넘으면 고를 수 없음', () => {
  expect(allowanceAfterCut(500_000, 200_000)).toBe(300_000);
  expect(allowanceAfterCut(500_000, 500_000)).toBe(0);
  expect(allowanceAfterCut(500_000, 600_000)).toBeNull();
  expect(allowanceAfterCut(null, 1)).toBeNull();
});

test('금액 구간', () => {
  expect(amountBand(99_999)).toBe('<10만');
  expect(amountBand(200_000)).toBe('10-50만');
  expect(amountBand(1_000_000)).toBe('100-300만');
  expect(amountBand(10_000_000)).toBe('1000만+');
});
