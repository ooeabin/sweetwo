import { fetchRecentCloses, qk } from '@sweetwo/api';
import { spendChanges } from '@sweetwo/core';
import { MonthSummary } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { closeSummaryProps, useCloseData } from '../month-close';
import { copy } from './copy';

// F-01 17번 월 정산 요약: 가장 최근 끝낸 월말 정리(실제값), W-04g 맨 위와 같은 MonthSummary.
// 지난달보다 = 그 전 정리와 변동 항목별 차이. 정리 기록이 없으면 빈 상태.
export function MonthSummaryCard() {
  const d = useCloseData(false);
  const closes = useQuery({ queryKey: qk.recentCloses, queryFn: () => fetchRecentCloses(2) });
  if (d.loading || closes.isLoading) return null;
  const [last, prev] = closes.data ?? [];
  if (!last)
    return (
      <section className="hg-card" aria-label={copy.summaryName}>
        <p className="hg-card__meta">{copy.summaryEmpty}</p>
      </section>
    );
  const names = new Map(d.cats.map((c) => [c.id, c.name]));
  const changes = prev
    ? spendChanges(last.spends, prev.spends).flatMap((x) => {
        const name = names.get(x.category_id);
        return name ? [{ name, diff: x.diff }] : [];
      })
    : undefined;
  return (
    <MonthSummary
      {...closeSummaryProps(last, d, Number(last.label_month.slice(5, 7)))}
      changes={changes}
    />
  );
}
