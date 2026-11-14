import {
  fetchAssets,
  fetchMe,
  fetchNetWorthHistory,
  fetchPartner,
  fetchPartnerAssetSums,
  fetchSpace,
  qk,
  subscribeAssets,
} from '@sweetwo/api';
import {
  netWorthSeries,
  netWorthSummary,
  todayKst,
  type NetWorthItem,
  type NetWorthPoint,
  type PartnerAssetSumRow,
} from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// 앱 기본 틀 데이터(react-query). 키는 다른 기능과 같은 qk라 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });

/**
 * 순자산 요약 v2.2(06 6장, 23 F-01, 2026-11-13 N11): 평가금액 기준이 기본(net), principalNet은 ‘원금으로 보기’.
 * core netWorthSummary에 내가 볼 수 있는 행 모두 + 파트너 ‘총액만’ 묶음 합계를 행처럼 더함(23 F-01 2번, 홈 H-04와 같은 값).
 * ‘숨기기’는 파트너에게만 안 보임(2026-11-13 H3): RLS로 받는 숨기기 행은 늘 내 것이라 내 합계에는 넣음
 */
export function netWorthOf(
  items: readonly (NetWorthItem & { visibility?: string })[],
  sums: readonly PartnerAssetSumRow[],
) {
  return netWorthSummary([
    ...items,
    ...sums.map((p) => ({ side: p.side, amount: p.total, principal: p.principal_total })),
  ]);
}
export type NetWorthNow = ReturnType<typeof netWorthOf>;

/**
 * 달마다 순자산(23 F-01 4번): 월말 기록(net = 원금 기준, expected = 평가금액 기준)에서 고른 기준으로.
 * 이번 달은 지금 값. 지난달 대비는 지난달 말 기록이 있을 때만
 */
export function netWorthTrend(
  history: readonly NetWorthPoint[],
  now: NetWorthNow,
  principal = false,
) {
  const pick = (h: { net: number; expected: number }) => (principal ? h.net : h.expected);
  const cur = principal ? now.principalNet : now.net;
  const series = netWorthSeries(
    history.map((h) => ({ month: h.month, net: pick(h), expected: pick(h) })),
    { net: cur, expected: cur },
    `${todayKst().slice(0, 7)}-01`,
  );
  const last = series.length >= 2 ? series[series.length - 2] : undefined;
  return {
    series,
    change: last && last.net !== 0 ? cur - last.net : null,
    /** 지난달 월말 순자산(F-08 지난달 대비). 기록이 없으면 null */
    prev: last ? { month: last.month, net: last.net } : null,
  };
}

/** 순자산(H-04): F-01과 같은 계산(평가금액 기준, 2026-11-13) + 최근 6개월 */
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
  const nw = netWorthOf(items, sums.data);
  const t = netWorthTrend(history.data, nw);
  return {
    empty: items.length === 0 && sums.data.length === 0,
    nw,
    series: t.series.slice(-6),
    change: t.change,
    prev: t.prev,
  };
}
export type NetWorthView = NonNullable<ReturnType<typeof useNetWorth>>;

/**
 * 상대가 자산을 고치면(Realtime asset, 2026-11-12 QA 8구간 S8-06) 자산, 파트너 ‘금액만’ 합계, 월말 순자산을 바로 다시 읽음.
 * F-01·F-02(AssetsFrame), F-04, 홈에서 한 번
 */
export function useAssetRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeAssets(spaceId, () => {
      for (const k of [qk.assets, qk.partnerAssetSums, qk.netWorthHistory])
        void qc.invalidateQueries({ queryKey: k });
    });
  }, [spaceId, qc]);
}
