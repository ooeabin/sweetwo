import { expect, it } from 'vitest';
import {
  deadlinePassed,
  nextSavingOptions,
  nextSavingReason,
  nextSavingTaskOpen,
  SAVING_CHIPS,
  savingChips,
  savingStartChips,
  type SavingChip,
} from './next-saving';

it('이름 칩 표(19, 2026-11-18): 두 사람 사이마다 6개', () => {
  expect(savingChips('engaged')).toEqual([
    'wedding',
    'newlywed_home',
    'honeymoon',
    'dowry',
    'emergency',
    'home',
  ]);
  expect(savingChips('married')).toEqual([
    'home',
    'travel',
    'emergency',
    'car',
    'childcare',
    'retire',
  ]);
  expect(savingChips('living_together')).toEqual([
    'travel',
    'moving',
    'emergency',
    'home',
    'car',
    'appliance',
  ]);
  expect(savingChips('dating')).toEqual([
    'travel',
    'emergency',
    'anniv_gift',
    'wedding',
    'date',
    'lump',
  ]);
  expect(savingChips(null)).toEqual(savingChips('dating'));
  for (const m of Object.keys(SAVING_CHIPS) as (keyof typeof SAVING_CHIPS)[]) {
    expect(SAVING_CHIPS[m]).toHaveLength(6);
    expect(new Set(SAVING_CHIPS[m]).size).toBe(6);
  }
});

it('H-10 빈 상태 칩: 이름 칩 6개 + 맨 끝 직접 정하기', () => {
  for (const m of ['engaged', 'married', 'living_together', 'dating', null] as const) {
    const c = savingStartChips(m);
    expect(c).toHaveLength(7);
    expect(c.at(-1)).toBe('custom');
    expect(c.slice(0, 6)).toEqual(savingChips(m));
  }
});

it('결혼 말 규칙: 신혼집·신혼여행·혼수는 결혼 준비 중에만(연애 중 ‘결혼 비용’은 사용자 결정 예외)', () => {
  const marry: SavingChip[] = ['newlywed_home', 'honeymoon', 'dowry'];
  for (const m of ['married', 'living_together', 'dating', 'undecided'] as const)
    for (const c of marry) expect(SAVING_CHIPS[m]).not.toContain(c);
  for (const c of marry) expect(SAVING_CHIPS.engaged).toContain(c);
  expect(SAVING_CHIPS.living_together).not.toContain('wedding');
  expect(SAVING_CHIPS.married).not.toContain('wedding');
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
    ...savingChips('dating'),
    'custom',
  ]);
  expect(nextSavingOptions('achieved', 'engaged')).toEqual([...savingChips('engaged'), 'custom']);
});

it('다음 저금 띠(H-06 11번): 기한 다음 달 1일부터 14일', () => {
  expect(nextSavingTaskOpen(trip, '2027-01-01')).toBe(true);
  expect(nextSavingTaskOpen(trip, '2027-01-14')).toBe(true);
  expect(nextSavingTaskOpen(trip, '2027-01-15')).toBe(false);
  expect(nextSavingTaskOpen(trip, '2026-12-31')).toBe(false);
});
