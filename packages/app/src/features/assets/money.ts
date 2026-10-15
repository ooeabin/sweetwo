import type { Me, PartnerProfile, Space } from '@sweetwo/api';
import { coupleOf, planSummary } from '@sweetwo/core';

// F-05 계산: 지금 값(또는 고친 값)으로 월 수입, 지출, 저축 가능 금액(core planSummary, 06 3장)
export interface MoneyPatch {
  myIncome?: number;
  myAllowance?: number;
  fixedTotal?: number;
  loanRepayment?: number;
  livingBudget?: number;
}

export function moneyPlan(
  me: Me,
  space: Space,
  partner: PartnerProfile | null,
  patch: MoneyPatch = {},
) {
  const c = coupleOf(me, space, partner);
  const myAllowance = patch.myAllowance ?? c.myAllowance;
  const sum = planSummary({
    myIncome: patch.myIncome ?? c.myIncome,
    partnerIncome: c.partnerIncome,
    partnerUnknown: c.partnerUnknown,
    myAllowance,
    partnerAllowance: c.partnerAllowance,
    fixedTotal: patch.fixedTotal ?? space.fixed_total,
    loanRepayment: patch.loanRepayment ?? space.loan_repayment,
    livingBudget: patch.livingBudget ?? space.living_budget,
    mySharePct: space.split_mode === 'custom' ? c.myRatio : 50,
  });
  return { couple: c, sum, myAllowance, partnerAllowance: c.partnerAllowance ?? myAllowance };
}
