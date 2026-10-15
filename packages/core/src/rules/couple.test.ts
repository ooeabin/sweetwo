import { describe, expect, it } from 'vitest';
import { coupleBaseDay, coupleOf, type CoupleSpace, type CoupleUser } from './couple';

const M = 10_000;
const chanwoo: CoupleUser = {
  id: 'c',
  nickname: '찬우',
  monthly_income: 350 * M,
  payday: 25,
  payday_last: false,
  allowance: 50 * M,
};
const yebin: CoupleUser = {
  id: 'y',
  nickname: '예빈',
  monthly_income: 270 * M,
  payday: 10,
  payday_last: false,
  allowance: 60 * M,
};
const space: CoupleSpace = {
  created_by: 'c',
  couple_state: 'not_joined',
  partner_nickname: '예빈',
  partner_income: 250 * M,
  partner_income_estimated: true,
  partner_income_unknown: false,
  split_ratio: 60,
};

describe('두 사람 기준(18 예시값)', () => {
  it('합류 전 찬우: 배우자는 찬우가 적은 추정값, 용돈은 같다고 가정', () => {
    const c = coupleOf(chanwoo, space, null);
    expect(c).toMatchObject({
      joined: false,
      starter: true,
      partnerName: '예빈',
      partnerIncome: 250 * M,
      partnerEstimated: true,
      partnerAllowance: null,
      myRatio: 60,
    });
    expect(coupleBaseDay(c)).toBe(25);
  });
  it('합류 뒤 찬우: 예빈 실제 값, 기준일은 늦은 월급날', () => {
    const c = coupleOf(chanwoo, { ...space, couple_state: 'connected' }, yebin);
    expect(c).toMatchObject({
      partnerIncome: 270 * M,
      partnerEstimated: false,
      partnerAllowance: 60 * M,
      myRatio: 60,
    });
    expect(coupleBaseDay(c)).toBe(25);
  });
  it('예빈 화면: 배우자는 찬우, 분담 내 몫은 40%(합류 중에도)', () => {
    const c = coupleOf(yebin, space, chanwoo);
    expect(c).toMatchObject({
      starter: false,
      partnerName: '찬우',
      partnerIncome: 350 * M,
      myRatio: 40,
      myIncome: 270 * M,
    });
  });
  it('말일이 가장 늦다', () => {
    const c = coupleOf(
      { ...chanwoo, payday: null, payday_last: true },
      { ...space, couple_state: 'connected' },
      yebin,
    );
    expect(coupleBaseDay(c)).toBe('last');
  });
});
