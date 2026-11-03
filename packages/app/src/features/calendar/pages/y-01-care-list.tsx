import { dday, formatDateWeekday, formatMonthDay, withinDays, type MoneyDate } from '@sweetwo/core';
import { Button, EmptyState, Icon, ListRow, SectionHeader } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { money as won, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { moneyLine, useCalendarData } from '../data';
import { CalendarFrame, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';
import { reviewMonth } from '../data';

// Y-01 일정 목록(24 Y-01 4~10번, 2026-11-03 다시 짬): 보기 필터와 목록/달력은 한 줄(frame), 기록 없이 7일 지난 날은
// 맨 위 회색 띠 “기록할 날이 1개 있어요”(→ Y-08), 다음 챙길 날 카드(D-day, 이름, 날짜, 금액 메모, 준비하기 → Y-05),
// “다가오는 일정” 한 목록(60일 안 챙길 날 + 돈 일정, 날짜순, 오른쪽 D-day, 챙길 날은 영역 색 막대, 돈 일정은 검정 점),
// 드린 기록(→ Y-09). 챙길 날이 없으면 빈 상태 + ‘챙길 날 추가’(돈 일정은 그대로 보임). “돈 일정”이면 4·6번 숨김.
export function Y01CareList() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const { masked } = useMask();
  const m = (x: number) => won(x, masked);
  const frame = (children: ReactNode) => (
    <CalendarFrame view="list" filter={filter} onFilter={setFilter}>
      {children}
    </CalendarFrame>
  );
  if (d.loading) return frame(null);

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

  // 다가오는 일정: 챙길 날과 돈 일정을 날짜순 한 목록으로
  type Row = { key: string; date: string; label: string; sub: string; care: boolean; to: string };
  const rows: Row[] = [
    ...(filter === 'money'
      ? []
      : soon.map((x) => ({
          key: `c-${x.care.id}`,
          date: x.date,
          label: x.care.name,
          sub: x.care.budget > 0 ? `${formatDateWeekday(x.date)}, ${m(x.care.budget)}` : formatDateWeekday(x.date),
          care: true,
          to: `/calendar/day/${x.care.id}`,
        }))),
    ...(filter === 'care'
      ? []
      : money.map((x, i) => {
          const l = moneyLine(x);
          return {
            key: `m-${x.date}-${x.kind}-${i}`,
            date: x.date,
            label: l.label,
            sub: formatDateWeekday(x.date),
            care: false,
            to: l.to,
          };
        })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const first = d.overdue[0];

  return frame(
    <>
      {band && filter !== 'care' && (
        <button
          type="button"
          className="hg-banner hg-banner--info"
          onClick={() => nav('/salary/review')}
        >
          <span>{copy.reviewBand(reviewMonth(band.end))}</span>
        </button>
      )}
      {filter !== 'money' && first && (
        <button
          type="button"
          className="hg-recband"
          onClick={() => nav(`/calendar/day/${first.care.id}/record/a?on=${first.date}`)}
        >
          <span className="hg-recband__icon" aria-hidden="true">
            <Icon name="pencil" />
          </span>
          <span className="hg-recband__text">
            <b>{copy.recordCount(d.overdue.length)}</b>
            <span>{copy.recordWhich(first.care.name, formatMonthDay(first.date), d.overdue.length - 1)}</span>
          </span>
          <span className="hg-chevron" aria-hidden="true" />
        </button>
      )}
      {filter !== 'money' && !d.cares.length && (
        <EmptyState
          title={copy.empty}
          action={
            <Button variant="secondary" onClick={add}>
              {copy.emptyAdd}
            </Button>
          }
        />
      )}
      {filter !== 'money' && next && (
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
      <section className="hg-stack" aria-label={copy.upcomingList}>
        <SectionHeader title={copy.upcomingList} />
        {!rows.length ? (
          <p className="hg-card__meta" style={{ margin: 0 }}>
            {filter === 'money' ? copy.noMoney60 : copy.none60}
          </p>
        ) : (
          <div className="hg-list">
            {rows.map((r) => {
              const n = dday(d.today, r.date);
              return (
                <ListRow
                  key={r.key}
                  lead={
                    <span className="hg-cal__lead" aria-hidden="true">
                      <i className={r.care ? 'hg-cal__mark hg-mark--together' : 'hg-cal__dot'} />
                    </span>
                  }
                  label={r.label}
                  sub={r.sub}
                  value={
                    <span className={n <= 7 ? 'hg-cal__dday is-near' : 'hg-cal__dday'}>
                      {copy.dday(n)}
                    </span>
                  }
                  onClick={() => nav(r.to)}
                />
              );
            })}
          </div>
        )}
      </section>
      {filter !== 'money' && !!d.cares.length && (
        <div className="hg-list">
          <ListRow label={copy.gifted} onClick={() => nav('/calendar/gifts')} />
        </div>
      )}
    </>,
  );
}
