import {
  fetchAccounts,
  fetchAssetKindNames,
  fetchAssets,
  fetchGoals,
  fetchInvestAnswers,
  fetchMe,
  fetchNetWorthHistory,
  fetchPartner,
  fetchPartnerAssetSums,
  fetchSpace,
  qk,
  type Asset,
} from '@sweetwo/api';
import {
  assetGroupsOf,
  coupleOf,
  investPrinciple,
  netWorth,
  netWorthSeries,
  todayKst,
  withKindNames,
  type AssetSide,
} from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { copy } from './copy';

// 우리 자산 데이터. 공개 범위는 서버가 거른 값만 온다(행 = 내가 볼 수 있는 것, 배우자 합계만 = 묶음 합계)
export function useAssetsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const sums = useQuery({ queryKey: qk.partnerAssetSums, queryFn: fetchPartnerAssetSums });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: fetchAccounts });
  const answers = useQuery({ queryKey: qk.investAnswers, queryFn: fetchInvestAnswers });
  const history = useQuery({
    queryKey: qk.netWorthHistory,
    queryFn: () => fetchNetWorthHistory(120),
  });
  const all = [me, space, partner, assets, sums, history, answers];
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  const items = assets.data ?? [];
  const nw = netWorth(items, sums.data ?? []);
  // 그래프(F-01 6번): 월말 기록 + 이번 달은 지금 값. 지난달 대비는 지난달 말 기록이 있을 때만
  const series = netWorthSeries(history.data ?? [], nw, `${todayKst().slice(0, 7)}-01`);
  const last = series.length >= 2 ? series[series.length - 2] : undefined;
  const change = last && last.net !== 0 ? nw.net - last.net : null;
  return {
    loading: all.some((q) => q.isLoading),
    failed: [me, space, assets].some((q) => q.isError),
    retry: () => all.forEach((q) => void q.refetch()),
    me: me.data ?? null,
    space: space.data ?? null,
    partnerProfile: partner.data ?? null,
    couple: c,
    items,
    sums: sums.data ?? [],
    goals: goals.data ?? [],
    accounts: accounts.data ?? [],
    /** 투자 원칙(O-53): 내 답, 배우자 답, 합의 상태와 허용 비중(보수적인 쪽) */
    answers: answers.data ?? { mine: null, partner: null },
    invest: investPrinciple(answers.data?.mine ?? null, answers.data?.partner ?? null, !!c?.solo),
    nw,
    series,
    change,
  };
}
export type AssetsData = ReturnType<typeof useAssetsData>;

/** F-03a 그룹·세부 항목 칩(AD-19 항목 이름 목록을 입힘). 못 받으면 기본 칩 그대로 */
export function useAssetGroups(side: AssetSide) {
  const names = useQuery({
    queryKey: qk.assetKindNames,
    queryFn: fetchAssetKindNames,
    staleTime: 10 * 60_000,
  });
  return withKindNames(assetGroupsOf(side), names.data ?? []);
}

export function useRefreshAssets() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [qk.assets, qk.partnerAssetSums, qk.netWorthHistory, qk.goalAssetSums].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
}

/** 명의 이름: 공동 / 나 / 배우자. 합류 전 대신 입력은 배우자 + ‘대신 입력’ */
export function ownerOf(a: Asset, d: Pick<AssetsData, 'me' | 'couple'>) {
  if (a.owner === 'joint') return { name: copy.joint, proxy: false };
  if (a.owner_user_id === d.me?.id) return { name: d.couple?.myName ?? '', proxy: false };
  return { name: d.couple?.partnerName ?? '', proxy: a.owner_user_id === null };
}

/** 내가 고칠 수 있는지(서버 규칙과 같음: 공동, 내 명의, 합류 전 내가 대신 입력한 것) */
export const canEdit = (a: Asset, myId: string | undefined) =>
  a.owner === 'joint' ||
  a.owner_user_id === myId ||
  (a.owner === 'person' && a.owner_user_id === null && a.created_by === myId);
