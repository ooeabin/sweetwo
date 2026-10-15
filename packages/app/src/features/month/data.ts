import {
  fetchCurrentPlan,
  fetchGoalRecords,
  fetchGoals,
  fetchMe,
  fetchMonthClose,
  fetchPartner,
  fetchSpace,
  fetchTodos,
  qk,
} from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';

// 이번 달 데이터(react-query). 키는 온보딩과 같은 qk라 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
export function useCurrentPlan() {
  const today = todayKst();
  return useQuery({ queryKey: qk.currentPlan(today), queryFn: () => fetchCurrentPlan(today) });
}
export const useTodos = () => useQuery({ queryKey: qk.todos, queryFn: fetchTodos });
export function useMonthClose(planId: string | undefined) {
  return useQuery({
    queryKey: qk.monthClose(planId ?? ''),
    queryFn: () => fetchMonthClose(planId ?? ''),
    enabled: !!planId,
  });
}
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useGoalRecords = () =>
  useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
