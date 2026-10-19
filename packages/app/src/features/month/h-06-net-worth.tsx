import { formatYm } from '@sweetwo/core';
import { LineChart } from '@sweetwo/ui';
import { money, useMask } from '../../shared/mask';
import { copy } from './copy';
import type { NetWorthView } from './data';

const signed = (v: number, m: (n: number) => string) => `${v > 0 ? '+' : '−'}${m(Math.abs(v))}`;

// H-06 순자산(19 이번 달 6번): “8,420만 원” / “예상 8,540만” / “안 판 수익 +120만” / “지난달보다 +210만 원” + 6개월 그래프.
// 계산·회색 줄 규칙은 F-01과 같음(core netWorth). 누르면 F-01.
export function H06NetWorth({ n, onOpen }: { n: NetWorthView; onOpen: () => void }) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  if (n.empty)
    return (
      <section className="hg-card hg-card--fill hg-stack" aria-label={copy.netWorth}>
        <p className="hg-card__meta">{copy.netWorthEmpty}</p>
        <button type="button" className="hg-btn hg-btn--link" onClick={onOpen}>
          {copy.netWorthSee}
        </button>
      </section>
    );
  return (
    <div className="hg-stack">
      <LineChart
        label={copy.netWorth}
        value={m(n.nw.net)}
        sub={
          n.nw.gain !== 0 ? (
            <span className="hg-networth__expected">
              {copy.netWorthExpected(m(n.nw.expected))}
              {', '}
              {copy.netWorthGain(signed(n.nw.gain, m))}
            </span>
          ) : undefined
        }
        delta={
          n.change !== null && n.change !== 0
            ? {
                dir: n.change > 0 ? 'up' : 'down',
                text: copy.netWorthChange(signed(n.change, m)),
              }
            : undefined
        }
        points={n.series.map((x) => ({
          label: formatYm(x.month),
          value: x.net,
          expected: x.expected,
        }))}
        format={m}
        name={copy.netWorth}
        expectedName={copy.netWorthExpectedName}
        expectedText={copy.netWorthExpected}
        plotLabel={copy.netWorthGraph}
      />
      <button type="button" className="hg-btn hg-btn--link" onClick={onOpen}>
        {copy.netWorthSee}
      </button>
    </div>
  );
}
