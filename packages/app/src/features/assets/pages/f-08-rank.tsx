import { fetchOpenRankRequest, qk, updateMe, type Me } from '@sweetwo/api';
import {
  formatYm,
  RANK_BASIS,
  rankBracket,
  rankChange,
  rankNextStep,
  rankTopOpen,
  todayKst,
  type RankPairResponse,
} from '@sweetwo/core';
import {
  Band,
  Button,
  Distribution,
  ListRow,
  PageHeader,
  RankRow,
  StatBlock,
  Toggle,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import {
  LoadingFrame,
  MainFrame,
  recordFirstRank,
  RankAdRequired,
  refreshRankWithAd,
  useRank,
  type RankNavState,
} from '../../frame';
import { copy } from '../copy';
import { useAssetsData } from '../data';

type Pair = Extract<RankPairResponse, { mode: 'pair' }>;
type Shown = { pct: number; net: number; open: boolean; month: string };

// F-08 자산 순위 v2.2(23 ‘F-08 자산 순위 v2.2’, 06 7-8, ADR 0009 결정 11).
// (가) 연결 + 두 사람 모두 동의: 둘의 합 순위. 첫 결과는 광고 없이(record_rank_view), 그 뒤 ‘새로 확인하기’만 보상형 광고.
//     지금 서버에 연령대 안 분포가 없어 basis = 'all' → “전체 가구 가운데”, “전체 가구 기준이에요”(연령대라고 하지 않음).
//     분포·다음 칸까지·지난달 대비는 예전 그대로(값은 둘의 합). ‘홈에 보여 주기’ 스위치(기본 끔).
// (나) 그 밖: 순위 없이 또래 가구 중간값 한 줄(peer_median, 내 출생연도 연령대), 내 숫자와 나란히 놓지 않음, 광고 없음.
//     연결이면 “{이름}님과 같이 순위 보기” → F-08c. 출생연도가 없으면 6a ‘출생연도 알려 주기’.
// 예전 6번 연령대 비교 문장, ‘우리 자산은 전체 가구 중’, 매번 광고는 없앰.
export function F08Rank() {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const r = useRank();
  const d = useAssetsData();
  const nav0 = (loc.state as RankNavState | null) ?? null;
  const [first, setFirst] = useState<Pair | null>(null);
  const [busy, setBusy] = useState(false);
  const recording = useRef(false);
  const tracked = useRef(false);
  const openReq = useQuery({ queryKey: qk.rankRequest, queryFn: fetchOpenRankRequest });
  const { masked } = useMask();

  const pair = r?.pair.mode === 'pair' ? r.pair : null;
  const fresh = nav0?.fresh.mode === 'pair' ? nav0.fresh : null;
  // 첫 결과 무료: 본 적이 없으면 들어오자마자 기록(광고 없음). 서버가 이미 봤다고 하면 광고 단계로
  const needFirst = !!pair && !fresh && r?.viewed === false && !first;
  useEffect(() => {
    if (!needFirst || recording.current) return;
    recording.current = true;
    recordFirstRank(qc)
      .then((x) => {
        if (x.mode === 'pair') setFirst(x);
        track('rank_viewed', { first_free: true, ad_result: 'none', mode: 'pair' });
        tracked.current = true;
      })
      .catch((e: unknown) => {
        if (!(e instanceof RankAdRequired)) toast(copy.consentFailed);
        void qc.invalidateQueries({ queryKey: qk.rankViewed });
      });
  }, [needFirst, qc]);

  const got = fresh ?? first;
  const shownNow: Shown | null = !pair
    ? null
    : got
      ? {
          pct: got.top_pct,
          net: got.net,
          open: got.top_open,
          month: `${todayKst().slice(0, 7)}-01`,
        }
      : storedOf(r?.me ?? null);
  const hasShown = !!shownNow;
  useEffect(() => {
    if (!r || tracked.current) return;
    if (r.pair.mode === 'peer') {
      track('rank_viewed', { first_free: false, ad_result: 'none', mode: 'peer_median' });
      tracked.current = true;
    } else if (hasShown && !needFirst) {
      track('rank_viewed', {
        first_free: false,
        ad_result: nav0?.adResult ?? 'none',
        mode: 'pair',
      });
      tracked.current = true;
    }
  }, [r, hasShown, needFirst, nav0]);

  if (!r || d.loading || needFirst) return <LoadingFrame sub="detail" current="assets" />;
  const header = <PageHeader title={copy.rankTitle} backLabel={copy.back} onBack={() => nav(-1)} />;

  // ───── (나) 순위 없음 ─────
  if (r.pair.mode === 'peer') {
    const p = r.pair;
    const c = d.couple;
    const req = openReq.data;
    const fromPartner = req && req.from_user !== r.me.id;
    const partner = c?.partnerName || '';
    const body = (
      <div key="r" className="hg-stack hg-detail" style={{ gap: 'var(--space-6)' }}>
        {header}
        {p.median !== null && p.band ? (
          <StatBlock
            ariaLabel={copy.rankTitle}
            title={copy.rankPeerLine(money(p.median, masked))}
            sub={`${copy.rankPeerBand(copy.rankAge[p.band])}, ${copy.rankBasis(
              RANK_BASIS.label,
              formatYm(RANK_BASIS.asOf.slice(0, 8) + '01'),
            )}`}
          />
        ) : (
          <div className="hg-list hg-list--plain">
            <ListRow
              label={copy.rankAskBirth}
              sub={copy.rankAskBirthSub}
              onClick={() => nav('/settings/me/birth-year?from=rank')}
            />
          </div>
        )}
        {c?.joined && (
          <>
            <Band />
            {req && !fromPartner ? (
              <p className="hg-help">{copy.rankAskWaiting(partner)}</p>
            ) : (
              <div>
                <Button
                  variant="link"
                  onClick={() =>
                    nav(fromPartner ? `/assets/rank/consent/${req.id}` : '/assets/rank/consent')
                  }
                >
                  {fromPartner ? copy.rankAskAnswer(partner) : copy.rankAskPair(partner)}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
    return <MainFrame sub="detail" current="assets" columns={[body]} />;
  }

  // ───── (가) 둘의 합 순위 ─────
  const pr = r.pair;
  const s = r.state;
  const stale = !got && s.kind === 'stale';
  const withAd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshRankWithAd(nav, qc);
      tracked.current = false;
    } finally {
      setBusy(false);
    }
  };
  const adRow = (
    <RankRow
      badge={stale && shownNow ? `${shownNow.pct}%` : '?%'}
      title={
        stale && shownNow ? copy.rankStaleNote(Number(shownNow.month.slice(5, 7))) : copy.rankNotYet
      }
      action={copy.rankRefreshAd}
      ad
      adLabel={copy.rankAd}
      onClick={() => void withAd()}
    />
  );
  if (!shownNow) {
    // 다시 동의한 뒤(저장 순위 없음, 본 적은 있음): 광고 뒤 확인
    const body = (
      <div key="r" className="hg-stack hg-detail" style={{ gap: 'var(--space-6)' }}>
        {header}
        {adRow}
      </div>
    );
    return <MainFrame sub="detail" current="assets" columns={[body]} />;
  }
  const v = shownNow;
  const band = pr.basis === 'age' && pr.band ? copy.rankAge[pr.band] : null;
  const month = Number(v.month.slice(5, 7));
  const change = rankChange(r.view.prev?.net ?? null, v.net);
  const prevMonth = r.view.prev ? Number(r.view.prev.month.slice(5, 7)) : null;
  const next = rankNextStep(v.net);
  const body = (
    <div key="r" className="hg-stack hg-detail" style={{ gap: 'var(--space-6)' }}>
      {header}
      {stale && adRow}
      <section aria-label={copy.rankTitle}>
        <Distribution
          hero
          title={
            <>
              {copy.rankPairHero1(band)}
              <br />
              {copy.rankHero2(v.pct, v.open || rankTopOpen(v.net))}
            </>
          }
          note={
            change && prevMonth ? (
              change.up === 0 ? (
                copy.rankSame(prevMonth)
              ) : (
                <>
                  {copy.rankPrev(prevMonth)}
                  <b>{copy.rankPp(Math.abs(change.up))}</b>
                  {change.up > 0 ? copy.rankUp : copy.rankDown}
                </>
              )
            ) : undefined
          }
          noteDown={!!change && change.up < 0}
          sub={copy.rankBasis(RANK_BASIS.label, formatYm(RANK_BASIS.asOf.slice(0, 8) + '01'))}
          percentile={100 - v.pct}
          axis={copy.rankAxis}
          youLabel={copy.rankYou}
          ariaLabel={copy.rankAria(v.pct)}
        />
      </section>
      <p className="hg-help" style={{ textAlign: 'center', margin: 0 }}>
        {copy.rankPairNote}
        <br />
        {copy.rankPairBasis(band)}
      </p>
      {next && (
        <>
          <Band />
          <StatBlock
            ariaLabel={copy.rankNextLabel(next.top)}
            label={copy.rankNextLabel(next.top)}
            big={copy.rankNextBig(money(next.need, masked))}
            sub={copy.rankNextSub(money(v.net + next.need, masked), next.top)}
          />
        </>
      )}
      <Band />
      <div className="hg-list hg-list--plain">
        <ListRow label={copy.rankPairOurs(month)} value={money(v.net, masked)} chevron={false} />
        <ListRow
          label={copy.rankMedian}
          value={money(RANK_BASIS.medianNet, masked)}
          chevron={false}
        />
      </div>
      {/* 23 F-08 v2.2: ‘홈에 보여 주기’(rank_badge_home, H-04 배지) 기본 끔, (가)일 때만 */}
      <div className="hg-card">
        <Toggle
          label={copy.rankHomeBadge}
          checked={r.me.rank_badge_home}
          onChange={async (on) => {
            try {
              await updateMe({ rank_badge_home: on });
              track('rank_badge_toggled', { on });
              await qc.invalidateQueries({ queryKey: qk.me });
            } catch {
              toast(copy.saveFailed);
            }
          }}
        />
      </div>
      {/* 우리 구간(접근성·테스트용): 분포 그림과 같은 값 */}
      <span className="hg-sr">{copy.rankBracket(rankBracket(v.net))}</span>
    </div>
  );
  return <MainFrame sub="detail" current="assets" columns={[body]} />;
}

/** 저장한 순위(record_rank_view가 pair일 때 씀). 동의를 끄면 서버가 지움 */
function storedOf(me: Me | null): Shown | null {
  if (!me?.rank_month || me.rank_pct == null || me.rank_net == null) return null;
  return {
    pct: me.rank_pct,
    net: me.rank_net,
    open: rankTopOpen(me.rank_net),
    month: me.rank_month,
  };
}
