import { skipsTopGoalQuestions, templateByKey } from '@sweetwo/core';
import type { Goal, Me, Space } from './data';

// 온보딩 ① 화면 순서(docs/spec/16-onboarding-1.md 흐름 요약). 답에 따라 목록이 바뀐다.
// 화면 id는 경로에 그대로: /onboarding/o-03, O-23은 질문마다 o-23-1, o-23-2 …
export const AUTO_GOALS = ['emergency', 'wedding'];

export interface FlowState {
  me: Me | null | undefined;
  space: Space | null | undefined;
  goals: Goal[] | undefined;
  inviteNow: 'now' | 'later' | null;
}

export const isEngaged = (s: FlowState) => s.space?.marriage_status === 'engaged';
export const isSeparate = (s: FlowState) => isEngaged(s) && s.space?.prep_money_mode === 'separate';
/** 고른 목표(자동 목표 제외), 우선순위 순 */
export const pickedGoals = (goals: Goal[] | undefined) =>
  (goals ?? []).filter((g) => !AUTO_GOALS.includes(g.template));
export const topGoal = (goals: Goal[] | undefined) => pickedGoals(goals)[0];

/** 파트 0~5 화면 목록(파트 4는 첫 주 할 일이라 없음) */
export function screens(s: FlowState): string[] {
  const list = ['o-03', 'o-04', 'o-05', 'o-06'];
  if (s.inviteNow === 'now') list.push('o-07');
  list.push('o-10', 'o-11', 'o-12', 'o-13', 'o-15', 'o-16', 'o-18');
  if (isEngaged(s)) list.push('o-19a', 'o-19b', 'o-19c', 'o-19d', 'o-19e');
  list.push('o-20', 'o-21');
  const top = topGoal(s.goals);
  if (top && !skipsTopGoalQuestions(top.template, isSeparate(s))) {
    const t = templateByKey(top.template);
    t?.questions.forEach((_, i) => list.push(`o-23-${i + 1}`));
    if (t?.asksDeadline((top.details ?? {}) as Record<string, never>)) list.push('o-24');
  }
  // 파트 3 소득·지출(docs/spec/17-onboarding-2.md 흐름 요약). 각자 관리 예비부부는 O-36~39, O-51 건너뜀.
  list.push('o-31', 'o-32', 'o-33');
  if (!isSeparate(s)) {
    list.push('o-36');
    if (s.space?.fixed_total !== 0) list.push('o-36t'); // ‘해당 없어요’면 합계 질문 없음
    list.push('o-38', 'o-39', 'o-51');
  }
  // 파트 5 분담
  list.push('o-52');
  return list;
}

/** 파트 6 결과 첫 화면(다음 단계에서 만듦) */
export const PART6_START = 'o-61';

/** 6칸 진행 막대: 파트 0 = 1칸, 1 = 2칸, 2 = 3칸, 3 = 4칸, 5 = 5칸(파트 4 칸 없음) */
const partOf = (id: string) =>
  id < 'o-10' ? 0 : id < 'o-20' ? 1 : id < 'o-30' ? 2 : id < 'o-50' ? 3 : 4;
export function progress(id: string, list: string[]) {
  const part = partOf(id);
  const inPart = list.filter((x) => partOf(x) === part);
  const i = Math.max(inPart.indexOf(id), 0);
  return { total: 6, now: part, fill: Math.round(((i + 1) / (inPart.length + 1)) * 100) };
}

export const nextOf = (id: string, list: string[]) => list[list.indexOf(id) + 1] ?? PART6_START;
export const prevOf = (id: string, list: string[]) => {
  const i = list.indexOf(id);
  return i > 0 ? list[i - 1] : undefined;
};

/** 계산 입력(packages/core planSummary). 합류 전 배우자 용돈 = 내 용돈 */
export const planInput = (s: FlowState) => ({
  myIncome: s.me?.monthly_income ?? null,
  partnerIncome: s.space?.partner_income ?? null,
  partnerUnknown: s.space?.partner_income_unknown ?? false,
  myAllowance: s.me?.allowance ?? null,
  fixedTotal: s.space?.fixed_total ?? null,
  loanRepayment: s.space?.loan_repayment ?? null,
  livingBudget: s.space?.living_budget ?? null,
});
/** 이상값 확인용 월 수입 합계(배우자 추정 포함) */
export const monthIncome = (s: FlowState) =>
  (s.me?.monthly_income ?? 0) +
  (s.space?.partner_income_unknown ? 0 : (s.space?.partner_income ?? 0));

/** 배우자가 합류했는지 */
export const partnerJoined = (s: FlowState) => s.space?.couple_state === 'connected';
