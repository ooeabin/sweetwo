import { updateGoal } from '@sweetwo/api';
import {
  allocate,
  currentCycle,
  dateToYm,
  defaultBaseDay,
  diagnose,
  emergencyBase,
  planSummary,
  splitShares,
  type AllocGoal,
  type BaseDay,
  type PlanInput,
  type PlanParts,
  type SplitMode,
} from '@sweetwo/core';
import { copy } from './copy';
import type { Goal } from './data';
import { isSeparate, partnerJoined, planInput, type FlowState } from './flow';

// 결과 화면(O-61~65) 계산 묶음. 계산 규칙은 core(06 3·4·8장), 여기서는 답을 모아 넘기기만 한다.

export const toAllocGoal = (g: Goal): AllocGoal => ({
  id: g.id,
  template: g.template,
  name: g.name,
  kind: g.kind,
  priority: g.priority,
  target: g.target_amount,
  held: g.other_held,
  deadline: g.deadline ? dateToYm(g.deadline) : null,
  afterMarriage: g.after_marriage,
  paused: g.status === 'paused',
});

/** 비상금 기준(배우자 일 형태는 합류 뒤에 알 수 있어 지금은 내 것만) */
export function emergencyTarget(s: FlowState) {
  const sp = s.space;
  return emergencyBase({
    fixed: (sp?.fixed_total ?? 0) + (sp?.loan_repayment ?? 0),
    living: sp?.living_budget ?? 0,
    employments: [s.me?.employment],
  });
}

/** 비상금 목표 금액을 지금 답에 맞춤(O-61, 결과 화면에서 답을 고치고 왔을 때) */
export async function syncEmergency(s: FlowState) {
  const g = s.goals?.find((x) => x.template === 'emergency');
  const base = emergencyTarget(s).amount;
  if (!g || base <= 0) return false;
  const estimated = !!(s.space?.fixed_total_estimated || s.space?.living_budget_estimated);
  if (g.target_amount === base && g.amount_estimated === estimated) return false;
  await updateGoal(g.id, { target_amount: base, amount_estimated: estimated });
  return true;
}

/** ‘임시 플랜’ 사유(O-66 표). 없으면 null */
export function tempReason(s: FlowState): string | null {
  const sp = s.space;
  if (!sp || sp.couple_state === 'solo') return null;
  if (!partnerJoined(s)) return copy.tempJoin(sp.partner_nickname ?? '');
  const estimated =
    sp.partner_income_estimated ||
    sp.fixed_total_estimated ||
    sp.living_budget_estimated ||
    sp.wedding_budget_estimated ||
    sp.wedding_date_estimated;
  return estimated ? copy.tempEstimates : null;
}

/** 결과 계산 입력. 온보딩은 답(합류 전 추정), 합류 뒤 다시 보기는 두 사람 실제 값 */
export interface CalcInput {
  plan: PlanInput;
  goals: Goal[];
  /** 비상금 기준(정규직만이면 3개월) */
  employments: (string | null | undefined)[];
  separate: boolean;
  split: { mode: SplitMode; myRatio: number; myIncome: number; partnerIncome: number };
}

/** O-62~65 숫자: 플랜 요약, 목표 배분, 진단, 통장별 월 금액, 각자 옮길 돈 */
export function calc(i: CalcInput) {
  const plan = planSummary(i.plan);
  const alloc = allocate(plan.saveable, i.goals.map(toAllocGoal));
  const fixed = (i.plan.fixedTotal ?? 0) + (i.plan.loanRepayment ?? 0);
  const base = emergencyBase({
    fixed,
    living: i.plan.livingBudget ?? 0,
    employments: i.employments,
  });
  const diag = diagnose({
    income: plan.income,
    saving: Math.max(plan.saveable, 0),
    emergencyBalance: null, // 자산은 첫 주 2일째에 받음
    emergencyBase: base.amount,
    loanRepayment: i.plan.loanRepayment ?? 0,
    fixed,
    invest: null, // 투자 원칙은 첫 주 7일째(O-53)
  });
  // 각자 관리 예비부부는 목표자금 자리에 결혼 비용
  const wedding = alloc.lines.find((l) => l.goal.template === 'wedding');
  const parts: PlanParts = i.separate
    ? { living: 0, goalFund: wedding?.need ?? 0, emergency: 0 }
    : { living: plan.sharedLiving, goalFund: alloc.goals, emergency: alloc.emergency };
  const shares = splitShares({
    total: parts.living + parts.goalFund + parts.emergency,
    ...i.split,
  });
  return { plan, alloc, diag, fixed, parts, shares, separate: i.separate };
}

/** 온보딩 답 → 계산 입력 */
export const flowInput = (s: FlowState): CalcInput => ({
  plan: planInput(s),
  goals: s.goals ?? [],
  employments: [s.me?.employment],
  separate: isSeparate(s),
  split: splitOf(s),
});

export function result(s: FlowState) {
  const sp = s.space;
  const estimated = !!(
    sp?.partner_income_estimated ||
    sp?.fixed_total_estimated ||
    sp?.living_budget_estimated
  );
  return { ...calc(flowInput(s)), estimated, temp: tempReason(s) };
}

/** 기준일: 정해 둔 값, 없으면 두 월급날 중 늦은 날(합류 전은 내 월급날) */
export function baseDayOf(s: FlowState): BaseDay | null {
  const sp = s.space;
  if (sp?.base_day_last) return 'last';
  if (sp?.base_day) return sp.base_day;
  const mine: BaseDay | null = s.me?.payday_last ? 'last' : (s.me?.payday ?? null);
  return defaultBaseDay([mine]);
}
export const myPaydayOf = (s: FlowState): BaseDay | null =>
  s.me?.payday_last ? 'last' : (s.me?.payday ?? null);

export const cycleOf = (s: FlowState, now = new Date()) => {
  const b = baseDayOf(s);
  return b === null ? null : currentCycle(b, now);
};

/** 한 달 통장별 금액(공동 생활비, 목표자금, 비상금). 각자 관리 예비부부는 목표자금 자리에 결혼 비용 */
export const monthlyParts = (s: FlowState): PlanParts => calc(flowInput(s)).parts;

/** 나누기 방식: 배우자 수입을 모르거나 ‘나중에 할게요’면 반반(17 O-66 표) */
export function splitOf(s: FlowState) {
  const sp = s.space;
  const unknown = !!sp?.partner_income_unknown;
  let mode: SplitMode = sp?.split_mode ?? 'half';
  if (sp?.split_deferred || (unknown && mode === 'income')) mode = 'half';
  return {
    mode,
    myRatio: sp?.split_ratio ?? 50,
    myIncome: s.me?.monthly_income ?? 0,
    partnerIncome: unknown ? 0 : (sp?.partner_income ?? 0),
  };
}

/** 통장별 줄 키 → 통장 역할 */
export const roleOfPart = (key: keyof PlanParts, separate: boolean) =>
  key === 'living'
    ? 'living'
    : key === 'emergency'
      ? 'emergency'
      : separate
        ? 'wedding'
        : 'goal_fund';
