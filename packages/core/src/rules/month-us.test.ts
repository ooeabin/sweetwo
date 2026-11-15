import { describe, expect, it } from 'vitest';
import { monthUsRowCount, monthUsSaving, monthUsShown } from './month-us';

// 19 H-14 이번 달 우리 둘: 예빈(합류한 사람) 카드
const base = {
  id: '00000000-0000-4000-8000-000000000001',
  sent_on: '2026-11-11',
  month_key: '2026-11',
  saved_total: 14_000_000,
  saved_delta: null,
  saving_count: 1,
  hidden: false,
  care: [],
  care_count: 0,
  allowance: 300_000,
};

describe('monthUsSaving', () => {
  it('처음 카드: 지금까지 1,400만 원', () => {
    expect(monthUsSaving(base)).toEqual({ kind: 'first', total: 14_000_000 });
  });
  it('다음 달 +100만 원', () => {
    expect(monthUsSaving({ ...base, saved_total: 15_000_000, saved_delta: 1_000_000 })).toEqual({
      kind: 'up',
      amount: 1_000_000,
    });
  });
  it('줄었으면 줄어든 금액, 그대로면 그대로', () => {
    expect(monthUsSaving({ ...base, saved_delta: -200_000 })).toEqual({
      kind: 'down',
      amount: 200_000,
    });
    expect(monthUsSaving({ ...base, saved_delta: 0 })).toEqual({ kind: 'same' });
  });
  it('했어요만 공개면 금액 없이 개수만', () => {
    expect(monthUsSaving({ ...base, hidden: true, saved_total: null })).toEqual({
      kind: 'hidden',
      count: 1,
    });
  });
  it('저금이 없으면 줄 없음', () => {
    expect(monthUsSaving({ ...base, saving_count: 0, saved_total: 0 })).toEqual({ kind: 'none' });
  });
});

describe('monthUsShown(2026-11-16 4차 검토: 줄이 2개보다 적으면 숨김)', () => {
  it('저금 + 용돈 = 2줄이면 보임(경조사 없음 줄은 세지 않음)', () => {
    expect(monthUsRowCount(base)).toBe(2);
    expect(monthUsShown(base)).toBe(true);
  });
  it('경조사 없음 + 용돈뿐이면 숨김', () => {
    const c = { ...base, saving_count: 0, saved_total: null };
    expect(monthUsRowCount(c)).toBe(1);
    expect(monthUsShown(c)).toBe(false);
  });
  it('저금 + 경조사 + 용돈 = 3줄', () => {
    const c = {
      ...base,
      care: [{ name: '어머니 생신', on: '2026-12-03' }],
      care_count: 1,
    };
    expect(monthUsRowCount(c)).toBe(3);
  });
});
