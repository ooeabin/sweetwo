import { dday, isFestive, monthGrid, type MoneyKind } from '@sweetwo/core';
import {
  Band,
  Button,
  type CalDay,
  Calendar,
  icon3d,
  type IconName,
  Lead,
  ListRow,
} from '@sweetwo/ui';
import { Fragment, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { moneyLine, reviewMonth, useCalendarData } from '../data';
import { money as won, useMask } from '../../../shared/mask';
import { SkelBody } from '../../frame';
import { CalendarFrame, useCalFilter } from '../frame';
import { startCareAdd } from './y-07-care-add';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];
const ymText = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

// 칸 안 짧은 이름과 고른 날 줄 아이콘(돈 일정 종류)
const MONEY_SHORT: Record<MoneyKind, string> = {
  payday: copy.short.payday,
  review: copy.short.review,
  deadline: copy.short.deadline,
  goal: copy.short.goal,
  maturity: copy.short.maturity,
};
// 돈 일정 3D 아이콘(2026-11-05, Illustrations D). 파일이 없으면 MONEY_ICON
const MONEY_ART: Record<MoneyKind, string> = {
  payday: 'line-custom',
  review: 'line-fixed',
  deadline: 'goal-deadline',
  goal: 'goal-deadline',
  maturity: 'asset-deposit',
};
const MONEY_ICON: Record<MoneyKind, IconName> = {
  payday: 'wallet',
  review: 'calendar-check',
  deadline: 'target',
  goal: 'target',
  maturity: 'piggy-bank',
};
let lastView: { today: string; ym: [number, number]; selected: string } | null = null;

/** 챙길 날 이름의 마지막 낱말(“어머니 생신” → “생신”) */
const careShort = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;

