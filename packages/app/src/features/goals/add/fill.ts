import { qk, updateGoal } from '@sweetwo/api';
import { templateByKey, ymToDate, type Json } from '@sweetwo/core';
import type { QueryClient } from '@tanstack/react-query';
import type { AddDraft } from './draft';

/** 금액 정하기 저장: 템플릿 답으로 목표 금액, 종류, 기한만 바꿈(이름, 주인, 우선순위는 그대로) */
export async function saveFill(d: AddDraft, qc: QueryClient) {
  const t = d.template ? templateByKey(d.template) : undefined;
  if (!t || !d.fillGoalId) return;
  const a = d.answers;
  const deadline = t.asksDeadline(a) ? d.deadline : t.defaultDeadline(a, {}).value;
  const estimated = t.asksDeadline(a) ? d.deadlineEstimated : t.defaultDeadline(a, {}).estimated;
  await updateGoal(d.fillGoalId, {
    kind: t.kind(a),
    target_amount: t.target(a),
    deadline: deadline ? ymToDate(deadline) : null,
    deadline_estimated: estimated,
    amount_estimated: Object.entries(a).some(([k, v]) => k.endsWith('_estimated') && v === true),
    details: a as NonNullable<Json>,
  });
  await Promise.all([qk.goals, qk.splits].map((k) => qc.invalidateQueries({ queryKey: k })));
}
