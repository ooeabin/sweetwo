import { dday, formatMonthDay, withinDays, type MoneyDate } from '@sweetwo/core';
import { Button, EmptyState, ListRow, SectionHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money as won, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { moneyLine, useCalendarData } from '../data';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';
import { reviewMonth } from '../data';

// Y-01 일정 목록(24 Y-01 4~10번, 재기획): 보기 필터(전체·챙길 날·돈 일정), 기록 없이 7일 지난 날은 맨 위 ‘기록하기’(→ Y-08),
// 다음 챙길 날 카드(D-day, 이름, 날짜, 금액 메모, 준비하기 → Y-05), 60일 안 챙길 날(행 → Y-05), 돈 일정(작은 줄, 누르면 해당 화면),
// 드린 기록(→ Y-09). 챙길 날이 없으면 빈 상태 + ‘챙길 날 추가’(돈 일정은 그대로 보임). “돈 일정”이면 4·6번 숨김.
export function Y01CareList() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const { masked } = useMask();
  const m = (x: number) => won(x, masked);
  if (d.loading) return <CalendarFrame view="list">{null}</CalendarFrame>;

  const [y, mo] = d.today.split('-').map(Number) as [number, number];
  const months: [number, number][] = [0, 1, 2].map((n) => {
    const t = y * 12 + (mo - 1) + n;
    return [Math.floor(t / 12), (t % 12) + 1];
  });
  const money: MoneyDate[] = months
    .flatMap(([yy, mm]) => d.monthOf(yy, mm).dates)
    .filter((x) => withinDays(d.today, x.date, 60));
  // 8번 월말 확인 띠: 오늘이 다음 월급날 3일 전 ~ 전날이면 → W-05
  const band = d.monthOf(y, mo).bands.find((b) => d.today >= b.start && d.today <= b.end);
  const soon = d.upcoming.filter((x) => withinDays(d.today, x.date, 60));
  const next = d.upcoming[0];
  const add = () => {
    startCareAdd();
    nav('/calendar/add/a');
  };

  return (
    <CalendarFrame view="list">
      <FilterChips value={filter} onChange={setFilter} />
      {band && filter !== 'care' && (
        <button
          type="button"
          className="hg-banner hg-banner--info"
          onClick={() => nav('/salary/review')}
        >
          <span>{copy.reviewBand(reviewMonth(band.end))}</span>
        </button>
      )}
      {filter !== 'money' &&
        (!d.cares.length ? (
          <EmptyState
            title={copy.empty}
            action={
              <Button variant="primary" onClick={add}>
                {copy.emptyAdd}
              </Button>
            }
          />
        ) : (
          <>
            {!!d.overdue.length && (
              <section className="hg-stack" aria-label={copy.overdueList}>
                <SectionHeader title={copy.overdueList} />
                <div className="hg-list">
                  {d.overdue.map((x) => (
                    <ListRow
                      key={x.care.id}
                      label={x.care.name}
                      sub={`${formatMonthDay(x.date)}, ${copy.overdue}`}
                      value={copy.recordNow}
                      onClick={() => nav(`/calendar/day/${x.care.id}/record/a?on=${x.date}`)}
                    />
                  ))}
                </div>
              </section>
            )}
            {next && (
              <section className="hg-card hg-stack" aria-label={copy.nextCare}>
                <span className="hg-card__label">{copy.dday(dday(d.today, next.date))}</span>
                <b>{next.care.name}</b>
                <span className="hg-card__meta">{formatMonthDay(next.date)}</span>
                {next.care.budget > 0 && <span>{copy.memoAmount(m(next.care.budget))}</span>}
                <div className="hg-row">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => nav(`/calendar/day/${next.care.id}`)}
                  >
                    {copy.prepare}
                  </Button>
                  {/* 그날이 되면 목록에서도 ‘다녀왔어요’ → Y-08(24 Y-05 4번) */}
                  {next.date <= d.today && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => nav(`/calendar/day/${next.care.id}/record/a?on=${next.date}`)}
                    >
                      {copy.statuses.done}
                    </Button>
                  )}
                </div>
              </section>
            )}
            <section className="hg-stack" aria-label={copy.careList}>
              <SectionHeader title={copy.careList} />
              {!soon.length ? (
                <p className="hg-card__meta" style={{ margin: 0 }}>
                  {copy.none60}
                </p>
              ) : (
                <div className="hg-list">
                  {soon.map((x) => (
                    <ListRow
                      key={x.care.id}
                      label={x.care.name}
                      sub={formatMonthDay(x.date)}
                      value={x.care.budget > 0 ? m(x.care.budget) : undefined}
                      onClick={() => nav(`/calendar/day/${x.care.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ))}
      {filter !== 'care' && (
        <section className="hg-stack" aria-label={copy.listMoney}>
          <SectionHeader title={copy.listMoney} />
          {!money.length ? (
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
      {filter !== 'money' && !!d.cares.length && (
        <div className="hg-list">
          <ListRow label={copy.gifted} onClick={() => nav('/calendar/gifts')} />
        </div>
      )}
    </CalendarFrame>
  );
}
