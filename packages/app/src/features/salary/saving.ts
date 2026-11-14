import type { Goal, PayCheckLine } from '@sweetwo/api';
import {
  dateToYm,
  leftover,
  savingBar,
  savingEta,
  savingLate,
  savingNeed,
  savingPct,
  savingState,
  type SavingState,
  type YearMonth,
} from '@sweetwo/core';
import { track } from '../../shared/analytics';
import {
  useChecklists,
  useGoalSaved,
  useGoals,
  useMe,
  usePartner,
  usePartnerPlanView,
  useSpace,
  useSplits,
} from './data';

// 저금 항목 화면 값(docs/spec/20-salary-plan.md ‘저금 항목’, W-10, 홈 H-02, ADR 0007).
// 행은 goal(space_goals), 모은 금액은 서버 goal_saved_sums(체크한 저금 합), 매달 금액은 그 항목 월급 계획 줄,
// 이번 달 줄은 이번 사이클 체크리스트. 계산은 core(savingPct·savingNeed·savingEta)만 부른다.

export type SavingOwner = 'mine' | 'partner' | 'ours';

export interface SavingItem {
  goal: Goal;
  /** 모은 금액 = 체크한 저금 합 */
  saved: number;
  /** 매달 금액 = 월급 계획의 이 항목 줄(그만 모음이면 0) */
  monthly: number;
  state: SavingState;
  target: number | null;
  deadline: YearMonth | null;
  /** 진행률(목표 금액이 없으면 null) */
  pct: number | null;
  /** 막대 채움(모은 금액이 있으면 최소 2%) */
  bar: number;
  /** 월 필요액(목표 금액과 기한이 있을 때만) */
  need: number | null;
  /** 예상 달성 월 */
  eta: YearMonth | null;
  /** 기한보다 늦어지는 개월(월 필요액 > 매달 금액일 때만) */
  late: number | null;
  owner: SavingOwner;
  /** 주인 이름(파트너 항목, 합쳐서 모드 줄 이름 앞) */
  ownerName: string;
  /**
   * 내 몫으로 고칠 수 있음(해제 대기와 상관없이): 각자 = 내 것, 합쳐서 = 모두(주인이 있는 저금도, 2026-11-12 D1).
   * 합쳐서여도 파트너가 ‘금액만 보여 주기’로 둔 것은 이름이 가려져 보기만(서버 goal RLS와 같음)
   */
  mayEdit: boolean;
  /** 지금 고칠 수 있음 = mayEdit이고 연결 해제 대기가 아님 */
  canEdit: boolean;
  /** 이번 사이클 이 항목 줄 */
  thisMonth: PayCheckLine | undefined;
  /**
   * 상대가 공개 ‘했어요만’인 상대 저금(08 6장, 2026-11-13 P1 = A): 서버가 이름(“개인 저금”)·금액 없이 줌.
   * 화면은 금액 대신 이번 달 확인 여부만(doneThisMonth), 눌러서 열지 않음
   */
  private: boolean;
  /** private일 때 이번 달 확인 여부(partner_plan_view 줄 state) */
  doneThisMonth: boolean;
  /**
   * 같이 모으기(묶음)에 든 저금(2026-11-14 R4): 진행·목표는 묶음 합계 하나(둘이 모은 금액)로만 보이고, 저금 줄에는 ‘내 몫’
   * 금액만(이 저금의 목표 금액은 묶음 목표를 옮겨 둔 값이라 따로 %를 내면 화면마다 숫자가 달라짐)
   */
  bundled: boolean;
}

/** 저금 항목 줄 순서(홈 H-02, W-01 접힌 목록): 내 것 → 파트너 것 → 우리 둘 것, 묶음 안은 만든 순서 */
const RANK: Record<SavingOwner, number> = { mine: 0, partner: 1, ours: 2 };

