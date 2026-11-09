import {
  debtRatioPct,
  formatYm,
  RANK_AGE_MEDIAN,
  RANK_AGE_STATS,
  RANK_BASIS,
  rankBracket,
  rankChange,
  rankNextStep,
  rankTopOpen,
  rankTopPct,
  todayKst,
} from '@sweetwo/core';
import { Band, Distribution, ListRow, PageHeader, StatBlock } from '@sweetwo/ui';
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { LoadingFrame, MainFrame, useRank, useRankAge } from '../../frame';
import { copy } from '../copy';

// F-08 자산 순위(23 F-08, 계산·배분 7-7, 2026-11-04 1단계 공공 통계): 상위 n% + 분포 그림 + 중앙값 + 우리 값 + 기준.
// 순위 배너에서 엶(광고는 배너에서). 이번 달에 저장한 값이 아니면(직접 연 경우) 지금 순자산으로 계산해 보여 줌
export function F08Rank() {
  const nav = useNavigate();
  const r = useRank();
  const age = useRankAge();
  const { masked } = useMask();
  const pct = r ? rankTopPct(r.net) : null;
  useEffect(() => {
    if (pct !== null)
      track('rank_viewed', {
        top_band: Math.ceil(pct / 10) * 10,
        basis: 'public_2025',
        age_band: age,
      });
  }, [pct, age]);
  if (!r) return <LoadingFrame sub="detail" current={'assets'} />;
  if (r.state.kind === 'empty') return <Navigate to="/assets" replace />;
  const p = pct ?? 99;
  const month = Number(todayKst().slice(5, 7));
  const v = r.view;
  const change = rankChange(v.prev?.net ?? null, r.net);
  const prevMonth = v.prev ? Number(v.prev.month.slice(5, 7)) : null;
  const next = rankNextStep(r.net);
  const debt = debtRatioPct(v.nw.assets, v.nw.debts);
  const bandName = age ? copy.rankAge[age] : '';
  const stats = age ? RANK_AGE_STATS[age] : null;
  const ageMedian = age ? RANK_AGE_MEDIAN[age] : 0;
  const body = (
    <div key="r" className="hg-stack hg-detail" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.rankTitle} backLabel={copy.back} onBack={() => nav(-1)} />
      {/* 1 히어로: 두 줄 문장 + 지난달 대비 + 분포 곡선 + 기준 */}
      <section aria-label={copy.rankTitle}>
        <Distribution
          hero
          title={
            <>
              {copy.rankHero1}
              <br />
              {copy.rankHero2(p, rankTopOpen(r.net))}
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
          percentile={100 - p}
          axis={copy.rankAxis}
          youLabel={copy.rankYou}
          ariaLabel={copy.rankAria(p)}
        />
      </section>
      {next && (
        <>
          <Band />
          <StatBlock
            ariaLabel={copy.rankNextLabel(next.top)}
            label={copy.rankNextLabel(next.top)}
            big={copy.rankNextBig(money(next.need, masked))}
            sub={copy.rankNextSub(money(r.net + next.need, masked), next.top)}
          />
        </>
      )}
      {age && (
        <>
          <Band />
          <section className="hg-stack" aria-label={copy.rankAgeTitle(bandName)}>
            <StatBlock
              as="div"
              title={copy.rankAgeTitle(bandName)}
              sub={
                r.net >= ageMedian ? (
                  <>
                    {copy.rankAgeMore(bandName)}
                    <b>{money(r.net - ageMedian, masked)}</b>
                    {copy.rankAgeMoreTail}
                  </>
                ) : (
                  copy.rankAgeBelow(bandName)
                )
              }
            />
            <div className="hg-list hg-list--plain">
              <ListRow
                label={copy.rankAgeMedian(bandName)}
                value={money(ageMedian, masked)}
                chevron={false}
              />
              {stats && debt !== null && (
                <ListRow
                  label={copy.rankDebt}
                  sub={copy.rankAgeAvg(bandName, Math.round(stats.debtPct))}
                  value={copy.rankPct(debt)}
                  chevron={false}
                />
              )}
              {stats && v.financialPct !== null && (
                <ListRow
                  label={copy.rankFinancial}
                  sub={copy.rankAgeAvg(bandName, Math.round(stats.financialPct))}
                  value={copy.rankPct(v.financialPct)}
                  chevron={false}
                />
              )}
            </div>
          </section>
        </>
      )}
      <Band />
      <div className="hg-list hg-list--plain">
        <ListRow label={copy.rankOurs(month)} value={money(r.net, masked)} chevron={false} />
        <ListRow
          label={copy.rankMedian}
          value={money(RANK_BASIS.medianNet, masked)}
          chevron={false}
        />
      </div>
      {age && (
        <div className="hg-help" style={{ textAlign: 'center' }}>
          {copy.rankAgeNote}
        </div>
      )}
      {/* 우리 구간(접근성·테스트용): 분포 그림과 같은 값 */}
      <span className="hg-sr">{copy.rankBracket(rankBracket(r.net))}</span>
    </div>
  );
  return <MainFrame sub="detail" current="assets" columns={[body]} />;
}
