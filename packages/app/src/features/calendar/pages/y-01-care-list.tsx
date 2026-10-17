import { dday, formatMonthDay, withinDays, type MoneyDate } from '@sweetwo/core';
import { Button, EmptyState, ListRow, SectionHeader } from '@sweetwo/ui';
import { money as won, useMask } from '../../../shared/mask';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { carerLabel, moneyLine, sideLabel, useCalendarData } from '../data';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';
import { startFamilyAdd } from './y-03-family';

// Y-01 챙길 날 목록(docs/spec/24-calendar.md 4~9·12번): 보기 필터(전체·챙길 날·돈 날짜), 60일 안 돈 날짜는 같은 목록에 작은 줄
// (누르면 해당 화면). 다음 챙길 날 카드(4번, 준비하기 → Y-05), 60일 안 챙길 날(5번, 행 → Y-05).
// 기록 없이 7일 지난 날은 맨 위에 ‘기록하기’(→ Y-08). 가족(8번): 찬우 쪽 / 예빈 쪽 두 줄, 호칭 + 다음 생일 D-day(호칭 → Y-03 수정, ‘추가’ → Y-03).
// 양가 비용(7번) → Y-06, 드린 기록(9번) → Y-09. 등록 전 빈 상태 + Y-02 처음 등록.
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
  const thisMonth = d.monthOf(y, mo).dates;
  const soon = d.upcoming.filter((x) => withinDays(d.today, x.date, 60));
  const next = d.upcoming[0];
  const birthdayOf = (id: string) =>
    d.upcoming.find((x) => x.care.member_id === id && x.care.kind === 'birthday')?.date ?? null;

  return (
    <CalendarFrame view="list">
      <FilterChips value={filter} onChange={setFilter} />
      {filter !== 'money' &&
        (!d.cares.length ? (
          <EmptyState
            title={copy.empty}
            action={
              <Button variant="primary" onClick={() => nav('/calendar/setup/a')}>
                {copy.startSetup}
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
                <span className="hg-card__meta">
                  {formatMonthDay(next.date)}, {carerLabel(next.care, d.names)}
                </span>
                <span>{next.care.budget ? copy.budget(m(next.care.budget)) : copy.zeroBudget}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => nav(`/calendar/day/${next.care.id}`)}
                >
                  {copy.prepare}
                </Button>
              </section>
            )}
            <section className="hg-card hg-stack" aria-label={copy.fcTitle}>
              <span className="hg-card__label">{copy.fcTitle}</span>
              <b>
                {d.familyCost.engaged
                  ? copy.fcSpentEngaged(m(d.familyCost.total), m(d.familyCost.spent))
                  : copy.fcSpent(m(d.familyCost.total), m(d.familyCost.spent))}
              </b>
              {!d.familyCost.engaged && (
                <span className="hg-card__meta">{copy.fcHeld(m(d.familyCost.held))}</span>
              )}
              <Button
                variant="secondary"
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => nav('/calendar/family-cost')}
              >
                {copy.see}
              </Button>
            </section>
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
                      sub={`${formatMonthDay(x.date)}, ${sideLabel(x.care, d.names)}, ${carerLabel(x.care, d.names)}`}
                      value={m(x.care.budget)}
                      onClick={() => nav(`/calendar/day/${x.care.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
            <section className="hg-stack" aria-label={copy.familyTitle}>
              <div className="hg-row" style={{ justifyContent: 'space-between' }}>
                <SectionHeader title={copy.familyTitle} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    startFamilyAdd();
                    nav('/calendar/family/new/a');
                  }}
                >
                  {copy.familyAdd}
                </Button>
              </div>
              <div className="hg-card hg-stack">
                {(['groom', 'bride'] as const).map((side) => {
                  const people = d.family.filter((f) => f.side === side);
                  return (
                    <div key={side} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
                      <span className="hg-card__label">
                        {copy.side(side === 'groom' ? d.names.groom : d.names.bride)}
                      </span>
                      {!people.length ? (
                        <span className="hg-help">{copy.familyEmpty}</span>
                      ) : (
                        <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          {people.map((f) => {
                            const b = birthdayOf(f.id);
                            return (
                              <Button
                                key={f.id}
                                variant="secondary"
                                size="sm"
                                onClick={() => nav(`/calendar/family/${f.id}/c`)}
                              >
                                {copy.familyItem(f.title, b ? copy.dday(dday(d.today, b)) : null)}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="hg-list">
              <ListRow label={copy.gifted} onClick={() => nav('/calendar/gifts')} />
            </div>
          </>
        ))}
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
