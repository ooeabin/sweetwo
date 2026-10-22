import { skipsTopGoalQuestions, templateByKey } from '@sweetwo/core';
import type { Goal, Me, Space } from './data';

// 온보딩 ① 화면 순서(docs/spec/16-onboarding-1.md 흐름 요약). 답에 따라 목록이 바뀐다.
// 화면 id는 경로에 그대로: /onboarding/o-10, O-23은 질문마다 o-23-1, o-23-2 …
export const AUTO_GOALS = ['emergency', 'wedding'];

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

/** 파트 0~5 화면 목록(파트 4는 첫 주 할 일이라 없음). 맨 앞 O-10은 챕터 4개 안내 */
export function screens(s: FlowState): string[] {
  const list = ['o-10', 'o-03', 'o-04', 'o-05', 'o-06'];
  if (s.inviteNow === 'now') list.push('o-07');
  list.push('o-11', 'o-12', 'o-13', 'o-15', 'o-16', 'o-18');
  if (isEngaged(s)) list.push('o-19a', 'o-19b', 'o-19c', 'o-19d', 'o-19e');
  list.push('o-20', 'o-21');
  const top = topGoal(s.goals);
  if (top && !skipsTopGoalQuestions(top.template, isSeparate(s))) {
    const t = templateByKey(top.template);
    t?.questions.forEach((_, i) => list.push(`o-23-${i + 1}`));
    if (t?.asksDeadline((top.details ?? {}) as Record<string, never>)) list.push('o-24');
  }
  // 파트 3 소득·지출(docs/spec/17-onboarding-2.md 흐름 요약). 각자 관리 예비부부는 O-36~39, O-51 건너뜀.
  list.push('o-30', 'o-31', 'o-32');
  if (!partnerJoined(s)) list.push('o-33'); // 배우자가 이미 합류했으면 배우자 수입은 배우자가 답함
  if (!isSeparate(s)) {
    list.push('o-36');
    if (s.space?.fixed_total !== 0) list.push('o-36t'); // ‘해당 없어요’면 합계 질문 없음
    list.push('o-38', 'o-39');
  }
  // 챕터 4 나누기와 플랜: 용돈(각자 관리 예비부부 없음), 분담, 결과
  list.push('o-50');
  if (!isSeparate(s)) list.push('o-51');
  list.push('o-52');
  // 파트 6 결과 → 이번 달
  list.push('o-61', 'o-62', 'o-63', 'o-64', 'o-65', 'o-66', 'o-67');
  return list;
}

/** 파트 6 결과 첫 화면 */
export const PART6_START = 'o-61';
/** 마지막 화면(O-67 첫 미션). 여기서 온보딩을 마친다 */
export const LAST = 'o-67';

/** 챕터 4개(docs/spec/16-onboarding-1.md 흐름 요약). 챕터 시작 = O-{n}0(챕터 1은 O-10 전체 안내가 대신) */
export const CHAPTERS = ['우리 소개', '목표', '수입과 지출', '나누기와 플랜'] as const;
/** 화면 → 챕터(0부터). O-03~O-19e 우리 소개, O-20~O-24 목표, O-30~O-39 수입과 지출, O-50 이후 나누기와 플랜 */
export const chapterOf = (id: string) => (id < 'o-20' ? 0 : id < 'o-30' ? 1 : id < 'o-50' ? 2 : 3);
/** 챕터 진행: 챕터 안에서만 차는 막대. 챕터 시작 0%, 결과(O-61~)는 막대 없이 “4/4 나누기와 플랜”만. O-10은 표시 없음 */
export function chapterProgress(id: string, list: string[]) {
  if (id === 'o-10') return undefined;
  const ch = chapterOf(id);
  const base = { index: ch + 1, total: CHAPTERS.length, name: CHAPTERS[ch] ?? '' };
  if (id >= 'o-60') return { ...base, fill: null }; // 결과 7장은 막대 없이 글자만
  const inCh = list.filter((x) => chapterOf(x) === ch && x < 'o-60');
  const i = Math.max(inCh.indexOf(id), 0);
  return { ...base, fill: inCh.length ? (i / inCh.length) * 100 : 0 };
}

export const nextOf = (id: string, list: string[]) => list[list.indexOf(id) + 1] ?? LAST;
/** 뒤로. O-61(분석 중)은 건너뛴다(고치고 오면 O-61 없이 재계산) */
export const prevOf = (id: string, list: string[]) => {
  const back = list.slice(0, Math.max(list.indexOf(id), 0)).filter((x) => x !== PART6_START);
  // O-67(첫 미션)부터는 뒤로 없음
  return id === PART6_START || id === LAST ? undefined : back[back.length - 1];
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
