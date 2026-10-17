import { formatMonthDay, withinDays, type MoneyDate } from '@sweetwo/core';
import { EmptyState, ListRow, SectionHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { moneyLine, useCalendarData } from '../data';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';

// Y-01 챙길 날 목록(docs/spec/24-calendar.md 4~9·12번): 보기 필터(전체·챙길 날·돈 날짜), 60일 안 돈 날짜는 같은 목록에 작은 줄
// (누르면 해당 화면). 챙길 날은 등록 전 빈 상태. 다음 챙길 날 카드, 양가 비용, 가족, 드린 기록, Y-02 처음 등록은 다음 단계.
export function Y01CareList() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  if (d.loading) return <CalendarFrame view="list">{null}</CalendarFrame>;

  const [y, m] = d.today.split('-').map(Number) as [number, number];
  const months: [number, number][] = [0, 1, 2].map((n) => {
    const t = y * 12 + (m - 1) + n;
    return [Math.floor(t / 12), (t % 12) + 1];
  });
  const money: MoneyDate[] = months
    .flatMap(([yy, mm]) => d.monthOf(yy, mm).dates)
    .filter((x) => withinDays(d.today, x.date, 60));
  const thisMonth = d.monthOf(y, m).dates;

  return (
    <CalendarFrame view="list">
      <FilterChips value={filter} onChange={setFilter} />
      {filter !== 'money' && <EmptyState title={copy.empty} />}
      {filter !== 'care' && (
        <section className="hg-stack" aria-label={copy.listMoney}>
          <SectionHeader title={copy.listMoney} />
          {filter === 'money' && !thisMonth.length && !money.length ? (
            <p className="hg-card__meta" style={{ margin: 0 }}>
              {copy.noMoneyThisMonth}
            </p>
          ) : (
            <div className="hg-list">
              {money.map((x, i) => {
                const l = moneyLine(x);
                return (
                  <ListRow
                    key={`${x.date}-${x.kind}-${i}`}
                    label={l.label}
                    sub={formatMonthDay(x.date)}
                    value={l.go}
                    onClick={() => nav(l.to)}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </CalendarFrame>
  );
}
