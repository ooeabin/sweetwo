import { readWon } from '@sweetwo/core';
import { Button, EmptyState } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { useMonthView } from '../../month';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { useAssetsData } from '../data';

// F-01 한눈에(docs/spec/23-assets.md 2~4·15번): 순자산(원금 기준) + 예상 순자산·안 판 수익 + 지난달 대비,
// 자산·부채 합계(→ F-02), 이번 달 카드(→ 이번 달), 이번 달 계획(월 수입, 지출, 저축 가능).
// 진단 줄(F-06), 순자산 그래프, 월 정산 요약은 다음 단계.
export function F01Overview() {
  const nav = useNavigate();
  const d = useAssetsData();
  const mv = useMonthView();
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
    body = (
      <EmptyState
        title={copy.empty}
        action={
          <Button variant="primary" onClick={() => nav('/assets/new?side=asset')}>
            {copy.addAsset}
          </Button>
        }
      />
    );
  } else {
    const nw = d.nw;
    const monthText = !mv
      ? ''
      : mv.hasSplit
        ? mv.pendingSplit.count
          ? copy.monthSplit(mv.month, mv.pendingSplit.count)
          : copy.monthSplitDone
        : copy.monthLiving(mv.month, m(Math.max(mv.living.left, 0)));
    body = (
      <>
        <section className="hg-card hg-stack" aria-label={copy.netWorth}>
          <span className="hg-networth__label">{copy.netWorth}</span>
          <span className="hg-networth__value">{m(nw.net)}</span>
          {nw.gain !== 0 && (
            <span className="hg-networth__expected">
              {copy.expected(m(nw.expected))}
              {', '}
              {copy.gain(`${nw.gain > 0 ? '+' : '−'}${m(Math.abs(nw.gain))}`)}
            </span>
          )}
          {d.change !== null && d.change !== 0 && (
            <span>
              <em className={d.change > 0 ? 'hg-pill-up' : 'hg-pill-down'}>
                {d.change > 0 ? copy.up(m(d.change)) : copy.down(m(-d.change))}
              </em>
            </span>
          )}
        </section>
        <div className="hg-cards">
          <button
            type="button"
            className="hg-card hg-card--raised"
            onClick={() => nav('/assets/items?side=asset')}
          >
            <span className="hg-card__label">{copy.assetsLabel}</span>
            <span className="hg-card__value">{m(nw.assets)}</span>
          </button>
          <button
            type="button"
            className="hg-card hg-card--raised"
            onClick={() => nav('/assets/items?side=debt')}
          >
            <span className="hg-card__label">{copy.debtsLabel}</span>
            <span className="hg-card__value">{nw.debts ? m(nw.debts) : readWon(0)}</span>
          </button>
        </div>
        {mv && (
          <div className="hg-cards">
            <button type="button" className="hg-card hg-card--raised" onClick={() => nav('/')}>
              <span className="hg-card__label">{copy.monthCard}</span>
              <span>{monthText}</span>
            </button>
            <button
              type="button"
              className="hg-card hg-card--raised"
              aria-label={copy.planCard}
              onClick={() => nav('/assets/money')}
            >
              <span className="hg-card__label">{copy.planCard}</span>
              <span className="hg-row" style={{ gap: 'var(--space-6)' }}>
                <span className="hg-stack" style={{ gap: 0 }}>
                  <span className="hg-help">{copy.planIncome}</span>
                  <b>{m(mv.monthPlan.income)}</b>
                </span>
                <span className="hg-stack" style={{ gap: 0 }}>
                  <span className="hg-help">{copy.planSpend}</span>
                  <b>{m(mv.monthPlan.spend)}</b>
                </span>
              </span>
              <span className="hg-card__meta">
                {copy.planSaveable(m(Math.max(mv.monthPlan.saveable, 0)))}
              </span>
            </button>
          </div>
        )}
      </>
    );
  }
  return <AssetsFrame tab="overview">{body}</AssetsFrame>;
}
