import type { Goal, PayCheckLine } from '@sweetwo/api';
import { goalEta, nextOccurrence, templateByKey, type YearMonth } from '@sweetwo/core';
import { savedOf, toAllocGoal, useChecklists, useGoalSaved, useSplits } from '../salary';
import { useMe, usePartner, useSpace, useGoalsList } from './queries';

// 재기획 목표 화면 값(22 G-01, G-02). 모은 돈은 서버(goal_saved_sums), 매달 넣는 돈은 분배표 저금 줄,
// 이번 달은 이번 사이클 체크 줄. 계산은 core(goalEta)만 부른다.

export type GoalGroup = 'ours' | 'mine' | 'partner';

export interface GoalItem {
  goal: Goal;
  group: GoalGroup;
  saved: number;
  /** 매달 넣는 돈 = 보이는 분배표의 이 목표 저금 줄 합 */
  monthly: number;
  /** 사람별 저금 줄(우리 목표 + 각자 + 배우자 합류일 때 “찬우 60만 + 예빈 35만”) */
  perPerson: { userId: string; name: string; amount: number }[];
  expected: YearMonth | null;
  lateMonths: number | null;
  pct: number;
  /** 이번 사이클 이 목표 저금 줄(사람마다 0~1줄) */
  thisMonth: PayCheckLine[];
  /** 내가 고칠 수 있음(우리 목표, 또는 내 내 목표) */
  canEdit: boolean;
  illustration: string | null;
  custom: boolean;
  /** 매년 목표 다음 쓰는 달 */
  nextUse: YearMonth | null;
  /** 진행 중·지연·달성·사용 완료·보류 */
  state: 'active' | 'delayed' | 'achieved' | 'used' | 'paused';
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
    const t = templateByKey(g.template);
    const late = eta.lateMonths !== null && eta.lateMonths > 0;
    const state = (
      g.status === 'paused' || g.status === 'achieved' || g.status === 'used'
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
      illustration: t?.illustration ?? null,
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
  const folded = items.filter((i) => !OPEN.has(i.goal.status));
  // 상단 요약: 내가 볼 수 있는 목표의 분배표 저금 줄 합(배우자 내 목표 포함)
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
    retry: () => [me, space, goals, splits, lists, saved].forEach((q) => void q.refetch()),
  };
}
export type GoalsModel = Extract<ReturnType<typeof useGoalsModel>, { ready: true }>;
