import {
  fetchCurrentPlan,
  fetchGoals,
  fetchLastPlanEnd,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  updateMe,
  updateSpace,
} from '@sweetwo/api';
import { coupleOf, todayKst } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';

// 합류 흐름 데이터. 키는 다른 기능과 같은 qk.
export function useJoinData() {
  const today = todayKst();
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const plan = useQuery({
    queryKey: qk.currentPlan(today),
    queryFn: () => fetchCurrentPlan(today),
  });
  // 공간에 플랜이 하나도 없으면 시작한 사람이 아직 온보딩 중(첫 플랜 전)
  const last = useQuery({ queryKey: qk.lastPlanEnd, queryFn: fetchLastPlanEnd });
  const ready =
    !me.isLoading &&
    !space.isLoading &&
    !partner.isLoading &&
    !goals.isLoading &&
    !plan.isLoading &&
    !last.isLoading;
  const couple = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    ready,
    me: me.data ?? null,
    space: space.data ?? null,
    partner: partner.data ?? null,
    goals: goals.data ?? [],
    plan: plan.data ?? null,
    /** 시작한 사람이 첫 플랜을 만들기 전: 내 정보까지만 답하고 기다림(18 P-11 대기) */
    waiting: !last.isLoading && !last.data,
    couple,
    refetch: () => Promise.all([me.refetch(), space.refetch(), partner.refetch()]),
  };
}
export type JoinData = ReturnType<typeof useJoinData>;

export const saveMe = updateMe;
export const saveSpace = updateSpace;