export function useSavingItems() {
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const splits = useSplits();
  const lists = useChecklists();
  const saved = useGoalSaved();
  const separate = space.data?.salary_mode === 'separate' && !!partner.data;
  const pv = usePartnerPlanView(separate);
  const all = [me, space, goals, splits, lists, saved];
  const loading = all.some((q) => q.isLoading);
  /** 저금 항목을 다시 받는 중(방금 추가한 항목이 아직 목록에 없을 수 있음) */
  const fetching = goals.isFetching;
  const failed = [me, space, goals].some((q) => q.isError);
  const retry = () => [...all, partner].forEach((q) => void q.refetch());
  if (!me.data || !space.data || !goals.data)
    return { loading, failed, retry, ready: false as const };

  const meId = me.data.id;
  const myName = me.data.nickname ?? '';
  const partnerName = partner.data?.nickname ?? space.data.partner_nickname ?? '';
  const joint = space.data.salary_mode === 'joint';
  const joined =
    space.data.couple_state === 'connected' || space.data.couple_state === 'unlink_pending';
  const pending = space.data.couple_state === 'unlink_pending';
  const splitLines = (splits.data ?? []).flatMap((s) => s.split_line);
  const lines = (lists.data ?? []).flatMap((c) => c.pay_check_line);
  const partnerDoneOnly = !joint && !!pv.data && !pv.data.hidden && pv.data.share === 'done_only';

  const item = (g: Goal): SavingItem => {
    const s = saved.data?.[g.id] ?? 0;
    const target = g.target_amount;
    const deadline = g.deadline ? dateToYm(g.deadline) : null;
    // 매달 금액: 월급 계획 줄. 상대 저금(각자)은 줄을 못 읽으면 partner_plan_view가 준 금액(공개 단계대로, 2026-11-14 M7)
    const own = splitLines.filter((l) => l.kind === 'saving' && l.goal_id === g.id);
    const monthly = own.length
      ? own.reduce((t, l) => t + l.amount, 0)
      : (pv.data?.lines ?? [])
          .filter((l) => l.kind === 'saving' && l.goal_id === g.id)
          .reduce((t, l) => t + (l.amount ?? 0), 0);
    const owner: SavingOwner =
      g.owner_user_id === null ? 'ours' : g.owner_user_id === meId ? 'mine' : 'partner';
    return {
      goal: g,
      saved: s,
      monthly,
      state: savingState(g),
      target,
      deadline,
      pct: savingPct(s, target),
      bar: savingBar(s, target),
      need: savingNeed({ target, saved: s, deadline }),
      eta: savingEta({ target, saved: s }, monthly),
      late: savingLate({ target, saved: s, deadline }, monthly),
      owner,
      ownerName: owner === 'partner' ? partnerName : owner === 'mine' ? myName : '',
      mayEdit: owner !== 'partner' || (joint && g.visibility === 'all'),
      canEdit: (owner !== 'partner' || (joint && g.visibility === 'all')) && !pending,
      thisMonth: lines.find((l) => l.kind === 'saving' && l.goal_id === g.id),
      private: owner === 'partner' && partnerDoneOnly,
      doneThisMonth:
        owner === 'partner' &&
        partnerDoneOnly &&
        !!pv.data?.lines.some((l) => l.goal_id === g.id && l.state === 'checked'),
      bundled: !!g.bundle_id,
    };
  };

  const items = goals.data
    .filter((g) => !g.deleted_at)
    .map(item)
    .sort(
      (a, b) =>
        RANK[a.owner] - RANK[b.owner] ||
        a.goal.priority - b.goal.priority ||
        (a.goal.created_at < b.goal.created_at ? -1 : 1),
    );
  return {
    loading,
    /** 모은 금액(goal_saved)을 처음 받는 중(홈이 0원을 먼저 보이지 않게, 2026-11-14 R7) */
    savedLoading: saved.isLoading,
    failed,
    retry,
    fetching,
    ready: true as const,
    meId,
    myName,
    partnerName,
    joint,
    joined,
    pending,
    space: space.data,
    /** 그만 모은 것 빼고 */
    live: items.filter((i) => i.state !== 'closed'),
    closed: items.filter((i) => i.state === 'closed'),
    byId: (id: string) => items.find((i) => i.goal.id === id),
    /** 홈 H-02: 목표 금액이 있는 모으는 중·달성 항목 */
    withTarget: items.filter((i) => i.state !== 'closed' && i.target !== null),
  };
}
export type SavingModel = Extract<ReturnType<typeof useSavingItems>, { ready: true }>;

/**
 * 같이 쓰는 저금을 고침(32 4-6 shared_item_changed goal, 2026-11-12 S7-16): 합쳐서 모드 + 연결된 커플일 때만
 * (합쳐서면 모든 저금이 같이 쓰는 것, D1). 추가(W-11), 이름·목표 금액·기한(W-10a), 지우기(W-10), 달성 뒤 선택(W-12a)
 */
export function trackSharedGoal(m: { joint: boolean; joined: boolean } | null | undefined) {
  if (m?.joint && m.joined) track('shared_item_changed', { item_type: 'goal', linked: true });
}

/**
 * 첫 저금 빈 줄(2026-11-09, 20 ‘첫 저금’, 19 H-03): 내 저금이 없으면 체크리스트 저금 묶음에
 * “+ 저금 추가 (여유 자금 {n})” → W-11. ‘내 저금’ = 각자면 내가 주인인 것, 합쳐서면 공동 월급 계획의 것(그만 모은 것 빼고).
 * 각자 모드에서 파트너가 묶음에 안 든 저금이 있으면 “{파트너}님 ‘결혼 비용’에 같이 모을까요?” → W-15(20 ‘첫 저금’ 3번, 2026-11-13.
 * 예전 비교 문구 “…님처럼 나도 모을 곳을…”은 없앰, UX B). 월급 계획이 없거나 해제 대기면 없음.
 */
export function useFirstSaving():
  | { show: false }
  | {
      show: true;
      left: number;
      partnerName: string | null;
      /** 같이 모으자고 권할 상대 저금(각자 계열, 묶음에 안 든 것, 이름이 보일 때만) */
      partnerGoal: { id: string; name: string } | null;
    } {
  const d = useSavingItems();
  const splits = useSplits();
  const me = useMe();
  const partner = usePartner();
  if (!d.ready || !splits.data || !me.data) return { show: false };
  const mine = splits.data.find((x) =>
    d.joint ? x.owner_user_id === null : x.owner_user_id === d.meId,
  );
  if (!mine || d.pending) return { show: false };
  const has = d.live.some((i) => (d.joint ? true : i.owner === 'mine'));
  if (has) return { show: false };
  const income = d.joint
    ? (me.data.monthly_income ?? 0) + (partner.data?.monthly_income ?? 0)
    : (me.data.monthly_income ?? 0);
  const left = Math.max(
    leftover(
      income,
      mine.split_line.map((l) => ({ amount: l.amount, kind: l.kind })),
    ),
    0,
  );
  const theirs =
    !d.joint && d.joined
      ? d.live.find((i) => i.owner === 'partner' && !i.goal.bundle_id && !!i.goal.name)
      : undefined;
  return {
    show: true,
    left,
    partnerName: theirs ? d.partnerName : null,
    partnerGoal: theirs ? { id: theirs.goal.id, name: theirs.goal.name } : null,
  };
}
