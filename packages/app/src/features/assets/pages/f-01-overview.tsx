import { readWon } from '@sweetwo/core';
import { Button, EmptyState } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { AssetsFrame } from '../assets-frame';
import { NetWorthChart } from '../net-worth-chart';
import { copy } from '../copy';
import { useAssetsData } from '../data';

// F-01 한눈에(23 F-01·F-02 2~4번): 순자산(원금 기준) + 예상 순자산·안 판 수익 + 지난달 대비와 순자산 그래프,
// 자산·부채 합계(→ F-02). 비상금 카드, 이번 달 카드·계획, 월 정산 요약, 재정 진단은 재기획으로 없앰(ADR 0003).
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
    body = (
      <>
        <NetWorthChart d={d} />
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
      </>
    );
  }
  return <AssetsFrame tab="overview">{body}</AssetsFrame>;
}
