import {
  fetchAssets,
  fetchMe,
  fetchNetWorthHistory,
  fetchPartner,
  fetchPartnerAssetSums,
  fetchSpace,
  qk,
} from '@sweetwo/api';
import { financialPct, netWorth, netWorthSeries, todayKst } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';

// 앱 기본 틀 데이터(react-query). 키는 다른 기능과 같은 qk라 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });

/** 순자산(H-04): F-01과 같은 계산(원금 기준, 예상, 안 판 수익, 지난달 대비) + 최근 6개월 */
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
    /** 지난달 월말 순자산(F-08 지난달 대비). 기록이 없으면 null */
    prev: last ? { month: last.month, net: last.net } : null,
    /** 금융자산 비율(F-08 연령대 비교) */
    financialPct: financialPct(items, sums.data),
  };
}
export type NetWorthView = NonNullable<ReturnType<typeof useNetWorth>>;
