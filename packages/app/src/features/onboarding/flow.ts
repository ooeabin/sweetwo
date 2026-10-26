import { skipsTopGoalQuestions, templateByKey } from '@sweetwo/core';
import type { Goal, Me, Space } from './data';

// 온보딩 화면 순서(docs/spec/16-onboarding-1.md 흐름 요약, 재기획 ADR 0003). 답에 따라 목록이 바뀐다.
// 화면 id는 경로에 그대로: /onboarding/o-10, O-23은 질문마다 o-23-1, o-23-2 …
export const AUTO_GOALS = ['emergency'];

export interface FlowState {
  me: Me | null | undefined;
  space: Space | null | undefined;
  /** 합류한 배우자(합류 전 null) */
  partner?: {
    id: string;
    nickname: string | null;
    monthly_income: number | null;
    allowance: number | null;
  } | null;
  goals: Goal[] | undefined;
  inviteNow: 'now' | 'later' | null;
}

/** 고른 목표(자동 목표 제외), 우선순위 순 */
export const pickedGoals = (goals: Goal[] | undefined) =>
  (goals ?? []).filter((g) => !AUTO_GOALS.includes(g.template));
export const topGoal = (goals: Goal[] | undefined) => pickedGoals(goals)[0];

/** O-10 → O-03 → O-06 (→ O-07) → O-11 → O-12 → O-13 → O-21 → O-23 → O-24 → O-30 → O-31 → O-50 → O-60 */
export function screens(s: FlowState): string[] {
  // 연결 해제 뒤 다시(16 흐름 요약): O-11부터, O-10·O-03·O-06 건너뜀, O-13 출생연도는 남아 있으면 건너뜀
  const afterUnlink = !!s.space?.unlinked_from;
  const list = afterUnlink ? [] : ['o-10', 'o-03', 'o-06'];
  if (!afterUnlink && s.inviteNow === 'now') list.push('o-07');
  list.push('o-11', 'o-12');
  if (!(afterUnlink && s.me?.birth_year)) list.push('o-13');
  list.push('o-21');
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
/** 뒤로. O-10, O-60, 목록 첫 화면(연결 해제 뒤 O-11)은 뒤로 없음 */
export const prevOf = (id: string, list: string[]) => {
  if (id === 'o-10' || id === LAST || list.indexOf(id) <= 0) return undefined;
  return list[list.indexOf(id) - 1];
};

/** 배우자가 합류했는지 */
export const partnerJoined = (s: FlowState) => s.space?.couple_state === 'connected';
