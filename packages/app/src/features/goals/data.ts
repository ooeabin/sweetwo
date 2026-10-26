import {
  fetchGoalAssetSums,
  fetchGoalRecords,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  type Goal,
  type Me,
  type Space,
} from '@sweetwo/api';
import { coupleOf } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { goalsView } from './view';

// 목표 화면 데이터. 키는 다른 기능과 같은 qk.
export function useGoalsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const records = useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
  const linked = useQuery({ queryKey: qk.goalAssetSums, queryFn: fetchGoalAssetSums });
  const all = [me, space, partner, goals, records, linked];
  const loading = all.some((q) => q.isLoading);
  const failed = [me, space, partner, goals, records].some((q) => q.isError);
  const make = (list: Goal[], over?: { me?: Me; space?: Space }) =>
    me.data && space.data && records.data
      ? goalsView({
          me: over?.me ?? me.data,
          space: over?.space ?? space.data,
          partner: partner.data ?? null,
          goals: list,
          records: records.data,
          linked: linked.data ?? [],
        })
      : null;
  const view = goals.data ? make(goals.data) : null;
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    loading,
    failed,
    view,
    /** 바꾼 값으로 다시 계산(목표 수정 영향 미리보기) */
    viewWith: (id: string, patch: Partial<Goal>) =>
      goals.data ? make(goals.data.map((g) => (g.id === id ? { ...g, ...patch } : g))) : null,
    space: space.data ?? null,
    /** 새 목표를 더해 다시 계산(목표 추가 G-03f) */
    viewAdd: (g: Goal) => (goals.data ? make([...goals.data, g]) : null),
    goals: goals.data ?? [],
    me: me.data ?? null,
    couple: c,
    connected: space.data?.couple_state === 'connected',
    retry: () => all.forEach((q) => void q.refetch()),
  };
}
export type GoalsData = ReturnType<typeof useGoalsData>;
