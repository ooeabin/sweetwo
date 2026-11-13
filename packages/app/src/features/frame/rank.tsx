import {
  fetchMe,
  fetchRankPair,
  fetchRankViewed,
  qk,
  rankKeys,
  recordRankView,
  RankAdRequired,
  type Me,
} from '@sweetwo/api';
import { rankState, todayKst, type RankPairResponse, type RankState } from '@sweetwo/core';
import { RankRow } from '@sweetwo/ui';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useNetWorth, type NetWorthView } from './data';

export const RANK_PATH = '/assets/rank';

/** 순위 화면으로 넘기는 결과(광고를 본 뒤 기록한 값, 광고를 못 불러와 기록 없이 계산만 한 값) */
export interface RankNavState {
  fresh: RankPairResponse;
  adResult: AdResult;
}
export type AdResult = 'rewarded' | 'closed' | 'failed' | 'none';

/**
 * 자산 순위 v2.2(06 7-8, 23 F-01 0번·F-08, ADR 0009 결정 11):
 * pair = 연결 + 두 사람 모두 동의 → 둘의 합 순위. 아니면 peer(또래 가구 중간값 한 줄, 광고 없음).
 * pair 배너 상태: empty / unseen(본 적 없으면 첫 결과 무료) / seen(이번 달, 둘의 합 그대로) / stale(‘새로 확인하기’ = 광고).
 * 저장 순위(rank_month·pct·net)는 서버 record_rank_view가 pair일 때만 씀. 동의를 끄면 서버가 지움
 */
export function useRank(): {
  state: RankState;
  net: number;
  view: NetWorthView;
  pair: RankPairResponse;
  /** 본 적이 있나(rank_view). 없으면 첫 결과 무료 */
  viewed: boolean;
  me: Me;
  /** 홈 H-04 배지 “상위 n%”: (가) + ‘홈에 보여 주기’를 켰을 때만(기본 끔) */
  homeBadge: number | null;
} | null {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const nw = useNetWorth(true);
  const pair = useQuery({ queryKey: qk.rankPair, queryFn: fetchRankPair });
  const viewed = useQuery({ queryKey: qk.rankViewed, queryFn: fetchRankViewed });
  if (!me.data || !nw || !pair.data || viewed.data === undefined) return null;
  const p = pair.data;
  const net = p.mode === 'pair' ? p.net : nw.nw.net;
  const state = rankState({
    hasItems: !nw.empty,
    net,
    thisMonth: `${todayKst().slice(0, 7)}-01`,
    seen:
      p.mode === 'pair'
        ? { month: me.data.rank_month, pct: me.data.rank_pct, net: me.data.rank_net }
        : { month: null, pct: null, net: null },
  });
  const stored = state.kind === 'seen' || state.kind === 'stale' ? state.pct : null;
  return {
    state,
    net,
    view: nw,
    pair: p,
    viewed: viewed.data,
    me: me.data,
    homeBadge: p.mode === 'pair' && me.data.rank_badge_home ? stored : null,
  };
}

// 모바일 앱이면 보상형 광고(ADR 0006·0009, 비맞춤형). 브라우저(브리지 없음, 개발·e2e)는 'none', 못 불러오면 'failed'
async function watchAd(): Promise<AdResult> {
  const ads = typeof window !== 'undefined' ? window.sweetwo?.ads : undefined;
  if (!ads) return 'none';
  try {
    return await ads.rewarded();
  } catch {
    return 'failed';
  }
}

/**
 * ‘새로 확인하기’(광고 뒤 순위, 23 F-08 v2.2): 끝까지 보면 서버에 기록(paid_by_ad) → F-08.
 * 닫으면 Toast. 광고를 못 불러오거나 브리지가 없으면 광고 없이 바로 결과(34 출시 체크): 서버는 광고 없는 두 번째
 * 기록을 받지 않아 기록 없이 지금 값만 보여 줌(저장 순위·홈 배지는 그대로)
 */
export async function refreshRankWithAd(nav: NavigateFunction, qc: QueryClient) {
  const ad = await watchAd();
  track('rank_ad_result', { result: ad, platform: window.sweetwo?.platform ?? 'web' });
  if (ad === 'closed') return toast(copy.rankAdClosed);
  try {
    const fresh = ad === 'rewarded' ? await recordRankView(true) : await fetchRankPair();
    await Promise.all(rankKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
    const state: RankNavState = { fresh, adResult: ad };
    nav(RANK_PATH, { state });
  } catch {
    toast(copy.rankFailed);
  }
}

/** 첫 결과(광고 없음): 서버가 첫 기록만 광고 없이 받음. 이미 본 적이 있으면 RankAdRequired */
export async function recordFirstRank(qc: QueryClient) {
  const r = await recordRankView(false);
  await Promise.all(rankKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
  return r;
}
export { RankAdRequired };

/**
 * 자산 순위 줄(RankRow, 23 F-01 0번 v2.2): (나) “또래 가구 중간값 보기”(광고 없음) → F-08.
 * (가) 본 적 없음 = “확인하기”(광고 없음, 첫 결과 무료) → F-08, 이번 달 봄 = 바로 F-08,
 * 지난번 값·다시 동의한 뒤 = ‘광고’ 표시 + “새로 확인하기”/“확인하기” → 광고 → F-08. 자산이 없으면 누를 수 없음
 */
export function RankBanner() {
  const r = useRank();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const s = r.state;
  if (s.kind === 'empty') return <RankRow badge="?%" title={copy.rankEmpty} />;
  const tap = (kind: 'unseen' | 'seen' | 'stale') =>
    track('rank_banner_tapped', { state: kind, entry: 'assets' });
  if (r.pair.mode === 'peer')
    return (
      <RankRow
        badge={copy.rankPeerBadge}
        title={copy.rankPeer}
        action="›"
        onClick={() => {
          tap('unseen');
          nav(RANK_PATH);
        }}
      />
    );
  const withAd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshRankWithAd(nav, qc);
    } finally {
      setBusy(false);
    }
  };
  if (s.kind === 'seen')
    return (
      <RankRow
        badge={`${s.pct}%`}
        title={copy.rankSeen(s.pct, r.pair.top_open)}
        action={copy.rankSeenMore(Number(s.month.slice(5, 7)))}
        onClick={() => {
          tap('seen');
          nav(RANK_PATH);
        }}
      />
    );
  if (s.kind === 'unseen' && !r.viewed)
    return (
      <RankRow
        badge="?%"
        title={copy.rankQ}
        action={copy.rankCheck}
        onClick={() => {
          tap('unseen');
          nav(RANK_PATH);
        }}
      />
    );
  return (
    <RankRow
      badge={s.kind === 'stale' ? `${s.pct}%` : '?%'}
      title={s.kind === 'stale' ? copy.rankStale(s.pct) : copy.rankQ}
      action={s.kind === 'stale' ? copy.rankRefresh : copy.rankCheck}
      ad
      adLabel={copy.rankAd}
      onClick={() => {
        tap(s.kind === 'stale' ? 'stale' : 'unseen');
        void withAd();
      }}
    />
  );
}
