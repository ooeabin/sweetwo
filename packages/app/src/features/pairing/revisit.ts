import type { SplitMode } from '@sweetwo/core';
import { calc, onboardingCopy, type CalcInput } from '../onboarding';
import type { JoinData } from './data';

// 합류 뒤 O-63~65 다시 보기(18 P-11 8번). 지금 값 = 두 사람 실제 값, 이전 값 = 시작한 사람이 적은 추정(합류 전 계산).
// 확정 전 제안(P-07 용돈, P-08 분담)은 반영하지 않는다(제안이 적용되면 그때 바뀜).

const modeOf = (mode: SplitMode | null, deferred: boolean, unknown: boolean): SplitMode => {
  const m = deferred || !mode ? 'half' : mode;
  return unknown && m === 'income' ? 'half' : m;
};

export function revisit(d: JoinData) {
  const sp = d.space;
  const c = d.couple;
  const me = d.me;
  if (!sp || !c || !me) return null;
  const inputs = {
    fixedTotal: sp.fixed_total,
    loanRepayment: sp.loan_repayment,
    livingBudget: sp.living_budget,
  };
  const separate = sp.marriage_status === 'engaged' && sp.prep_money_mode === 'separate';
  const mode = modeOf(sp.split_mode, sp.split_deferred, c.partnerUnknown);

  const now: CalcInput = {
    plan: {
      myIncome: c.myIncome,
      partnerIncome: c.partnerIncome,
      partnerUnknown: c.partnerUnknown,
      myAllowance: c.myAllowance,
      partnerAllowance: c.partnerAllowance,
      ...inputs,
      mySharePct: c.myRatio,
    },
    goals: d.goals,
    employments: [me.employment, d.partner?.employment],
    separate,
    split: {
      mode,
      myRatio: c.myRatio,
      myIncome: c.myIncome ?? 0,
      partnerIncome: c.partnerIncome ?? 0,
    },
  };

  // 합류 전: 시작한 사람 기준(배우자 = 공간의 추정, 배우자 용돈 = 시작한 사람 용돈)
  const starter = c.starter ? me : d.partner;
  const unknownBefore = sp.partner_income_unknown;
  const starterIncome = starter?.monthly_income ?? 0;
  const estimate = unknownBefore ? 0 : (sp.partner_income ?? 0);
  const before: CalcInput = {
    plan: {
      myIncome: starter?.monthly_income ?? null,
      partnerIncome: sp.partner_income,
      partnerUnknown: unknownBefore,
      myAllowance: starter?.allowance ?? null,
      partnerAllowance: null,
      ...inputs,
      mySharePct: sp.split_ratio ?? 50,
    },
    goals: d.goals,
    employments: [starter?.employment],
    separate,
    split: {
      mode: modeOf(sp.split_mode, sp.split_deferred, unknownBefore),
      myRatio: sp.split_ratio ?? 50,
      myIncome: starterIncome,
      partnerIncome: estimate,
    },
  };

  const a = calc(now);
  const b = calc(before);
  // 이전 값의 ‘나’, ‘배우자’를 지금 보는 사람 기준으로
  const beforeShares = c.starter ? b.shares : { me: b.shares.partner, partner: b.shares.me };
  const estimated = !!(
    sp.fixed_total_estimated ||
    sp.living_budget_estimated ||
    sp.wedding_budget_estimated ||
    sp.wedding_date_estimated
  );
  return {
    now: a,
    before: { ...b, shares: beforeShares },
    mode,
    temp: estimated ? onboardingCopy.tempEstimates : null,
  };
}
