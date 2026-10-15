import { templateByKey, type GoalTemplate } from '@sweetwo/core';
import type { AddDraft } from './draft';

// 목표 추가 화면 순서(G-03a → b 질문들 → c 기한 → d 모아둔 돈 → e 담당 → f 확인).
// 기한은 템플릿이 묻는 경우만(아니면 기본 기한), 모아둔 돈은 매달 목표·고금리 대출 빼고(O-25 규칙), 담당은 연결된 부부만.
export const addPath = (step = '') => (step ? `/goals/new/${step}` : '/goals/new');

export function addSteps(d: AddDraft, connected: boolean): string[] {
  const t = d.template ? templateByKey(d.template) : undefined;
  if (!t) return ['g-03a'];
  return [
    'g-03a',
    ...t.questions.map((_, i) => `q${i + 1}`),
    ...(t.asksDeadline(d.answers) ? ['deadline'] : []),
    ...(t.kind(d.answers) === 'monthly' || t.key === 'high_interest_loan' ? [] : ['held']),
    ...(connected ? ['owner'] : []),
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
