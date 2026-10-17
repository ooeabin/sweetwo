import { monthGrid } from '@sweetwo/core';
import { Button, Calendar, Icon } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { markOf, moneyLine, useCalendarData } from '../data';
import { money as won, useMask } from '../../../shared/mask';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];

// Y-04 달력(월 보기, docs/spec/24-calendar.md 10~13번): 돈 날짜는 검정 점 + 고른 날 일정 목록에서 흐린 글자 + 갈 화면(읽기 전용),
// 월말 정리 기간 띠, 챙길 날 막대(양가 family, 우리 둘 together). 날짜를 누르면 그날 일정, 챙길 날 → Y-05.
// 고른 날 아래 ‘이 날에 챙길 날 추가’ → Y-07(날짜 채움). 공휴일·설·추석 연휴 띠는 다음 단계.
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
    return {
      ...c,
      money: shown.some((x) => x.date === c.date),
      marks: cs.map((x) => markOf(x.care)),
      band: inBand(c.date),
      label: copy.dayLabel(cm, cd, n),
    };
  });
  const move = (n: number) => {
    const t = y * 12 + (m - 1) + n;
    setYm([Math.floor(t / 12), (t % 12) + 1]);
  };
  const [, sm, sd] = ymd(selected);
  const dow = DOW[new Date(`${selected}T00:00:00Z`).getUTCDay()] ?? '';
  const today = shown.filter((x) => x.date === selected);
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
            <i className="hg-cal__mark hg-mark--family" />
            {copy.legendCare}
          </span>
          <span>
            <i className="hg-cal__dot" />
            {copy.legendMoney}
          </span>
        </div>
        <div className="hg-cal__agenda" aria-live="polite">
          <span className="hg-cal__date">{copy.agendaDate(sm, sd, dow)}</span>
          {!today.length && !dayCares.length && <span className="hg-help">{copy.agendaEmpty}</span>}
          {dayCares.map((x) => (
            <button
              key={x.care.id}
              type="button"
              className="hg-cal__event"
              onClick={() => nav(`/calendar/day/${x.care.id}`)}
            >
              <i className={`hg-mark--${markOf(x.care)}`} />
              <span>{x.care.name}</span>
              <b>{won(x.care.budget, masked)}</b>
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
