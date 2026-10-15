import {
  fetchGoalRecords,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  type Goal,
} from '@sweetwo/api';
import { coupleOf, spaceBaseDay } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useProposals } from '../proposals';
import { goalsView } from './view';

// 목표 화면 데이터. 키는 다른 기능과 같은 qk.
export function useGoalsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const records = useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
  const proposals = useProposals();
  const all = [me, space, partner, goals, records, proposals];
  const loading = all.some((q) => q.isLoading);
  const failed = [me, space, partner, goals, records].some((q) => q.isError);
  const make = (list: Goal[]) =>
    me.data && space.data && records.data
      ? goalsView({
          me: me.data,
          space: space.data,
          partner: partner.data ?? null,
          goals: list,
          records: records.data,
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
    goals: goals.data ?? [],
    me: me.data ?? null,
    couple: c,
    /** 연결된 부부: 배분 결정은 제안(08 6장) */
    connected: space.data?.couple_state === 'connected',
    base: space.data && c ? spaceBaseDay(space.data, c) : null,
    /** 열린 목표 제안 */
    openProposals: (proposals.data ?? []).filter((p) => p.status === 'open' && p.target_id),
    retry: () => all.forEach((q) => void q.refetch()),
  };
}
export type GoalsData = ReturnType<typeof useGoalsData>;
