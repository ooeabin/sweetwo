import { templateByKey, type GoalTemplate } from '@sweetwo/core';
import type { AddDraft } from './draft';

// 목표 추가 화면 순서(22: G-03a → e 누구 목표 → b 질문들 → c 기한 → d 이미 모은 돈 → f 확인).
// 누구 목표는 혼자 쓰기면 없음(내 목표). 기한은 템플릿이 묻는 경우만, 이미 모은 돈은 매달 목표·고금리 대출·결혼 비용(질문에 있음) 빼고.
export const addPath = (step = '') => (step ? `/goals/new/${step}` : '/goals/new');

export function addSteps(d: AddDraft, askOwner: boolean): string[] {
  const t = d.template ? templateByKey(d.template) : undefined;
  if (!t) return ['g-03a'];
  return [
    'g-03a',
    ...(askOwner ? ['owner'] : []),
    ...t.questions.map((_, i) => `q${i + 1}`),
    ...(t.asksDeadline(d.answers) ? ['deadline'] : []),
    ...(t.kind(d.answers) === 'monthly' || t.key === 'high_interest_loan' || t.held
      ? []
      : ['held']),
    'confirm',
  ];
}

export const templateOf = (d: AddDraft): GoalTemplate | undefined =>
  d.template ? templateByKey(d.template) : undefined;

/** 목표 이름: 직접 만들기는 첫 질문 답 */
export const draftName = (d: AddDraft) => {
  const t = templateOf(d);
  if (!t) return '';
  return t.key === 'custom' && typeof d.answers.name === 'string' ? d.answers.name : t.name;
};
