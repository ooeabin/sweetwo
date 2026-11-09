import { formatYm } from '@sweetwo/core';
import { MonthBars, SectionHeader } from '@sweetwo/ui';
import { money, useMask } from '../../shared/mask';
import { copy } from './copy';
import type { NetWorthView } from './data';

// H-04 자산(19 이번 달 5번, 2026-11-03 F-01과 같게): “순자산” + 큰 숫자 + “지난달보다 180만 원 늘었어요”
// + 최근 6달 막대(MonthBars, 이번 달만 진한 초록) + ‘자산 더보기’ → F-01. 계산은 F-01과 같음(core netWorth).
// 자산이 하나도 없으면 홈에서 카드 자체를 숨김(소비자).
export function H06NetWorth({ n }: { n: NetWorthView }) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const now = n.series[n.series.length - 1];
  // 다른 영역처럼 카드 위 제목 줄 “자산” + “자산 더보기 ›”(2026-11-03)
  return (
    <section className="hg-stack" aria-label={copy.assetsTitle}>
      <SectionHeader title={copy.assetsTitle} more={{ label: copy.assetsMore, href: '/assets' }} />
      <section className="hg-card hg-stack" aria-label={copy.ourNetWorth}>
        <div className="hg-stack" style={{ gap: 'var(--space-1)' }}>
          <span className="hg-networth__label">{copy.ourNetWorth}</span>
          <span className="hg-networth__value hg-networth__value--card">{m(n.nw.net)}</span>
          {n.change !== null && n.change !== 0 && (
            <span className={n.change > 0 ? 'hg-networth__delta' : 'hg-networth__delta is-down'}>
              {copy.lastMonth} <b>{m(Math.abs(n.change))}</b>{' '}
              {n.change > 0 ? copy.grew : copy.shrank}
            </span>
          )}
        </div>
        <MonthBars
          label={
            now ? `${copy.netWorthGraph}, ${formatYm(now.month)} ${m(now.net)}` : copy.netWorthGraph
          }
          nowText={now ? m(now.net).replace(/ 원$/, '') : undefined}
          bars={n.series.map((x, i) => ({
            key: x.month,
            label: `${Number(x.month.slice(5, 7))}월`,
            value: x.net,
            tip: `${formatYm(x.month)} ${m(x.net)}`,
            now: i === n.series.length - 1,
          }))}
        />
      </section>
    </section>
  );
}
