import { fetchGoals, fetchMe, fetchPartner, fetchSpace, qk, updateMe, updateSpace } from '@sweetwo/api';
import { coupleOf } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useSplits } from '../salary';

// 합류 흐름 데이터(18). 키는 다른 기능과 같은 qk.
export function useJoinData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const splits = useSplits();
  const ready = [me, space, partner, goals, splits].every((q) => !q.isLoading);
  const couple = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    ready,
    me: me.data ?? null,
    space: space.data ?? null,
    partner: partner.data ?? null,
    goals: goals.data ?? [],
    splits: splits.data ?? [],
    /** 시작한 사람이 아직 온보딩 중(분배표가 없음): P-03 → P-03a → P-05 → 홈 대기 */
    waiting: !splits.isLoading && !(splits.data ?? []).length,
    /** 대기 뒤 이어서(P-04 → P-06) */
    resumed: me.data?.onboarding_step === 'P-WAIT',
    couple,
    refetch: () =>
      Promise.all([me.refetch(), space.refetch(), partner.refetch(), splits.refetch()]),
  };
}
export type JoinData = ReturnType<typeof useJoinData>;

export const saveMe = updateMe;
export const saveSpace = updateSpace;
