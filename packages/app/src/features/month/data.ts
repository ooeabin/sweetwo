import {
  fetchAssets,
  fetchNetWorthHistory,
  fetchPartnerActivity,
  fetchPartnerAssetSums,
  fetchCurrentPlan,
  fetchGoalAssetSums,
  fetchGoalRecords,
  fetchGoals,
  fetchHolidays,
  fetchLivingCheck,
  fetchMe,
  fetchMonthClose,
  fetchPartner,
  fetchSpace,
  fetchTodos,
  qk,
} from '@sweetwo/api';
import { netWorth, netWorthSeries, todayKst } from '@sweetwo/core';
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
export const useGoalAssetSums = () =>
  useQuery({ queryKey: qk.goalAssetSums, queryFn: fetchGoalAssetSums });
/** 공휴일(월급날 앞당겨 표시) */
export const useHolidays = () =>
  useQuery({ queryKey: qk.holidays, queryFn: fetchHolidays, staleTime: 24 * 3_600_000 });
/** 이 플랜의 생활비 체크 답(W-03, 한 명이 답하면 둘 다 끝) */
export function useLivingCheck(planId: string | null) {
  return useQuery({
    queryKey: qk.livingCheck(planId ?? ''),
    queryFn: () => fetchLivingCheck(planId ?? ''),
    enabled: !!planId,
  });
}

/** 순자산(H-06): F-01과 같은 계산(원금 기준, 예상, 안 판 수익, 지난달 대비) + 최근 6개월 */
export function useNetWorth(enabled: boolean) {
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets, enabled });
  const sums = useQuery({
    queryKey: qk.partnerAssetSums,
    queryFn: fetchPartnerAssetSums,
    enabled,
  });
  const history = useQuery({
    queryKey: qk.netWorthHistory,
    queryFn: () => fetchNetWorthHistory(120),
    enabled,
  });
  const ready = assets.isSuccess && sums.isSuccess && history.isSuccess;
  if (!ready) return null;
  const items = assets.data;
  const nw = netWorth(items, sums.data);
  const series = netWorthSeries(history.data, nw, `${todayKst().slice(0, 7)}-01`);
  const last = series.length >= 2 ? series[series.length - 2] : undefined;
  return {
    empty: items.length === 0 && sums.data.length === 0,
    nw,
    series: series.slice(-6),
    change: last && last.net !== 0 ? nw.net - last.net : null,
  };
}
export type NetWorthView = NonNullable<ReturnType<typeof useNetWorth>>;

/** 배우자 활동(H-08) 최근 5건. 연결된 부부만 */
export const usePartnerActivity = (enabled: boolean) =>
  useQuery({
    queryKey: qk.partnerActivity,
    queryFn: () => fetchPartnerActivity(5),
    enabled,
  });
