import { describe, expect, it } from 'vitest';
import { fixedGroups } from './expenses';
import { DEFAULT_ALLOWANCE, planSummary, splitShares } from './plan';

const M = 10_000;

describe('월 수입과 공동자금(06 3·4장)', () => {
  it('온보딩 ② 예시: 찬우 350, 예빈 추정 250, 고정 100 + 대출 30, 생활비 130, 용돈 각자 50 → 공동자금 500만', () => {
    const r = planSummary({
      myIncome: 350 * M,
      partnerIncome: 250 * M,
      partnerUnknown: false,
      myAllowance: 50 * M,
      fixedTotal: 100 * M,
      loanRepayment: 30 * M,
      livingBudget: 130 * M,
    });
    expect(r).toEqual({
      income: 600 * M,
      allowances: 100 * M,
      sharedLiving: 260 * M,
      saveable: 240 * M,
      commonFund: 500 * M,
    });
  });
  it('배우자 수입을 모르면 내 몫 기준(배우자 수입, 용돈 0)', () => {
    const r = planSummary({
      myIncome: 350 * M,
      partnerIncome: null,
      partnerUnknown: true,
      myAllowance: 50 * M,
      fixedTotal: 0,
      loanRepayment: 0,
      livingBudget: 100 * M,
    });
    expect(r.income).toBe(350 * M);
    expect(r.allowances).toBe(50 * M);
  });
  it('용돈을 안 정했으면 50만 원 가정, 모을 돈이 없으면 공동자금 = 생활비만', () => {
    const r = planSummary({
      myIncome: 200 * M,
      partnerIncome: 0,
      partnerUnknown: false,
      myAllowance: null,
      fixedTotal: 100 * M,
      loanRepayment: 0,
      livingBudget: 100 * M,
    });
    expect(r.allowances).toBe(2 * DEFAULT_ALLOWANCE);
    expect(r.saveable).toBeLessThan(0);
    expect(r.commonFund).toBe(200 * M);
  });
});

describe('분담(O-52)', () => {
  it('버는 만큼: 350 : 250, 공동자금 500만 → 찬우 292만, 예빈 208만', () => {
    expect(
      splitShares({ total: 500 * M, mode: 'income', myIncome: 350 * M, partnerIncome: 250 * M }),
    ).toMatchObject({ me: 292 * M, partner: 208 * M });
  });
  it('직접 60 : 40, 520만 → 312만, 208만(합류 예시)', () => {
    expect(
      splitShares({
        total: 520 * M,
        mode: 'custom',
        myRatio: 60,
        myIncome: 350 * M,
        partnerIncome: 270 * M,
      }),
    ).toMatchObject({ me: 312 * M, partner: 208 * M });
  });
  it('각자 1만 원 단위 반올림, 모자라면 수입 많은 쪽에 더함', () => {
    // 2,507,500씩 → 반올림 251만씩(합계가 공동자금 이상이라 그대로)
    expect(
      splitShares({ total: 5_015_000, mode: 'half', myIncome: 300 * M, partnerIncome: 350 * M }),
    ).toMatchObject({ me: 2_510_000, partner: 2_510_000 });
    // 2,502,000씩 → 250만씩, 4,000원 모자람 → 수입 많은 예빈에게
    expect(
      splitShares({ total: 5_004_000, mode: 'half', myIncome: 300 * M, partnerIncome: 350 * M }),
    ).toMatchObject({ me: 250 * M, partner: 2_504_000 });
  });
  it('둘 다 수입 0원이면 50:50, 버는 만큼에서 한쪽 0원이면 0:100', () => {
    expect(
      splitShares({ total: 100 * M, mode: 'income', myIncome: 0, partnerIncome: 0 }),
    ).toMatchObject({ me: 50 * M, partner: 50 * M });
    expect(
      splitShares({ total: 100 * M, mode: 'income', myIncome: 0, partnerIncome: 300 * M }),
    ).toMatchObject({ me: 0, partner: 100 * M });
  });
});

describe('고정지출 분류', () => {
  it('O-36 그룹 칩 8개, 대출 그룹은 없음', () => {
    expect(fixedGroups.map((g) => g.name)).toEqual([
      '주거',
      '공과금',
      '통신',
      '보험',
      '구독',
      '교통',
      '아이',
      '정기 지원',
    ]);
  });
});
