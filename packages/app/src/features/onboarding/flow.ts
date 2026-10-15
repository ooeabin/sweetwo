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

/** 파트 0~2 화면 목록 */
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
  return list;
}

/** 파트 3 첫 화면(온보딩 ②, 다음 단계에서 만듦) */
export const PART3_START = 'o-31';

/** 6칸 진행 막대: 파트 0 = 1칸, 파트 1 = 2칸, 파트 2 = 3칸 */
export function progress(id: string, list: string[]) {
  const part = id < 'o-10' ? 0 : id < 'o-20' ? 1 : 2;
  const inPart = list.filter((x) => (x < 'o-10' ? 0 : x < 'o-20' ? 1 : 2) === part);
  const i = Math.max(inPart.indexOf(id), 0);
  return { total: 6, now: part, fill: Math.round(((i + 1) / (inPart.length + 1)) * 100) };
}

export const nextOf = (id: string, list: string[]) => list[list.indexOf(id) + 1] ?? PART3_START;
export const prevOf = (id: string, list: string[]) => {
  const i = list.indexOf(id);
  return i > 0 ? list[i - 1] : undefined;
};