// Y-04 달력(24 Y-01·Y-04 7~10번). 2026-11-04 토스 소비 달력형: 카드 없이 한 달 전체(접기 없앰),
// 칸마다 숫자 + 짧은 이름 한 줄, 월말 확인 기간은 칸 아래 이어진 한 줄 띠(“월말 확인”, 누르면 그 날 줄 → W-05).
// 오늘은 굵은 숫자, 고른 날은 떠 있는 흰 칸. 다른 달을 보고 있으면 ‘오늘’.
// 아래는 굵은 회색 띠 + 고른 날 일정(종류 아이콘 + 굵은 이름 + 회색 보조 줄), 그 아래 ‘이 날에 챙길 날 추가’ → Y-07.
export function Y04Calendar() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const [ty, tm] = ymd(d.today);
  // 2026-11-04 일정을 보고 돌아와도 보던 달과 고른 날 그대로(앱을 쓰는 동안만, 날이 바뀌면 오늘로)
  const kept = lastView?.today === d.today ? lastView : null;
  const [ym, setYmRaw] = useState<[number, number]>(kept?.ym ?? [ty, tm]);
  const [selected, setSelectedRaw] = useState<string>(kept?.selected ?? d.today);
  const setYm = (v: [number, number]) => {
    setYmRaw(v);
    lastView = { today: d.today, ym: v, selected: lastView?.selected ?? selected };
  };
  const setSelected = (v: string) => {
    setSelectedRaw(v);
    lastView = { today: d.today, ym: lastView?.ym ?? ym, selected: v };
  };
  const { masked } = useMask();
  const frame = (children: ReactNode) => (
    <CalendarFrame view="month" filter={filter} onFilter={setFilter}>
      {children}
    </CalendarFrame>
  );
  if (d.loading) return frame(<SkelBody shape="calendar" />);

  const [y, m] = ym;
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
  const bandPos = (date: string, dow: number): CalDay['band'] => {
    const b = bandOn(date);
    if (!b) return undefined;
    // 주가 바뀌면 띠도 그 줄에서 끊어 이어 그림
    const first = date === b.start || dow === 0;
    const last = date === b.end || dow === 6;
    return first && last ? 'single' : first ? 'start' : last ? 'end' : 'mid';
  };
  // 그 달 주만(다음 달만 있는 마지막 주는 뺌)
  const cells = monthGrid(y, m);
  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7)).filter((w) =>
    w.some((c) => !c.muted),
  );
  const grid: CalDay[] = weeks.flat().map((c, i) => {
    const cs = caresOn(c.date);
    // 월말 확인은 띠로 보여 주니 칸 이름에서 뺌
    const ms = moneyOf(c.date).filter((x) => x.kind !== 'review');
    const [, cm, cd] = ymd(c.date);
    const hol = d.holidayOf(c.date);
    const names = [
      ...cs.map((x) => ({ s: careShort(x.care.name), t: 'care' as const })),
      ...ms.map((x) => ({ s: MONEY_SHORT[x.kind], t: 'money' as const })),
    ];
    const head = hol ? { s: hol.name.replace(/\(.*\)$/, ''), t: 'holiday' as const } : names[0];
    const more = names.length - (hol ? 0 : 1);
    return {
      date: c.date,
      day: c.day,
      muted: c.muted,
      short: c.muted || !head ? undefined : more > 0 ? `${head.s} +${more}` : head.s,
      tone: head?.t,
      band: c.muted ? undefined : bandPos(c.date, i % 7),
      holiday: !!hol,
      festive: !!hol && isFestive(hol.name),
      label: copy.dayLabel(cm, cd, moneyOf(c.date).length + cs.length, hol?.name),
    };
  });
  const move = (n: number) => {
    const t = y * 12 + (m - 1) + n;
    const ny = Math.floor(t / 12);
    const nm = (t % 12) + 1;
    setYm([ny, nm]);
    // 오늘이 든 달이면 오늘, 아니면 그 달 1일을 고름
    setSelected(ny === ty && nm === tm ? d.today : `${ymText(ny, nm)}-01`);
  };

  /** 고른 날 일정 줄들(공휴일, 월말 확인, 챙길 날, 돈 일정) */
  const items = (date: string) => {
    const hol = d.holidayOf(date);
    const band = bandOn(date);
    const ms = moneyOf(date).filter((x) => x.kind !== 'review');
    const cs = caresOn(date);
    const rows: ReactNode[] = [];
    if (hol)
      rows.push(
        <ListRow
          key="hol"
          lead={<Lead icon="flag-pennant" />}
          label={hol.name}
          sub={copy.holiday}
          chevron={false}
        />,
      );
    if (band)
      rows.push(
        <ListRow
          key="band"
          lead={<Lead icon="calendar-check" art3d={icon3d('line-fixed')} />}
          label={copy.reviewBand(reviewMonth(band.end))}
          sub={copy.go.review}
          onClick={() => nav('/salary/review')}
          chevron
        />,
      );
    for (const x of cs) {
      const n = dday(d.today, x.date);
      rows.push(
        <Fragment key={x.care.id}>
          <ListRow
            lead={<Lead icon="gift" tone="together" art3d={icon3d('care-gift')} />}
            label={x.care.name}
            sub={
              x.care.budget > 0
                ? `${copy.memoAmount(won(x.care.budget, masked))}, ${copy.dday(n)}`
                : copy.dday(n)
            }
            onClick={() => nav(`/calendar/day/${x.care.id}`)}
            chevron
          />
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
        </Fragment>,
      );
    }
    ms.forEach((x, i) => {
      const l = moneyLine(x);
      rows.push(
        <ListRow
          key={`${x.kind}-${i}`}
          lead={<Lead icon={MONEY_ICON[x.kind]} art3d={icon3d(MONEY_ART[x.kind])} />}
          label={l.label}
          sub={copy.goSub[x.kind]}
          onClick={() => nav(l.to)}
          chevron
        />,
      );
    });
    return rows;
  };
  const [, sm, sd] = ymd(selected);
  const dow = DOW[new Date(`${selected}T00:00:00Z`).getUTCDay()] ?? '';
  const rows = items(selected);

  return frame(
    <>
      <Calendar
        year={y}
        month={m}
        yearLabel={copy.yearLabel(y)}
        monthLabel={copy.monthLabel(m)}
        showYear={y !== ty}
        days={grid}
        today={d.today}
        selected={selected}
        onSelect={setSelected}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        prevLabel={copy.prev}
        nextLabel={copy.next}
        todayLabel={y !== ty || m !== tm ? copy.today : undefined}
        onToday={() => {
          setYm([ty, tm]);
          setSelected(d.today);
        }}
        bandLabel={copy.short.band}
      />
      <Band />
      <section
        className="hg-cal__agenda"
        aria-live="polite"
        aria-label={copy.agendaDay(sm, sd, dow)}
      >
        <h2 className="hg-cal__date">{copy.agendaDay(sm, sd, dow)}</h2>
        <div className="hg-list hg-list--plain">
          {rows.length ? rows : <p className="hg-help">{copy.agendaEmpty}</p>}
        </div>
        {selected >= d.today && (
          <div className="hg-list hg-list--plain hg-cal__add">
            <ListRow
              lead={<Lead icon="plus" action />}
              label={copy.addOnDay}
              chevron={false}
              onClick={() => {
                startCareAdd(selected);
                nav('/calendar/add/a');
              }}
            />
          </div>
        )}
      </section>
    </>,
  );
}
