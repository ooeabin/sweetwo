import type { Goal } from '@sweetwo/api';
import { templateByKey, ymToDate, type Json } from '@sweetwo/core';
import type { AddDraft } from './draft';
import { draftName } from './flow';

/** 추가할 목표 값(바로 추가, goal_add 제안 공통). 우선순위는 맨 아래 */
export function addPayload(d: AddDraft, connected: boolean) {
  const t = d.template ? templateByKey(d.template) : undefined;
  if (!t) return null;
  const a = d.answers;
  const deadline = t.asksDeadline(a) ? d.deadline : t.defaultDeadline(a, {}).value;
  const deadlineEstimated = t.asksDeadline(a)
    ? d.deadlineEstimated
    : t.defaultDeadline(a, {}).estimated;
  return {
    template: t.key,
    name: draftName(d),
    kind: t.kind(a),
    target_amount: t.target(a),
    deadline: deadline ? ymToDate(deadline) : null,
    deadline_estimated: deadlineEstimated,
    amount_estimated: Object.entries(a).some(([k, v]) => k.endsWith('_estimated') && v === true),
    other_held: typeof d.held === 'number' ? d.held : 0,
    owner: connected ? (d.owner ?? 'together') : ('me' as const),
    details: a as NonNullable<Json>,
  };
}

/** 미리보기 계산용 임시 목표 행 */
export function previewGoal(
  p: NonNullable<ReturnType<typeof addPayload>>,
  o: { spaceId: string; me: string; priority: number },
): Goal {
  const now = new Date().toISOString();
  return {
    ...p,
    id: 'new',
    space_id: o.spaceId,
    priority: o.priority,
    status: 'active',
    after_marriage: false,
    created_at: now,
    updated_at: now,
    created_by: o.me,
    updated_by: o.me,
    deleted_at: null,
    deleted_by: null,
    version: 1,
  } as Goal;
}
