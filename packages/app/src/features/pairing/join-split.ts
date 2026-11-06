import { completeJoin, type Goal } from '@sweetwo/api';
import { jointRefill, joinerSplit, type SplitLineDraft } from '@sweetwo/core';
import { savingGoals, toAllocGoal, toDraft } from '../salary';
import type { JoinData } from './data';

type Snap = Pick<JoinData, 'me' | 'space' | 'partner' | 'splits' | 'resumed'> & { goals: Goal[] };

/**
 * 합류한 사람의 월급 계획 초안(18 P-06 규칙, O-50 추천과 같은 자리).
 * 각자: core joinerSplit(고정 25%, 생활 25%, 용돈 10%, 우리 목표에 아직 안 채운 월 필요액만큼).
 * 합쳐서: core jointRefill(있던 줄 그대로, 내 용돈 줄 + 늘어난 수입을 저금 줄 순서대로). 대기 뒤 이어서면 시작한 사람이 만든 그대로.
 */
export function joinDraft(x: Snap) {
  const me = x.me;
  if (!me || !x.space) return null;
  const joint = x.space.salary_mode === 'joint';
  const income = me.monthly_income ?? 0;
  const jointSplit = x.splits.find((s) => s.owner_user_id === null);
  if (joint) {
    const current = jointSplit ? toDraft(jointSplit.split_line) : [];
    const lines: SplitLineDraft[] = x.resumed
      ? current
      : jointRefill({ lines: current, income, userId: me.id, goals: x.goals.map(toAllocGoal) });
    return {
      joint,
      lines,
      current,
      version: jointSplit?.version,
      others: {} as Record<string, number>,
    };
  }
  const theirs = x.splits.find((s) => s.owner_user_id === x.partner?.id);
  const others: Record<string, number> = Object.fromEntries(
    (theirs?.split_line ?? [])
      .filter((l) => l.kind === 'saving' && l.goal_id)
      .map((l) => [l.goal_id ?? '', l.amount]),
  );
  const lines = joinerSplit({
    income,
    userId: me.id,
    // 우리 목표만(시작한 사람의 내 목표는 줄이 없음)
    goals: savingGoals(x.goals, me.id)
      .filter((g) => g.owner_user_id === null)
      .map(toAllocGoal),
    others,
  });
  return { joint, lines, current: [] as SplitLineDraft[], version: undefined, others };
}

/**
 * 합류 마치기(2026-11-03, 온보딩 ADR 0005처럼 월급 계획 화면 없이 추천으로 저장 → 홈 할 일 ‘월급 계획 확인’).
 * 시작한 사람이 아직 온보딩 중이면(월급 계획 없음) 합류만. 그 사이 공동 월급 계획이 바뀌었으면 다시 계산해 한 번 더.
 */
export async function finishJoin(d: JoinData) {
  for (let i = 0; i < 2; i++) {
    const [me, space, partner, splits] = await d.refetch();
    const list = splits.data ?? [];
    if (!list.length) return completeJoin();
    const draft = joinDraft({
      me: me.data ?? null,
      space: space.data ?? null,
      partner: partner.data ?? null,
      splits: list,
      goals: d.goals,
      resumed: me.data?.onboarding_step === 'P-WAIT',
    });
    if (!draft) return 'ok' as const;
    const r = await completeJoin(draft.lines, draft.joint ? draft.version : undefined);
    if (r !== 'split_changed') return r;
  }
  return 'split_changed' as const;
}
