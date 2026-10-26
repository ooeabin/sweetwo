import { fetchGoals, fetchMe, fetchPartner, fetchSpace, qk } from '@sweetwo/api';
import { coupleOf } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';

// 목표 화면 기본 데이터(나, 공간, 배우자, 목표). 화면 값(모은 돈, 매달 넣는 돈, 예상)은 model.ts. 키는 다른 기능과 같은 qk.
export function useGoalsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const all = [me, space, partner, goals];
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    loading: all.some((q) => q.isLoading),
    failed: [me, space, goals].some((q) => q.isError),
    space: space.data ?? null,
    goals: goals.data ?? [],
    me: me.data ?? null,
    couple: c,
    connected: space.data?.couple_state === 'connected',
    retry: () => all.forEach((q) => void q.refetch()),
  };
}
export type GoalsData = ReturnType<typeof useGoalsData>;
