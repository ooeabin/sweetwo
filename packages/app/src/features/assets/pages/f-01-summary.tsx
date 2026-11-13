import { assetGroupsOf, formatYm, readWon } from '@sweetwo/core';
import { Button, Lead, leadOf, List, ListRow, MonthBars, SectionHeader, Toggle } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { netWorthTrend, RankBanner, SkelBody } from '../../frame';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { AssetArt } from '../asset-art';

// F-01 요약(23 F-01·F-02 2~4번, 2026-11-03 다시 짬, 2026-11-13 v2.2 ‘F-01 고친 점’): “순자산” 큰 숫자(평가금액 기준) + 지난달 대비 문장,
// 달마다 순자산 막대(MonthBars, 최근 6달), 목록(자산 → F-02, 부채 → F-02), 맨 아래 전환 “원금으로 보기”.
// 예전 ‘예상 순자산’ 줄은 한 숫자 + 전환으로 바꿈. 비상금 카드, 이번 달 카드·계획, 월 정산 요약, 재정 진단은 재기획으로 없앰(ADR 0003).
export function F01Summary() {
  const nav = useNavigate();
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [principal, setPrincipal] = useState(false);

  let body;
  if (d.failed) {
    body = (
      <div className="hg-card hg-stack">
        <p className="hg-card__meta">{copy.loadFailed}</p>
        <Button variant="primary" onClick={d.retry}>
          {copy.retry}
        </Button>
      </div>
    );
  } else if (d.loading) {
    body = <SkelBody shape="cards" />;
  } else if (!d.items.length && !d.sums.length) {
    // 2026-11-04 항목별 등록 유도: 순위 줄 + 자산 묶음 타일 + 부채 묶음 타일(F-03a와 같은 타일, 누르면 그 묶음을 고른 F-03a)
    const tiles = (side: 'asset' | 'debt') => (
      <div
        className="hg-pick hg-pick--tiles"
        role="group"
        aria-label={side === 'asset' ? copy.emptyAssetsQ : copy.emptyDebtsQ}
      >
        {assetGroupsOf(side).map((g) => (
          <button
            key={g.key}
            type="button"
            className="hg-pick__item"
            onClick={() => nav(`/assets/new?side=${side}&grp=${g.key}`)}
          >
            <AssetArt group={g.key} />
            {g.name}
          </button>
        ))}
      </div>
    );
    body = (
      <>
        <RankBanner />
        {/* 2026-11-13 F-03q 빠르게 적기 입구(F-01 빈 상태) */}
        <List>
          <ListRow label={copy.quickEntry} onClick={() => nav('/assets/quick')} />
        </List>
        <section
          className="hg-stack"
          style={{ gap: 'var(--space-3)' }}
          aria-label={copy.emptyAssetsQ}
        >
          <SectionHeader title={copy.emptyAssetsQ} />
          {tiles('asset')}
        </section>
        <section
          className="hg-stack"
          style={{ gap: 'var(--space-3)' }}
          aria-label={copy.emptyDebtsQ}
        >
          <SectionHeader title={copy.emptyDebtsQ} />
          {tiles('debt')}
        </section>
      </>
    );
  } else {
    const nw = d.nw;
    const t = netWorthTrend(d.history, nw, principal);
    const series = t.series.slice(-6);
    const change = t.change;
    const now = series[series.length - 1];
    const short = (v: number) => m(v).replace(/ 원$/, '');
    body = (
      <>
        {/* 2026-11-04 순위 줄(23 F-01 0번)은 요약 맨 위 */}
        <RankBanner />
        <section
          className="hg-stack"
          style={{ gap: 'var(--space-1)' }}
          aria-label={copy.ourNetWorth}
        >
          <span className="hg-networth__label">{copy.ourNetWorth}</span>
          <span className="hg-networth__value">{m(principal ? nw.principalNet : nw.net)}</span>
          {change !== null && change !== 0 && (
            <span className={change > 0 ? 'hg-networth__delta' : 'hg-networth__delta is-down'}>
              {copy.lastMonth} <b>{m(Math.abs(change))}</b> {change > 0 ? copy.grew : copy.shrank}
            </span>
          )}
        </section>
        <section className="hg-card hg-stack" aria-label={copy.monthly}>
          <h2 className="hg-card__label">{copy.monthly}</h2>
          <MonthBars
            label={now ? `${copy.monthly}, ${formatYm(now.month)} ${m(now.net)}` : copy.monthly}
            nowText={now ? short(now.net) : undefined}
            bars={series.map((x, i) => ({
              key: x.month,
              label: `${Number(x.month.slice(5, 7))}월`,
              value: x.net,
              tip: `${formatYm(x.month)} ${m(x.net)}`,
              now: i === series.length - 1,
            }))}
          />
        </section>
        <List>
          <ListRow
            lead={<Lead {...leadOf('summary', 'assets')} />}
            label={copy.assetsLabel}
            value={m(nw.assets)}
            onClick={() => nav('/assets/items?side=asset')}
          />
          <ListRow
            lead={<Lead {...leadOf('summary', 'debts')} />}
            label={copy.debtsLabel}
            value={nw.debts ? m(nw.debts) : readWon(0)}
            onClick={() => nav('/assets/items?side=debt')}
          />
        </List>
        {/* 23 F-01 고친 점: 평가금액 기준이 기본, 켜면 원금 기준(06 6장). 원금을 적은 항목이 없으면 같은 값 */}
        <div className="hg-card">
          <Toggle
            label={copy.principalView}
            help={copy.principalViewHelp}
            checked={principal}
            onChange={(on) => setPrincipal(on)}
          />
        </div>
      </>
    );
  }
  return <AssetsFrame tab="overview">{body}</AssetsFrame>;
}
