import { addDays, isFestive, monthGrid } from '@sweetwo/core';
import { Button, Calendar, Icon } from '@sweetwo/ui';
import { Fragment, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { moneyLine, reviewMonth, useCalendarData } from '../data';
import { money as won, useMask } from '../../../shared/mask';
import { CalendarFrame, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];

// Y-04 달력(월 보기, 24 Y-01·Y-04 7~10번, 재기획): 돈 일정은 검정 작은 점 + 고른 날 목록에서 라벨 + 갈 화면(읽기 전용),
// 월말 확인 띠(다음 월급날 3일 전 ~ 전날, 누르면 W-05), 챙길 날은 영역 색 점 한 가지(together). 날짜를 누르면 그날 일정, 챙길 날 → Y-05.
// 고른 날 아래 ‘이 날에 챙길 날 추가’ → Y-07(날짜 채움). 공휴일은 빨간 숫자 + 이름(고른 날 목록 맨 위), 설·추석 연휴 띠.
// 2026-11-03 주 단위로 접기(카카오페이 ‘접기’처럼): 처음엔 고른 날이 든 한 주만 + 그 주 일정을 날짜별로, ‘펼치기’면 한 달 + 고른 날 일정.
// 접혔을 때 ‹ ›는 한 주씩. 고른 날 일정이 탭 막대에 가려지지 않게.
export function Y04Calendar() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const [ty, tm] = ymd(d.today);
  const [ym, setYm] = useState<[number, number]>([ty, tm]);
  const [selected, setSelected] = useState<string>(d.today);
  const [open, setOpen] = useState(false);
  const { masked } = useMask();
  const frame = (children: ReactNode) => (
    <CalendarFrame view="month" filter={filter} onFilter={setFilter}>
      {children}
    </CalendarFrame>
  );
  if (d.loading) return frame(null);

  const [sy, smo] = ymd(selected);
  // 접혔으면 고른 날의 달, 펼쳤으면 넘겨 본 달
  const [y, m] = open ? ym : [sy, smo];
  const moneyOf = (date: string) => {
    if (filter === 'care') return [];
    const [cy, cm] = ymd(date);
    return d.monthOf(cy, cm).dates.filter((x) => x.date === date);
  };
  const caresOn = (date: string) => {
    if (filter === 'money') return [];
    const [cy, cm] = ymd(date);
    return d.caresOf(cy, cm).filter((x) => x.date === date);
  };
  const bandOn = (date: string) => {
    if (filter === 'care') return undefined;
    const [cy, cm] = ymd(date);
    return d.monthOf(cy, cm).bands.find((b) => date >= b.start && date <= b.end);
  };
  const weekStart = addDays(selected, -new Date(`${selected}T00:00:00Z`).getUTCDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const grid = monthGrid(y, m)
    .filter((c) => open || week.includes(c.date))
    .map((c) => {
      const cs = caresOn(c.date);
      const ms = moneyOf(c.date);
      const [, cm, cd] = ymd(c.date);
      const hol = d.holidayOf(c.date);
      return {
        ...c,
        // 접힌 한 주는 달이 바뀌어도 흐리게 하지 않음
        muted: open ? c.muted : false,
        money: ms.length > 0,
        marks: cs.map(() => 'together' as const),
        band: !!bandOn(c.date),
        // 칸에는 짧게(대체공휴일(개천절) → 대체공휴일), 전체 이름은 화면 읽기와 아래 목록
        holiday: hol?.name.replace(/\(.*\)$/, ''),
        festive: !!hol && isFestive(hol.name),
        label: copy.dayLabel(cm, cd, ms.length + cs.length, hol?.name),
      };
    });
  const move = (n: number) => {
    if (!open) {
      setSelected(addDays(selected, n * 7));
      return;
    }
    const t = y * 12 + (m - 1) + n;
    setYm([Math.floor(t / 12), (t % 12) + 1]);
  };

  /** 그날 일정 줄들(공휴일, 월말 확인 띠, 챙길 날, 돈 일정). 없으면 null */
  // 접힌 주에서 월말 확인 띠는 그 주에서 처음 걸린 날에 한 번만
  const firstBand = week.find((x) => bandOn(x));
  const dayItems = (date: string) => {
    const hol = d.holidayOf(date);
    const band = open || date === firstBand ? bandOn(date) : undefined;
    // 월말 확인은 띠 줄로 보여 줌
    const ms = moneyOf(date).filter((x) => x.kind !== 'review');
    const cs = caresOn(date);
    if (!hol && !band && !ms.length && !cs.length) return null;
    return (
      <>
        {hol && (
          <div className="hg-cal__event is-holiday">
            <i />
            <span>{hol.name}</span>
          </div>
        )}
        {band && (
          <button
            type="button"
            className="hg-cal__event is-money"
            onClick={() => nav('/salary/review')}
          >
            <i />
            <span>{copy.reviewBand(reviewMonth(band.end))}</span>
            <span className="hg-cal__go">
              {copy.go.review}
              <Icon name="chevron-right" size={16} />
            </span>
          </button>
        )}
        {cs.map((x) => (
          <Fragment key={x.care.id}>
            <button
              type="button"
              className="hg-cal__event"
              onClick={() => nav(`/calendar/day/${x.care.id}`)}
            >
              <i className="hg-mark--together" />
              <span>{x.care.name}</span>
              {x.care.budget > 0 && <b>{won(x.care.budget, masked)}</b>}
            </button>
            {/* 그날이 된 챙길 날은 달력에서도 ‘다녀왔어요’ → Y-08(24 Y-05 4번) */}
            {x.date <= d.today && !(x.care.status === 'done' && x.care.status_on === x.date) && (
              <Button
                variant="ghost"
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => nav(`/calendar/day/${x.care.id}/record/a?on=${x.date}`)}
              >
                {copy.statuses.done}
              </Button>
            )}
          </Fragment>
        ))}
        {ms.map((x, i) => {
          const l = moneyLine(x);
          return (
            <button
              key={`${x.kind}-${i}`}
              type="button"
              className="hg-cal__event is-money"
              onClick={() => nav(l.to)}
            >
              <i />
              <span>{l.label}</span>
              <span className="hg-cal__go">
                {l.go}
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          );
        })}
      </>
    );
  };
  const dateLabel = (date: string) => {
    const [, mm, dd] = ymd(date);
    return copy.agendaDate(mm, dd, DOW[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '');
  };
  // 펼침: 고른 날만. 접힘: 그 주에서 일정 있는 날(없으면 고른 날 + ‘없어요’)
  const days = open ? [selected] : week.filter((x) => dayItems(x) !== null);
  const shownDays = days.length ? days : [selected];

  return frame(
    <Calendar
      year={y}
      month={m}
      yearLabel={copy.yearLabel(y)}
      monthLabel={copy.monthLabel(m)}
      days={grid}
      today={d.today}
      selected={selected}
      onSelect={setSelected}
      onPrev={() => move(-1)}
      onNext={() => move(1)}
      prevLabel={open ? copy.prev : copy.prevWeek}
      nextLabel={open ? copy.next : copy.nextWeek}
    >
      {open &&
        filter !== 'care' &&
        d
          .monthOf(y, m)
          .bands.filter((b) => b.start.slice(0, 7) === `${y}-${String(m).padStart(2, '0')}`)
          .map((b) => (
            <span key={b.start} className="hg-help hg-cal__legend">
              {copy.bandLegend(ymd(b.start)[2], ymd(b.end)[2])}
            </span>
          ))}
      <button
        type="button"
        className="hg-cal__fold"
        aria-expanded={open}
        onClick={() => {
          if (!open) setYm([sy, smo]);
          setOpen(!open);
        }}
      >
        {open ? copy.fold : copy.unfold}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </button>
      <div className="hg-cal__agenda" aria-live="polite">
        {shownDays.map((date) => (
          <Fragment key={date}>
            <span className="hg-cal__date">{dateLabel(date)}</span>
            {dayItems(date) ?? (
              <span className="hg-help">{open ? copy.agendaEmpty : copy.weekEmpty}</span>
            )}
          </Fragment>
        ))}
        {selected >= d.today && (
          <Button
            variant="ghost"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              startCareAdd(selected);
              nav('/calendar/add/a');
            }}
          >
            {copy.addOnDay}
          </Button>
        )}
      </div>
    </Calendar>,
  );
}
