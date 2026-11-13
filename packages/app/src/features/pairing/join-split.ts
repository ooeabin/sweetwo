import { completeJoin, type JoinContext, type Me } from '@sweetwo/api';
import {
  dateToYm,
  jointRefill,
  joinerSplit,
  type SavingPlanItem,
  type SplitLineDraft,
} from '@sweetwo/core';
import { track } from '../../shared/analytics';
import type { JoinData } from './data';

type Joint = NonNullable<JoinContext['joint']>;
type Snap = {
  me: Pick<Me, 'id' | 'monthly_income'> | null;
  salaryMode: 'separate' | 'joint';
  /** 합쳐서면 지금 공동 월급 계획 줄, 버전, 저금 항목(join_context 또는 구성원이 직접 읽은 값) */
  joint: Joint | null;
  resumed: boolean;
};

const toDraftLines = (rows: Joint['lines']): SplitLineDraft[] =>
  rows.map((l) => ({
    kind: l.kind,
    amount: l.amount,
    goalId: l.goal_id ?? undefined,
    userId: l.user_id ?? undefined,
    name: l.name ?? undefined,
  }));
const toItems = (rows: Joint['items']): SavingPlanItem[] =>
  rows.map((g) => ({
    id: g.id,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline ? dateToYm(g.deadline) : null,
  }));

/**
 * 합류한 사람의 월급 계획 초안(18 P-06 규칙, O-50 추천과 같은 자리).
 * 각자: core joinerSplit(고정 25%, 생활 25%, 용돈 10%. 저금 줄은 없음, 저금 항목은 각자 자기 월급 계획에만, ADR 0007).
 * 합쳐서: core jointRefill(있던 줄 그대로, 내 용돈 줄 + 늘어난 수입을 저금 줄 순서대로 월 필요액까지). 대기 뒤 이어서면 시작한 사람이 만든 그대로.
 */
export function joinDraft(x: Snap) {
  const me = x.me;
  if (!me) return null;
  const joint = x.salaryMode === 'joint';
  const income = me.monthly_income ?? 0;
  if (joint) {
    const current = x.joint ? toDraftLines(x.joint.lines) : [];
    const lines: SplitLineDraft[] = x.resumed
      ? current
      : jointRefill({
          lines: current,
          income,
          userId: me.id,
          items: x.joint ? toItems(x.joint.items) : [],
        });
    return {
      joint,
      lines,
      current,
      version: x.joint?.version,
      others: {} as Record<string, number>,
    };
  }
  const lines = joinerSplit({ income, userId: me.id });
  const others: Record<string, number> = {};
  return { joint, lines, current: [] as SplitLineDraft[], version: undefined, others };
}

/**
 * 합류 마치기(2026-11-03, 온보딩 ADR 0005처럼 월급 계획 화면 없이 추천으로 저장). 2026-11-11 D1: 이 순간 공간에 들어감.
 * 시작한 사람이 아직 온보딩 중이면(월급 계획 없음) 합류만. 그 사이 공동 월급 계획이 바뀌었으면 다시 계산해 한 번 더.
 * 합류 중이 아니면(취소, 기한 지남) 'ended'
 */
export async function finishJoin(d: JoinData) {
  for (let i = 0; i < 2; i++) {
    const { me, ctx } = await d.refetch();
    if (!ctx || !me) return 'ended' as const;
    const event = {
      hours_since_invite: null,
      mid_cycle: ctx.has_plan,
      salary_mode: ctx.salary_mode === 'joint' ? ('combined' as const) : ('separate' as const),
      // 혼자 쓰던 기록이 있던 사람(온보딩을 마친 적 있음)은 P-02a로 옮겨 옴
      moved_records: !!me.onboarding_done_at && !ctx.member,
    };
    let r: 'ok' | 'split_changed';
    if (!ctx.has_plan) r = await completeJoin();
    else {
      const draft = joinDraft({
        me,
        salaryMode: ctx.salary_mode,
        joint: ctx.joint,
        resumed: me.onboarding_step === 'P-WAIT',
      });
      if (!draft) return 'ok' as const;
      r = await completeJoin(draft.lines, draft.joint ? draft.version : undefined);
    }
    if (r !== 'split_changed') {
      if (me.onboarding_step !== 'P-WAIT') track('partner_joined', event);
      return r;
    }
  }
  return 'split_changed' as const;
}
