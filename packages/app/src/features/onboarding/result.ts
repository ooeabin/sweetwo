import { updateGoal } from '@sweetwo/api';
import {
  allocate,
  dateToYm,
  diagnose,
  emergencyBase,
  planSummary,
  type AllocGoal,
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

export function result(s: FlowState) {
  const sp = s.space;
  const plan = planSummary(planInput(s));
  const goals = (s.goals ?? []).map(toAllocGoal);
  const alloc = allocate(plan.saveable, goals);
  const fixed = (sp?.fixed_total ?? 0) + (sp?.loan_repayment ?? 0);
  const base = emergencyTarget(s);
  const diag = diagnose({
    income: plan.income,
    saving: Math.max(plan.saveable, 0),
    emergencyBalance: null, // 자산은 첫 주 2일째에 받음
    emergencyBase: base.amount,
    loanRepayment: sp?.loan_repayment ?? 0,
    fixed,
    invest: null, // 투자 원칙은 첫 주 7일째(O-53)
  });
  const estimated = !!(
    sp?.partner_income_estimated ||
    sp?.fixed_total_estimated ||
    sp?.living_budget_estimated
  );
  return {
    plan,
    alloc,
    diag,
    fixed,
    estimated,
    separate: isSeparate(s),
    temp: tempReason(s),
  };
}
