import { skipsTopGoalQuestions, templateByKey } from '@sweetwo/core';
import type { Goal, Me, Space } from './data';

// 온보딩 화면 순서(docs/spec/16-onboarding-1.md 흐름 요약, 재기획 ADR 0003). 답에 따라 목록이 바뀐다.
// 화면 id는 경로에 그대로: /onboarding/o-10, O-23은 질문마다 o-23-1, o-23-2 …
export const AUTO_GOALS = ['emergency'];

export interface FlowState {
  me: Me | null | undefined;
  space: Space | null | undefined;
  /** 합류한 배우자(합류 전 null) */
  partner?: { monthly_income: number | null; allowance: number | null } | null;
  goals: Goal[] | undefined;
  inviteNow: 'now' | 'later' | null;
}

export const isEngaged = (s: FlowState) => s.space?.marriage_status === 'engaged';
export const isSeparate = (s: FlowState) => isEngaged(s) && s.space?.prep_money_mode === 'separate';
/** 고른 목표(자동 목표 제외), 우선순위 순 */
export const pickedGoals = (goals: Goal[] | undefined) =>
  (goals ?? []).filter((g) => !AUTO_GOALS.includes(g.template));
export const topGoal = (goals: Goal[] | undefined) => pickedGoals(goals)[0];

/** 시작한 사람이 온보딩 중에 배우자가 먼저 합류했으면 배우자 수입은 추정값 대신 배우자가 직접 답한 값(18 P-11 대기) */
export function joinedSpace(
  sp: Space | null | undefined,
  partner: FlowState['partner'],
): Space | null | undefined {
  if (!sp || sp.couple_state !== 'connected' || !partner) return sp;
  return {
    ...sp,
    partner_income: partner.monthly_income,
    partner_income_estimated: false,
    partner_income_unknown: partner.monthly_income === null,
  };
}

/** O-10 → O-03 → O-06 (→ O-07) → O-11 → O-12 → O-13 → O-21 → O-23 → O-24 → O-30 → O-31 → O-50 → O-60 */
export function screens(s: FlowState): string[] {
  const list = ['o-10', 'o-03', 'o-06'];
  if (s.inviteNow === 'now') list.push('o-07');
  list.push('o-11', 'o-12', 'o-13', 'o-21');
  const top = topGoal(s.goals);
  if (top && !skipsTopGoalQuestions(top.template)) {
    const t = templateByKey(top.template);
    t?.questions.forEach((_, i) => list.push(`o-23-${i + 1}`));
    if (t?.asksDeadline((top.details ?? {}) as Record<string, never>)) list.push('o-24');
  }
  list.push('o-30', 'o-31', 'o-50', 'o-60');
  return list;
}

/** 마지막 화면(O-60 결과). 여기서 온보딩을 마친다 */
export const LAST = 'o-60';

/** 진행 막대 하나(챕터 없음): O-03~O-50 질문 중 지금까지. O-10, O-60은 없음 */
export function progressOf(id: string, list: string[]) {
  if (id === 'o-10' || id === LAST) return undefined;
  const qs = list.filter((x) => x !== 'o-10' && x !== LAST);
  const done = Math.max(qs.indexOf(id), 0) + 1;
  return {
    index: 1,
    total: 1,
    name: '',
    fill: (done / qs.length) * 100,
    steps: { total: qs.length, done },
  };
}

export const nextOf = (id: string, list: string[]) => list[list.indexOf(id) + 1] ?? LAST;
/** 뒤로. O-10, O-60은 뒤로 없음 */
export const prevOf = (id: string, list: string[]) => {
  if (id === 'o-10' || id === LAST) return undefined;
  return list[list.indexOf(id) - 1];
};

/** 계산 입력(packages/core planSummary). 합류 전 배우자 용돈 = 내 용돈 */
export const planInput = (s: FlowState) => ({
  myIncome: s.me?.monthly_income ?? null,
  partnerIncome: s.space?.partner_income ?? null,
  partnerUnknown: s.space?.partner_income_unknown ?? false,
  myAllowance: s.me?.allowance ?? null,
  // 합류 전에는 배우자 용돈 = 내 용돈, 합류했으면 배우자가 정한 용돈
  partnerAllowance: partnerJoined(s) ? (s.partner?.allowance ?? null) : undefined,
  fixedTotal: s.space?.fixed_total ?? null,
  loanRepayment: s.space?.loan_repayment ?? null,
  livingBudget: s.space?.living_budget ?? null,
  mySharePct: s.space?.split_mode === 'custom' ? (s.space.split_ratio ?? 50) : 50,
});
/** 이상값 확인용 월 수입 합계(배우자 추정 포함) */
export const monthIncome = (s: FlowState) =>
  (s.me?.monthly_income ?? 0) +
  (s.space?.partner_income_unknown ? 0 : (s.space?.partner_income ?? 0));

/** 배우자가 합류했는지 */
export const partnerJoined = (s: FlowState) => s.space?.couple_state === 'connected';
