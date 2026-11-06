import type { Goal, PayCheckLine } from '@sweetwo/api';
import { goalEta, nextOccurrence, type YearMonth } from '@sweetwo/core';
import { savedOf, toAllocGoal, useChecklists, useGoalSaved, useSplits } from '../salary';
import { useMe, usePartner, useSpace, useGoalsList } from './queries';

// 재기획 목표 화면 값(22 G-01, G-02). 모은 돈은 서버(goal_saved_sums), 매달 넣는 돈은 월급 계획 저금 줄,
// 이번 달은 이번 사이클 체크 줄. 계산은 core(goalEta)만 부른다.

export type GoalGroup = 'ours' | 'mine' | 'partner';

export interface GoalItem {
  goal: Goal;
  group: GoalGroup;
  saved: number;
  /** 매달 넣는 돈 = 보이는 월급 계획의 이 목표 저금 줄 합 */
  monthly: number;
  /** 사람별 저금 줄(우리 목표 + 각자 + 파트너 합류일 때 “찬우 60만 + 예빈 35만”) */
  perPerson: { userId: string; name: string; amount: number }[];
  expected: YearMonth | null;
  lateMonths: number | null;
  pct: number;
  /** 이번 사이클 이 목표 저금 줄(사람마다 0~1줄) */
  thisMonth: PayCheckLine[];
  /** 내가 고칠 수 있음(우리 목표, 또는 내 내 목표) */
  canEdit: boolean;
  custom: boolean;
  /** 매년 목표 다음 쓰는 달 */
  nextUse: YearMonth | null;
  /** 진행 중·지연·달성·사용 완료·보류 */
  state: 'active' | 'delayed' | 'achieved' | 'paused';
}

const OPEN = new Set(['active', 'delayed']);

export function useGoalsModel() {
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoalsList();
  const splits = useSplits();
  const lists = useChecklists();
  const saved = useGoalSaved();
  const loading = [me, space, goals, splits, lists].some((q) => q.isLoading);
  const failed = [me, space, goals].some((q) => q.isError);
  if (!me.data || !space.data || !goals.data) return { loading, failed, ready: false as const };

  const meId = me.data.id;
  const myName = me.data.nickname ?? '';
  const partnerName = partner.data?.nickname ?? space.data.partner_nickname ?? '';
  const joined =
    space.data.couple_state === 'connected' || space.data.couple_state === 'unlink_pending';
  const solo = space.data.couple_state === 'solo';
  const joint = space.data.salary_mode === 'joint';
  const nameOf = (id: string | null) => (id === meId ? myName : partnerName);
  const allSplits = splits.data ?? [];
  const lines = (lists.data ?? []).flatMap((c) => c.pay_check_line);
  // 줄 id → 그 체크리스트 주인(저금 줄은 user_id가 비어 있어 이름을 붙일 때 씀)
  const lineOwner: Record<string, string | null> = Object.fromEntries(
    (lists.data ?? []).flatMap((c) => c.pay_check_line.map((l) => [l.id, c.owner_user_id ?? null])),
  );

  const item = (g: Goal): GoalItem => {
    const group: GoalGroup =
      g.owner_user_id == null || solo ? 'ours' : g.owner_user_id === meId ? 'mine' : 'partner';
    const s = savedOf(g, saved.data);
    const perPerson = allSplits.flatMap((sp) =>
      sp.split_line
        .filter((l) => l.kind === 'saving' && l.goal_id === g.id)
        .map((l) => ({
          userId: sp.owner_user_id ?? '',
          name: sp.owner_user_id ? nameOf(sp.owner_user_id) : '',
          amount: l.amount,
        })),
    );
    const monthly = perPerson.reduce((t, p) => t + p.amount, 0);
    const eta = goalEta(toAllocGoal({ ...g, other_held: s }), monthly);
    // 아직 모은 돈이 없으면 지연으로 보지 않음(첫 사이클 ‘지연’ 배지, 2026-11-03)
    const late = eta.lateMonths !== null && eta.lateMonths > 0 && s > 0;
    const state = // 2026-11-04 사용 완료 없앰: 옛 ‘used’ 목표도 달성으로 보임
      (
        g.status === 'used'
          ? 'achieved'
          : g.status === 'paused' || g.status === 'achieved'
            ? g.status
            : late
              ? 'delayed'
              : 'active'
      ) as GoalItem['state'];
    return {
      goal: g,
      group,
      saved: s,
      monthly,
      perPerson: joint || !joined ? [] : perPerson.filter((p) => p.userId),
      expected: eta.expected,
      lateMonths: eta.lateMonths,
      pct: g.target_amount ? Math.min(Math.floor((s * 100) / g.target_amount), 100) : 0,
      thisMonth: lines.filter((l) => l.kind === 'saving' && l.goal_id === g.id),
      canEdit: g.owner_user_id == null || g.owner_user_id === meId,
      custom: g.template === 'custom',
      nextUse:
        g.kind === 'yearly' && g.deadline ? nextOccurrence(Number(g.deadline.slice(5, 7))) : null,
      state,
    };
  };

  const items = goals.data.map(item);
  const byPriority = (a: GoalItem, b: GoalItem) =>
    (a.goal.template === 'emergency' ? -1 : 0) - (b.goal.template === 'emergency' ? -1 : 0) ||
    a.goal.priority - b.goal.priority;
  const open = items.filter((i) => OPEN.has(i.goal.status)).sort(byPriority);
  const groups = {
    ours: open.filter((i) => i.group === 'ours'),
    mine: open.filter((i) => i.group === 'mine'),
    partner: open.filter((i) => i.group === 'partner'),
  };
  // 접힌 목록: 보류 → 달성(22 달성·보류 1번, 2026-11-04 사용 완료 없앰, 옛 used는 달성으로).
  // 개수와 펼친 묶음이 같도록 화면에 묶음이 있는 상태만(쓰지 않는 wrapping_up 같은 값은 빼고)
  const FOLD_ORDER: Record<string, number> = { paused: 0, achieved: 1 };
  const folded = items
    .filter((i) => !OPEN.has(i.goal.status) && i.state in FOLD_ORDER)
    .sort((a, b) => (FOLD_ORDER[a.state] ?? 2) - (FOLD_ORDER[b.state] ?? 2));
  // 상단 요약: 내가 볼 수 있는 목표의 월급 계획 저금 줄 합(파트너 내 목표 포함)
  const monthlyTotal = open.reduce((t, i) => t + i.monthly, 0);
  return {
    loading,
    failed,
    ready: true as const,
    meId,
    myName,
    partnerName,
    joined,
    solo,
    joint,
    space: space.data,
    groups,
    folded,
    monthlyTotal,
    byId: (id: string) => items.find((i) => i.goal.id === id),
    nameOf,
    lineOwner,
    retry: () => [me, space, goals, splits, lists, saved].forEach((q) => void q.refetch()),
  };
}
export type GoalsModel = Extract<ReturnType<typeof useGoalsModel>, { ready: true }>;
