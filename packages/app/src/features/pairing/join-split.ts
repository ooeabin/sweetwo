import {
  completeJoin,
  completeJoinWithoutPlan,
  requestModeChange,
  type JoinContext,
  type Me,
  type SplitLineSettings,
} from '@sweetwo/api';
import {
  dateToYm,
  jointRefill,
  joinerSplit,
  sharedAccountSeed,
  type SavingPlanItem,
  type SplitLineDraft,
} from '@sweetwo/core';
import { track } from '../../shared/analytics';
import { useJoinSend, type JoinData } from './data';

type Joint = NonNullable<JoinContext['joint']>;
type Line = SplitLineDraft & SplitLineSettings;
type Snap = {
  me: Pick<
    Me,
    'id' | 'monthly_income' | 'allowance' | 'payday' | 'payday_last' | 'payday_none'
  > | null;
  salaryMode: 'separate' | 'joint';
  /** 합쳐서면 지금 공동 월급 계획 줄, 버전, 저금 항목(join_context 또는 구성원이 직접 읽은 값) */
  joint: Joint | null;
  resumed: boolean;
  /** 한 사람 관리형에서 관리하지 않는 쪽(P-05c 용돈) */
  nonManager?: boolean;
  /** 시작한 사람이 고른 생활비 ‘네’(각자 계열이면 ‘같이 쓰는 통장’ 0원 줄) */
  sharedLiving?: boolean | null;
};

const toDraftLines = (rows: Joint['lines']): SplitLineDraft[] =>
  rows
    // 보내기 줄은 서버만 만듦(save_split send_locked)
    .filter((l) => l.kind !== 'send')
    .map((l) => ({
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
 * P-05c 용돈 줄(18 v2.2): 자동 줄, 체크리스트에 넣기 켬, 나가는 날 = 월급날(말일 = 31, 날짜 없음은 서버 기본 1일).
 * ‘보내기’ = 월급 − 용돈은 서버 recalc_send_line이 같은 설정으로 만듦
 */
export const allowanceLine = (me: NonNullable<Snap['me']>): Line => ({
  kind: 'allowance',
  userId: me.id,
  amount: Math.max(0, Math.min(me.allowance ?? 0, me.monthly_income ?? 0)),
  inChecklist: true,
  autoPay: true,
  autoDay: me.payday_none ? null : me.payday_last ? 31 : (me.payday ?? null),
});

/**
 * 합류한 사람의 월급 계획 초안(18 P-06 규칙 + v2.2 P-05c).
 * 각자: core joinerSplit(고정 25%, 생활 25%, 용돈 10%, 저금 줄 없음) + 생활비 ‘네’면 ‘같이 쓰는 통장’ 0원 줄.
 * 각자 + P-04 ‘보내요’(요청 대기): 용돈 자동 줄만(각자 월급 계획에는 보내기 줄을 둘 수 없음, 서버 send_locked. 수락되면 서버가 보내기 줄을 만듦).
 * 합쳐서 + 관리하지 않는 쪽: 있던 줄 그대로 + 내 용돈 자동 줄(P-05c 금액).
 * 합쳐서: core jointRefill(있던 줄 그대로, 내 용돈 줄 + 늘어난 수입을 저금 줄 순서대로 월 필요액까지). 대기 뒤 이어서면 시작한 사람이 만든 그대로.
 */
export function joinDraft(x: Snap) {
  const me = x.me;
  if (!me) return null;
  const joint = x.salaryMode === 'joint';
  const income = me.monthly_income ?? 0;
  if (joint) {
    const current = x.joint ? toDraftLines(x.joint.lines) : [];
    let lines: Line[];
    if (x.nonManager) {
      const mine = allowanceLine(me);
      const has = current.some((l) => l.kind === 'allowance' && l.userId === me.id);
      lines = has
        ? current.map((l) => (l.kind === 'allowance' && l.userId === me.id ? mine : l))
        : [...current, mine];
    } else
      lines = x.resumed
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
  const lines: Line[] = x.nonManager
    ? [allowanceLine(me)]
    : [...joinerSplit({ income, userId: me.id }), ...sharedAccountSeed('separate', x.sharedLiving)];
  const others: Record<string, number> = {};
  return { joint, lines, current: [] as SplitLineDraft[], version: undefined, others };
}

/**
 * P-04 ‘보내요’를 골랐으면 합류를 마친 뒤 요청(request_mode_change p04_send, 08 4-1 가): 시작한 사람이 관리하는 같이 계열로.
 * 실패해도 합류는 그대로(시작한 사람이 S-11f에서 바꿀 수 있음)
 */
async function sendRequest(ctx: JoinContext) {
  const { send, setSend } = useJoinSend.getState();
  if (send !== 'chosen') return;
  try {
    const result = await requestModeChange({
      sharedLiving: true,
      sharedSaving: ctx.shared_saving ?? false,
      manager: 'partner',
      phrase: 'p04_send',
    });
    track('mode_change_requested', { phrase: 'p04_send', to_mode: 'joint', result });
  } catch {
    /* 합류는 마쳤음 */
  }
  setSend('requested');
}

/**
 * 합류 마치기(2026-11-03, 온보딩 ADR 0005처럼 월급 계획 화면 없이 추천으로 저장). 2026-11-11 D1: 이 순간 공간에 들어감.
 * 같이 계열이고 시작한 사람이 아직 온보딩 중이면(월급 계획 없음) 합류만. noPlan(‘월급 없이 합류할게요’)이면 월급 계획 없이.
 * 그 사이 공동 월급 계획이 바뀌었으면 다시 계산해 한 번 더. 합류 중이 아니면(취소, 기한 지남) 'ended'
 */
export async function finishJoin(d: JoinData, o: { noPlan?: boolean } = {}) {
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
    const joint = ctx.salary_mode === 'joint';
    const send = useJoinSend.getState().send;
    let r: 'ok' | 'split_changed';
    if (o.noPlan) {
      await completeJoinWithoutPlan();
      r = 'ok';
    } else if (joint && !ctx.has_plan) r = await completeJoin();
    else {
      const draft = joinDraft({
        me,
        salaryMode: ctx.salary_mode,
        joint: ctx.joint,
        resumed: me.onboarding_step === 'P-WAIT',
        nonManager: (joint && ctx.manager === 'starter') || (!joint && !!send),
        sharedLiving: ctx.shared_living,
      });
      if (!draft) return 'ok' as const;
      r = await completeJoin(draft.lines, draft.joint ? draft.version : undefined);
    }
    if (r !== 'split_changed') {
      if (me.onboarding_step !== 'P-WAIT') track('partner_joined', event);
      if (!joint) await sendRequest(ctx);
      return r;
    }
  }
  return 'split_changed' as const;
}
