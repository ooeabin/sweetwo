import {
  debtRatioPct,
  formatYm,
  RANK_AGE_MEDIAN,
  RANK_AGE_STATS,
  RANK_BASIS,
  rankBracket,
  rankChange,
  rankNextStep,
  rankTopPct,
  todayKst,
} from '@sweetwo/core';
import { Distribution, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { MainFrame, useRank, useRankAge } from '../../frame';
import { copy } from '../copy';

// F-08 우리 자산 순위(23 F-08, 계산·배분 7-7, 2026-11-04 1단계 공공 통계): 상위 n% + 분포 그림 + 중앙값 + 우리 값 + 기준.
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
  if (!r) return <MainFrame sub="detail" current="assets" columns={[null]} />;
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
  const body = (
    <div key="r" className="hg-stack hg-detail" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.rankTitle} backLabel={copy.back} onBack={() => nav(-1)} />
      <section className="hg-card hg-stack" aria-label={copy.rankTitle}>
        <Distribution
          label={copy.rankCompare}
          tag={<span className="hg-tag">{copy.rankPublic}</span>}
          title={copy.rankBig(p)}
          sub={copy.rankBasis(RANK_BASIS.label, formatYm(RANK_BASIS.asOf.slice(0, 8) + '01'))}
          percentile={100 - p}
          axis={copy.rankAxis}
          youLabel={copy.rankYou}
          ariaLabel={copy.rankAria(p)}
        />
      </section>
      <div className="hg-list">
        <ListRow label={copy.rankOurs(month)} value={money(r.net, masked)} chevron={false} />
        {change && prevMonth && (
          <ListRow
            label={copy.rankPrev(prevMonth)}
            sub={copy.rankPrevSub(prevMonth, change.prev)}
            value={
              change.up > 0
                ? copy.rankUp(change.up)
                : change.up < 0
                  ? copy.rankDown(-change.up)
                  : copy.rankSame
            }
            chevron={false}
          />
        )}
        {next && (
          <ListRow
            label={copy.rankNextStep(next.top)}
            value={money(next.need, masked)}
            chevron={false}
          />
        )}
        <ListRow
          label={copy.rankMedian}
          value={money(RANK_BASIS.medianNet, masked)}
          chevron={false}
        />
      </div>
      {age && (
        <section className="hg-stack" aria-label={copy.rankAgeTitle(bandName)}>
          <SectionHeader title={copy.rankAgeTitle(bandName)} />
          <div className="hg-list">
            <ListRow
              label={copy.rankAgeMedian(bandName)}
              sub={
                r.net >= RANK_AGE_MEDIAN[age]
                  ? copy.rankAgeAbove(bandName)
                  : copy.rankAgeBelow(bandName)
              }
              value={money(RANK_AGE_MEDIAN[age], masked)}
              chevron={false}
            />
            {stats && debt !== null && (
              <ListRow
                label={copy.rankDebt}
                sub={copy.rankAgeAvg(bandName, Math.round(stats.debtPct))}
                value={copy.rankOurPct(debt)}
                chevron={false}
              />
            )}
            {stats && v.financialPct !== null && (
              <ListRow
                label={copy.rankFinancial}
                sub={copy.rankAgeAvg(bandName, Math.round(stats.financialPct))}
                value={copy.rankOurPct(v.financialPct)}
                chevron={false}
              />
            )}
          </div>
        </section>
      )}
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
