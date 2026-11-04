import { formatYm, readWon } from '@sweetwo/core';
import { assetGroupsOf } from '@sweetwo/core';
import {
  assetIcon,
  Button,
  Icon,
  Lead,
  List,
  ListRow,
  MonthBars,
  SectionHeader,
} from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { RankBanner } from '../../frame';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { useAssetsData } from '../data';

// F-01 한눈에(23 F-01·F-02 2~4번, 2026-11-03 다시 짬): “우리 순자산” 큰 숫자 + 지난달 대비 문장,
// 달마다 순자산 막대(MonthBars, 최근 6달), 목록(자산 → F-02, 부채 → F-02, 예상 순자산과 안 판 수익). 비상금 카드, 이번 달 카드·계획, 월 정산 요약, 재정 진단은 재기획으로 없앰(ADR 0003).
export function F01Overview() {
  const nav = useNavigate();
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);

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
    body = null;
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
            <Icon name={assetIcon(g.key)} />
            {g.name}
          </button>
        ))}
      </div>
    );
    body = (
      <>
        <RankBanner entry="assets" />
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
    const now = d.series[d.series.length - 1];
    const short = (v: number) => m(v).replace(/ 원$/, '');
    body = (
      <>
        {/* 2026-11-04 순위 줄(23 F-01 0번)은 한눈에 맨 위 */}
        <RankBanner entry="assets" />
        <section
          className="hg-stack"
          style={{ gap: 'var(--space-1)' }}
          aria-label={copy.ourNetWorth}
        >
          <span className="hg-networth__label">{copy.ourNetWorth}</span>
          <span className="hg-networth__value">{m(nw.net)}</span>
          {d.change !== null && d.change !== 0 && (
            <span className={d.change > 0 ? 'hg-networth__delta' : 'hg-networth__delta is-down'}>
              {copy.lastMonth} <b>{m(Math.abs(d.change))}</b>{' '}
              {d.change > 0 ? copy.grew : copy.shrank}
            </span>
          )}
        </section>
        <section className="hg-card hg-stack" aria-label={copy.monthly}>
          <h2 className="hg-card__label">{copy.monthly}</h2>
          <MonthBars
            label={now ? `${copy.monthly}, ${formatYm(now.month)} ${m(now.net)}` : copy.monthly}
            nowText={now ? short(now.net) : undefined}
            bars={d.series.map((x, i) => ({
              key: x.month,
              label: `${Number(x.month.slice(5, 7))}월`,
              value: x.net,
              tip: `${formatYm(x.month)} ${m(x.net)}`,
              now: i === d.series.length - 1,
            }))}
          />
        </section>
        <List>
          <ListRow
            lead={<Lead icon="wallet" />}
            label={copy.assetsLabel}
            value={m(nw.assets)}
            onClick={() => nav('/assets/items?side=asset')}
          />
          <ListRow
            lead={<Lead icon="bank" />}
            label={copy.debtsLabel}
            value={nw.debts ? m(nw.debts) : readWon(0)}
            onClick={() => nav('/assets/items?side=debt')}
          />
          {nw.gain !== 0 && (
            <ListRow
              lead={<Lead icon="trending-up" />}
              label={copy.expectedName}
              sub={copy.gainIncl(`${nw.gain > 0 ? '+' : '−'}${m(Math.abs(nw.gain))}`)}
              value={m(nw.expected)}
            />
          )}
        </List>
      </>
    );
  }
  return <AssetsFrame tab="overview">{body}</AssetsFrame>;
}
