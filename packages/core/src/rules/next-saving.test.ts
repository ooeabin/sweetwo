import { expect, it } from 'vitest';
import {
  deadlinePassed,
  nextSavingOptions,
  nextSavingReason,
  nextSavingTaskOpen,
  savingChips,
} from './next-saving';

it('이름 칩 표(19): 두 사람 사이마다 3개, ‘같이 살 집’ 없음', () => {
  expect(savingChips('engaged')).toEqual(['wedding', 'honeymoon', 'emergency']);
  expect(savingChips('married')).toEqual(['jeonse_loan', 'travel', 'emergency']);
  expect(savingChips('living_together')).toEqual(['travel', 'moving', 'emergency']);
  expect(savingChips('dating')).toEqual(['travel', 'emergency', 'gift']);
  expect(savingChips(null)).toEqual(['travel', 'emergency', 'gift']);
});

// ‘여행’ 목표 금액 300만, 기한 2026년 12월, 모은 금액 200만
const trip = {
  status: 'active',
  closed_at: null,
  target_amount: 3_000_000,
  deadline: '2026-12',
  saved: 2_000_000,
};

it('기한 지남 = 기한 달 말일이 지났고 못 모음(06 5-5)', () => {
  expect(deadlinePassed(trip, '2026-12-31')).toBe(false);
  expect(deadlinePassed(trip, '2027-01-01')).toBe(true);
  expect(deadlinePassed({ ...trip, saved: 3_000_000 }, '2027-01-01')).toBe(false);
  expect(nextSavingReason(trip, '2027-01-01')).toBe('deadline');
  expect(nextSavingReason({ ...trip, status: 'achieved' }, '2026-11-01')).toBe('achieved');
  expect(nextSavingReason(trip, '2026-11-01')).toBeNull();
});

it('W-12b 선택지: 기한 지남이면 맨 위 기한 새로 정하기', () => {
  expect(nextSavingOptions('deadline', 'dating')).toEqual([
    'redeadline',
    'travel',
    'emergency',
    'gift',
    'custom',
  ]);
  expect(nextSavingOptions('achieved', 'engaged')).toEqual([
    'wedding',
    'honeymoon',
    'emergency',
    'custom',
  ]);
});

it('다음 저금 띠(H-06 11번): 기한 다음 달 1일부터 14일', () => {
  expect(nextSavingTaskOpen(trip, '2027-01-01')).toBe(true);
  expect(nextSavingTaskOpen(trip, '2027-01-14')).toBe(true);
  expect(nextSavingTaskOpen(trip, '2027-01-15')).toBe(false);
  expect(nextSavingTaskOpen(trip, '2026-12-31')).toBe(false);
});
