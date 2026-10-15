import type { Won } from '../money';

// 월 수입, 저축 가능 금액, 공동자금, 분담(docs/spec/06-calc-allocation.md 3·4장, 17-onboarding-2.md O-52)
const M = 10_000;
/** 내 용돈을 아직 안 정했을 때 가정값(O-52 ‘나중에 할게요’) */
export const DEFAULT_ALLOWANCE: Won = 50 * M;

export interface PlanInput {
  myIncome: Won | null;
  /** 배우자 수입(합류 전 추정). unknown이면 ‘{나}님 몫’ 기준 */
  partnerIncome: Won | null;
  partnerUnknown: boolean;
  myAllowance: Won | null;
  /** 합류 전에는 배우자 용돈 = 내 용돈으로 계산 */
  partnerAllowance?: Won | null;
  fixedTotal: Won | null;
  loanRepayment: Won | null;
  livingBudget: Won | null;
}

export interface PlanSummary {
  income: Won;
  allowances: Won;
  /** 공동 생활비 = 고정지출(대출 상환 포함) + 생활비 예산 */
  sharedLiving: Won;
  /** 저축 가능 금액 = 월 수입 − 용돈 − 고정지출 − 생활비(음수 가능) */
  saveable: Won;
  /** 공동자금 = 공동 생활비 + 목표자금 + 비상금(모을 돈이 없으면 생활비만) */
  commonFund: Won;
}

export function planSummary(i: PlanInput): PlanSummary {
  const mine = i.myIncome ?? 0;
  const partner = i.partnerUnknown ? 0 : (i.partnerIncome ?? 0);
  const myAllowance = i.myAllowance ?? DEFAULT_ALLOWANCE;
  const partnerAllowance = i.partnerUnknown ? 0 : (i.partnerAllowance ?? myAllowance);
  const income = mine + partner;
  const allowances = myAllowance + partnerAllowance;
  const sharedLiving = (i.fixedTotal ?? 0) + (i.loanRepayment ?? 0) + (i.livingBudget ?? 0);
  const saveable = income - allowances - sharedLiving;
  return {
    income,
    allowances,
    sharedLiving,
    saveable,
    commonFund: sharedLiving + Math.max(saveable, 0),
  };
}

export type SplitMode = 'half' | 'income' | 'custom';

/**
 * 분담액(06 4장): 반반 ÷ 2 / 버는 만큼 실수령 비율 / 직접 비율. 1만 원 단위 반올림, 끝전은 수입 많은 쪽.
 * 두 사람 다 수입 0원이면 50:50. 버는 만큼에서 한쪽 0원이면 0 : 100.
 */
export function splitShares(o: {
  total: Won;
  mode: SplitMode;
  myIncome: Won;
  partnerIncome: Won;
  myRatio?: number;
}) {
  const { total, myIncome, partnerIncome } = o;
  let myPct: number;
  if (o.mode === 'custom') myPct = o.myRatio ?? 50;
  else if (o.mode === 'income' && myIncome + partnerIncome > 0)
    myPct = (myIncome * 100) / (myIncome + partnerIncome);
  else myPct = 50;
  // 각자 1만 원 단위 반올림. 합계가 공동자금보다 적으면 모자란 만큼 수입 많은 쪽에(배분은 필요액 이상)
  const round10k = (v: number) => Math.round(v / M) * M;
  let me = round10k((total * myPct) / 100);
  let partner = round10k((total * (100 - myPct)) / 100);
  const short = total - (me + partner);
  if (short > 0) {
    if (myIncome >= partnerIncome) me += short;
    else partner += short;
  }
  return { me, partner, myPct: Math.round(myPct) };
}
