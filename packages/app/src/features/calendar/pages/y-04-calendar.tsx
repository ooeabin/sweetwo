import { monthGrid } from '@sweetwo/core';
import { Calendar, Icon } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { moneyLine, useCalendarData } from '../data';
import { CalendarFrame, FilterChips, useCalFilter } from '../frame';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];

// Y-04 달력(월 보기, docs/spec/24-calendar.md 10~13번): 돈 날짜는 검정 점 + 고른 날 일정 목록에서 흐린 글자 + 갈 화면(읽기 전용),
// 월말 정리 기간 띠. 날짜를 누르면 그날 일정. 챙길 날(막대), 날짜 → Y-07, 공휴일·설·추석 띠는 다음 단계.
export function Y04Calendar() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const [ty, tm] = ymd(d.today);
  const [ym, setYm] = useState<[number, number]>([ty, tm]);
  const [selected, setSelected] = useState<string>(d.today);
  const [y, m] = ym;
  if (d.loading) return <CalendarFrame view="month">{null}</CalendarFrame>;

  const { dates, bands } = d.monthOf(y, m);
  const shown = filter === 'care' ? [] : dates;
  const inBand = (s: string) => filter !== 'care' && bands.some((b) => s >= b.start && s <= b.end);
  const grid = monthGrid(y, m).map((c) => {
    const n = shown.filter((x) => x.date === c.date).length;
    const [, cm, cd] = ymd(c.date);
    return {
      ...c,
      money: n > 0,
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
          {!today.length && <span className="hg-help">{copy.agendaEmpty}</span>}
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
        </div>
      </Calendar>
    </CalendarFrame>
  );
}
