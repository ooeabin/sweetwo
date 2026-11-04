import { formatYm, RANK_BASIS, rankBracket, rankTopPct, todayKst } from '@sweetwo/core';
import { Distribution, ListRow, PageHeader } from '@sweetwo/ui';
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { MainFrame, useRank } from '../../frame';
import { copy } from '../copy';

// F-08 우리 자산 순위(23 F-08, 계산·배분 7-7, 2026-11-04 1단계 공공 통계): 상위 n% + 분포 그림 + 중앙값 + 우리 값 + 기준.
// 순위 배너에서 엶(광고는 배너에서). 이번 달에 저장한 값이 아니면(직접 연 경우) 지금 순자산으로 계산해 보여 줌
export function F08Rank() {
  const nav = useNavigate();
  const r = useRank();
  const { masked } = useMask();
  const pct = r ? rankTopPct(r.net) : null;
  useEffect(() => {
    if (pct !== null)
      track('rank_viewed', { top_band: Math.ceil(pct / 10) * 10, basis: 'public_2024' });
  }, [pct]);
  if (!r) return <MainFrame sub="detail" current="assets" columns={[null]} />;
  if (r.state.kind === 'empty') return <Navigate to="/assets" replace />;
  const p = pct ?? 99;
  const month = Number(todayKst().slice(5, 7));
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
        <ListRow
          label={copy.rankMedian}
          value={money(RANK_BASIS.medianNet, masked)}
          chevron={false}
        />
      </div>
      <p className="hg-help">{copy.rankNote}</p>
      <p className="hg-help">{copy.rankNext}</p>
      {/* 우리 구간(접근성·테스트용): 분포 그림과 같은 값 */}
      <span className="hg-sr">{copy.rankBracket(rankBracket(r.net))}</span>
    </div>
  );
  return <MainFrame sub="detail" current="assets" columns={[body]} />;
}
