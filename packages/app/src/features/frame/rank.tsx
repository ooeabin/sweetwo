import { fetchPartnerBirthYear, qk, updateMe } from '@sweetwo/api';
import {
  rankAgeBand,
  rankState,
  rankTopOpen,
  rankTopPct,
  todayKst,
  type RankAgeBand,
  type RankState,
} from '@sweetwo/core';
import { RankRow } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useMe, useNetWorth, type NetWorthView } from './data';

export const RANK_PATH = '/assets/rank';

/** 순위 배너 상태(계산·배분 7-7): 자산 없음 / 안 봄 / 이번 달 봄 / 지난번 값 */
export function useRank(): { state: RankState; net: number; view: NetWorthView } | null {
  const me = useMe();
  const nw = useNetWorth(true);
  if (!me.data || !nw) return null;
  const thisMonth = `${todayKst().slice(0, 7)}-01`;
  return {
    net: nw.nw.net,
    view: nw,
    state: rankState({
      hasItems: !nw.empty,
      net: nw.nw.net,
      thisMonth,
      seen: { month: me.data.rank_month, pct: me.data.rank_pct, net: me.data.rank_net },
    }),
  };
}

/** 연령대 비교(계산·배분 7-7): 나와 파트너 출생연도 평균 나이. 아무도 안 적었으면 null */
export function useRankAge(): RankAgeBand | null {
  const me = useMe();
  const py = useQuery({ queryKey: qk.partnerBirthYear, queryFn: fetchPartnerBirthYear });
  if (!me.data) return null;
  return rankAgeBand([me.data.birth_year, py.data ?? null], Number(todayKst().slice(0, 4)));
}

// 모바일 앱이면 보상형 광고(ADR 0006). 브라우저(브리지 없음)와 못 불러오면 광고 없이 바로
async function watchAd(): Promise<'rewarded' | 'closed' | 'failed' | 'none'> {
  const ads = typeof window !== 'undefined' ? window.sweetwo?.ads : undefined;
  if (!ads) return 'none';
  try {
    return await ads.rewarded();
  } catch {
    return 'failed';
  }
}

/**
 * 자산 순위 줄(RankRow, 23 F-01 0번·19 H-01 1a): 안 봄·지난번이면 ‘광고’ 표시 + 확인하기 → 광고 → 순위 저장 → F-08,
 * 이번 달에 봤으면 바로 F-08. 자산이 없으면 홈에서는 자산 관리(F-01)로, F-01에서는 누를 수 없음
 */
export function RankBanner({ entry }: { entry: 'home' | 'assets' }) {
  const r = useRank();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const s = r.state;
  const open = async () => {
    if (busy) return;
    track('rank_banner_tapped', { state: s.kind, entry });
    if (s.kind === 'empty') return nav('/assets');
    if (s.kind === 'seen') return nav(RANK_PATH);
    setBusy(true);
    try {
      const ad = await watchAd();
      track('rank_ad_result', { result: ad });
      if (ad === 'closed') return toast(copy.rankAdClosed);
      const month = `${todayKst().slice(0, 7)}-01`;
      await updateMe({ rank_month: month, rank_pct: rankTopPct(r.net), rank_net: r.net });
      await qc.invalidateQueries({ queryKey: qk.me });
      nav(RANK_PATH);
    } catch {
      nav(RANK_PATH); // 저장에 실패해도 순위는 보여 줌(다음에 다시 물음)
    } finally {
      setBusy(false);
    }
  };
  if (s.kind === 'empty')
    return (
      <RankRow
        badge="?%"
        title={copy.rankEmpty}
        action={entry === 'home' ? copy.rankEmptyGo : undefined}
        onClick={entry === 'home' ? () => void open() : undefined}
      />
    );
  if (s.kind === 'seen')
    return (
      <RankRow
        badge={`${s.pct}%`}
        title={copy.rankSeen(s.pct, s.pct === 10 && rankTopOpen(r.net))}
        action={copy.rankSeenMore(Number(s.month.slice(5, 7)))}
        onClick={() => void open()}
      />
    );
  return (
    <RankRow
      badge={s.kind === 'stale' ? `${s.pct}%` : '?%'}
      title={s.kind === 'stale' ? copy.rankStale(s.pct) : copy.rankQ}
      action={s.kind === 'stale' ? copy.rankRefresh : copy.rankCheck}
      ad
      adLabel={copy.rankAd}
      onClick={() => void open()}
    />
  );
}
