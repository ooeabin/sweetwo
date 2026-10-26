import { isFestive, monthGrid } from '@sweetwo/core';
import { Button, Calendar, Icon } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { moneyLine, reviewMonth, useCalendarData } from '../data';
import { money as won, useMask } from '../../../shared/mask';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];

// Y-04 달력(월 보기, 24 Y-01·Y-04 7~10번, 재기획): 돈 일정은 검정 작은 점 + 고른 날 목록에서 라벨 + 갈 화면(읽기 전용),
// 월말 확인 띠(다음 월급날 3일 전 ~ 전날, 누르면 W-05), 챙길 날은 영역 색 점 한 가지(together). 날짜를 누르면 그날 일정, 챙길 날 → Y-05.
// 고른 날 아래 ‘이 날에 챙길 날 추가’ → Y-07(날짜 채움). 공휴일은 빨간 숫자 + 이름(고른 날 목록 맨 위), 설·추석 연휴 띠.
export function Y04Calendar() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const [ty, tm] = ymd(d.today);
  const [ym, setYm] = useState<[number, number]>([ty, tm]);
  const [selected, setSelected] = useState<string>(d.today);
  const { masked } = useMask();
  const [y, m] = ym;
  if (d.loading) return <CalendarFrame view="month">{null}</CalendarFrame>;

  const { dates, bands } = d.monthOf(y, m);
  const shown = filter === 'care' ? [] : dates;
  const cares = filter === 'money' ? [] : d.caresOf(y, m);
  const inBand = (s: string) => filter !== 'care' && bands.some((b) => s >= b.start && s <= b.end);
  const grid = monthGrid(y, m).map((c) => {
    const cs = cares.filter((x) => x.date === c.date);
    const n = shown.filter((x) => x.date === c.date).length + cs.length;
    const [, cm, cd] = ymd(c.date);
    const hol = d.holidayOf(c.date);
    return {
      ...c,
      money: shown.some((x) => x.date === c.date),
      marks: cs.map(() => 'together' as const),
      band: inBand(c.date),
      // 칸에는 짧게(대체공휴일(개천절) → 대체공휴일), 전체 이름은 화면 읽기와 아래 목록
      holiday: hol?.name.replace(/\(.*\)$/, ''),
      festive: !!hol && isFestive(hol.name),
      label: copy.dayLabel(cm, cd, n, hol?.name),
    };
  });
  const move = (n: number) => {
    const t = y * 12 + (m - 1) + n;
    setYm([Math.floor(t / 12), (t % 12) + 1]);
  };
  const [, sm, sd] = ymd(selected);
  const dow = DOW[new Date(`${selected}T00:00:00Z`).getUTCDay()] ?? '';
  // 월말 확인은 아래 띠 줄로 보여 줌
  const today = shown.filter((x) => x.date === selected && x.kind !== 'review');
  const selHoliday = d.holidayOf(selected);
  const selBand =
    filter === 'care' ? undefined : bands.find((b) => selected >= b.start && selected <= b.end);
  // 고른 날이 보이는 달 밖이면 그 달 챙길 날을 따로 계산
  const [sy, smo] = ymd(selected);
  const dayCares = (
    sy === y && smo === m ? cares : filter === 'money' ? [] : d.caresOf(sy, smo)
  ).filter((x) => x.date === selected);

  return (
    <CalendarFrame view="month">
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
        prevLabel={copy.prev}
        nextLabel={copy.next}
        filter={<FilterChips value={filter} onChange={setFilter} />}
      >
        <div className="hg-cal__legend" aria-hidden="true">
          <span>
            <i className="hg-cal__mark hg-mark--together" />
            {copy.legendCare}
          </span>
          <span>
            <i className="hg-cal__dot" />
            {copy.legendMoney}
          </span>
        </div>
        <div className="hg-cal__agenda" aria-live="polite">
          <span className="hg-cal__date">{copy.agendaDate(sm, sd, dow)}</span>
          {selHoliday && (
            <div className="hg-cal__event is-holiday">
              <i />
              <span>{selHoliday.name}</span>
            </div>
          )}
          {selBand && (
            <button
              type="button"
              className="hg-cal__event is-money"
              onClick={() => nav('/salary/review')}
            >
              <i />
              <span>{copy.reviewBand(reviewMonth(selBand.end))}</span>
              <span className="hg-cal__go">
                {copy.go.review}
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          )}
          {!today.length && !dayCares.length && !selHoliday && !selBand && (
            <span className="hg-help">{copy.agendaEmpty}</span>
          )}
          {dayCares.map((x) => (
            <button
              key={x.care.id}
              type="button"
              className="hg-cal__event"
              onClick={() => nav(`/calendar/day/${x.care.id}`)}
            >
              <i className="hg-mark--together" />
              <span>{x.care.name}</span>
              {x.care.budget > 0 && <b>{won(x.care.budget, masked)}</b>}
            </button>
          ))}
          {today.map((x, i) => {
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
      </Calendar>
    </CalendarFrame>
  );
}
