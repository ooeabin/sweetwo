import {
  careArtKey,
  dayArt,
  dayTone,
  dday,
  isFestive,
  moneyArtKey,
  monthGrid,
  monthSummary,
  solarToLunar,
} from '@sweetwo/core';
import {
  Band,
  Button,
  type CalDay,
  Calendar,
  Illustration,
  Lead,
  ListRow,
  MonthSheet,
  hasIllustration,
} from '@sweetwo/ui';
import { Fragment, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOW, copy } from '../copy';
import { moneyLine, reviewMonth, useCalendarData } from '../data';
import { track } from '../../../shared/analytics';
import { money as won, useMask } from '../../../shared/mask';
import { SkelBody } from '../../frame';
import { CalendarFrame, CalendarLoadError, useCalFilter } from '../frame';
import { RecordBand, UpcomingSection } from '../upcoming';
import { startCareAdd } from './y-07-care-add';

const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];
const ymText = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

// 보던 달, 고른 날, 한 주로 접은 상태(앱을 쓰는 동안만 기억, 날이 바뀌면 오늘로·펼침으로)
let lastView: { today: string; ym: [number, number]; selected: string; folded: boolean } | null =
  null;

/** 공휴일 이름과 경조사 이름이 같은지(“설날” = “설날”, 공휴일 이름 뒤 괄호는 뺌) */
const sameName = (care: string, holiday: string) =>
  care.trim() === holiday.replace(/\(.*\)$/, '').trim();

/** 그림 키 → 그림(파일이 아직 없으면 null: 그림 칸·줄 앞 칸을 그리지 않음, Illustrations 숨김 규칙) */
const artOf = (key: string | null) =>
  key && hasIllustration(key) ? <Illustration name={key} className="hg-cal__img" /> : null;
/** 줄 앞 칸(Lead): 그림이 있을 때만 */
const leadOfKey = (key: string | null) => {
  const art = artOf(key);
  return art ? <Lead art={art} /> : undefined;
};

// Y-04 달력(24 Y-04, 2026-11-17부터 캘린더 첫 화면. 예전 Y-01 일정 목록 본문은 달력 아래 ‘다가오는 일정’(upcoming.tsx)으로).
// 2026-11-24 K안(한국 금융 앱 달력형): 머리 “12월 ⌄”(연·월 휠) + 요약 한 줄 “경조사 3개(85만 원 예상)”, 모든 칸 높이 같음 + 숫자 아래 20px 그림 칸(그림 없으면 안 그림),
// 일정 있는 날 굵은 숫자, 고른 날 회색 둥근 판, 손잡이로 한 주로 접기. 칸 안 짧은 이름 글자와 확인 목록 안내 띠는 없앰(안내는 고른 날 줄·다가오는 일정 줄로만).
// 아래는 8px 띠 + 고른 날 머리(“12월 14일 월요일” + 음력) + 일정 줄, 그 아래 ‘이 날에 경조사 추가’ → Y-07.
export function Y04Calendar() {
  const nav = useNavigate();
  const d = useCalendarData();
  const [filter, setFilter] = useCalFilter();
  const [ty, tm] = ymd(d.today);
  // 2026-11-04 일정을 보고 돌아와도 보던 달과 고른 날 그대로(앱을 쓰는 동안만, 날이 바뀌면 오늘로). 한 주로 접은 상태도 같은 규칙(2026-11-24)
  const kept = lastView?.today === d.today ? lastView : null;
  const [ym, setYmRaw] = useState<[number, number]>(kept?.ym ?? [ty, tm]);
  const [selected, setSelectedRaw] = useState<string>(kept?.selected ?? d.today);
  const [folded, setFoldedRaw] = useState<boolean>(kept?.folded ?? false);
  const [sheet, setSheet] = useState(false);
  const keep = (p: Partial<NonNullable<typeof lastView>>) => {
    lastView = {
      today: d.today,
      ym: lastView?.today === d.today ? lastView.ym : ym,
      selected: lastView?.today === d.today ? lastView.selected : selected,
      folded: lastView?.today === d.today ? lastView.folded : folded,
      ...p,
    };
  };
  const setYm = (v: [number, number]) => {
    setYmRaw(v);
    keep({ ym: v });
  };
  const setSelected = (v: string) => {
    setSelectedRaw(v);
    keep({ selected: v });
  };
  const setFolded = (v: boolean, via: 'tap' | 'drag') => {
    setFoldedRaw(v);
    keep({ folded: v });
    track('calendar_folded', { state: v ? 'folded' : 'expanded', via });
  };
  const { masked } = useMask();
  const frame = (children: ReactNode) => (
    <CalendarFrame filter={filter} onFilter={setFilter}>
      {children}
    </CalendarFrame>
  );
  if (d.failed) return frame(<CalendarLoadError onRetry={d.retry} />);
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
  // 그 달 주만(다음 달만 있는 마지막 주는 뺌)
  const cells = monthGrid(y, m);
  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7)).filter((w) =>
    w.some((c) => !c.muted),
  );
  const grid: CalDay[] = weeks.flat().map((c) => {
    const cs = caresOn(c.date);
    // 확인 목록 안내는 일정 칸 표시에서 뺌(고른 날 줄·다가오는 일정 줄로만, 2026-11-24 K안)
    const ms = moneyOf(c.date).filter((x) => x.kind !== 'review');
    const [, cm, cd] = ymd(c.date);
    const hol = d.holidayOf(c.date);
    // 첫 일정 그림 + ‘+n’(경조사가 먼저, 금융 일정 다음). 파일이 없으면 그림 칸을 그리지 않음
    const keys = [...cs.map((x) => careArtKey(x.care)), ...ms.map((x) => moneyArtKey(x.kind))].map(
      (k) => (k && hasIllustration(k) ? k : null),
    );
    const art = c.muted ? null : dayArt(keys);
    return {
      date: c.date,
      day: c.day,
      muted: c.muted,
      tone: dayTone(c.date, d.today, cs.length + ms.length),
      art: art ? artOf(art.first) : undefined,
      more: art?.more,
      holiday: !!hol,
      festive: !!hol && isFestive(hol.name),
      label: copy.dayLabel(cm, cd, moneyOf(c.date).length + cs.length, hol?.name),
    };
  });
  const goMonth = (ny: number, nm: number) => {
    setYm([ny, nm]);
    // 오늘이 든 달이면 오늘, 아니면 그 달 1일을 고름
    setSelected(ny === ty && nm === tm ? d.today : `${ymText(ny, nm)}-01`);
  };
  const move = (n: number) => {
    const t = y * 12 + (m - 1) + n;
    goMonth(Math.floor(t / 12), (t % 12) + 1);
  };

  // 달 머리 아래 요약 한 줄(“경조사 3개(85만 원 예상)”, ‘금융 일정’ 필터는 “금융 일정 4개”, 0개면 줄 없음)
  const sum = monthSummary({
    filter,
    cares: filter === 'money' ? [] : d.caresOf(y, m).map((x) => x.care),
    moneyCount:
      filter === 'care' ? 0 : d.monthOf(y, m).dates.filter((x) => x.kind !== 'review').length,
  });

  /** 고른 날 일정 줄들(공휴일, 월급날 확인 목록, 경조사, 금융 일정) */
  const items = (date: string) => {
    const hol = d.holidayOf(date);
    const band = bandOn(date);
    const ms = moneyOf(date).filter((x) => x.kind !== 'review');
    const cs = caresOn(date);
    const rows: ReactNode[] = [];
    // 같은 날 같은 이름 경조사(설날 등)가 있으면 공휴일 줄은 숨김(경조사 줄이 같은 말을 함, 2026-11-24 구역 4)
    if (hol && !cs.some((x) => sameName(x.care.name, hol.name)))
      rows.push(<ListRow key="hol" label={hol.name} sub={copy.holiday} chevron={false} />);
    if (band)
      rows.push(
        <ListRow
          key="band"
          label={copy.reviewBand(reviewMonth(band.end))}
          sub={copy.go.review}
          onClick={() => nav('/salary')}
          chevron
        />,
      );
    for (const x of cs) {
      const n = dday(d.today, x.date);
      rows.push(
        <Fragment key={x.care.id}>
          <ListRow
            lead={leadOfKey(careArtKey(x.care))}
            label={x.care.name}
            sub={
              x.care.budget > 0
                ? `${copy.memoAmount(won(x.care.budget, masked))}, ${copy.dday(n)}`
                : copy.dday(n)
            }
            onClick={() => nav(`/calendar/day/${x.care.id}`)}
            chevron
          />
          {/* 그날이 된 경조사는 달력에서도 ‘다녀왔어요’ → Y-08(24 Y-05 4번) */}
          {x.date <= d.today && !(x.care.status === 'done' && x.care.status_on === x.date) && (
            <Button
              variant="secondary"
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
          lead={leadOfKey(moneyArtKey(x.kind))}
          label={l.label}
          sub={l.why ?? copy.goSub[x.kind]}
          onClick={() => nav(l.to)}
          chevron
        />,
      );
    });
    return rows;
  };
  const [, sm, sd] = ymd(selected);
  const dow = DOW[new Date(`${selected}T00:00:00Z`).getUTCDay()] ?? '';
  const lunar = solarToLunar(selected);
  const rows = items(selected);

  return frame(
    <>
      <RecordBand d={d} filter={filter} />
      <Calendar
        year={y}
        month={m}
        monthText={y !== ty ? copy.monthTextYear(y, m) : copy.monthLabel(m)}
        monthMenuLabel={copy.monthMenu(y, m)}
        onMonthMenu={() => setSheet(true)}
        summary={
          sum && (
            <>
              {sum.kind === 'care' ? copy.summaryCare : copy.summaryMoney}{' '}
              <b>{copy.summaryCount(sum.count)}</b>
              {sum.budget !== null && copy.summaryBudget(won(sum.budget, masked))}
            </>
          )
        }
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
        folded={folded}
        onFoldedChange={setFolded}
        foldLabel={copy.fold}
        unfoldLabel={copy.unfold}
      />
      {sheet && (
        <MonthSheet
          title={copy.monthSheetTitle}
          year={y}
          month={m}
          minYear={ty - 10}
          maxYear={ty + 10}
          closeLabel={copy.back}
          onClose={() => setSheet(false)}
          onDone={(ny, nm) => {
            setSheet(false);
            goMonth(ny, nm);
          }}
        />
      )}
      {/* ‘금융 일정’ 필터에 이 달 금융 일정이 없음(13 공통 상태 18번, 2026-11-12 QA 9구간 D3 = A) */}
      {filter === 'money' && !d.monthOf(y, m).dates.length && (
        <p className="hg-help hg-empty__line" role="status" style={{ margin: 0 }}>
          {copy.noMoneyThisMonth}
        </p>
      )}
      <Band />
      <section
        className="hg-cal__agenda"
        aria-live="polite"
        aria-label={copy.agendaDay(sm, sd, dow)}
      >
        <h2 className="hg-cal__date">
          <b>{copy.agendaDay(sm, sd, dow)}</b>
          {lunar && <span>{copy.lunarDay(lunar.month, lunar.day, lunar.leap)}</span>}
        </h2>
        <div className="hg-list hg-list--plain">
          {rows.length ? rows : <p className="hg-help hg-empty__line">{copy.agendaEmpty}</p>}
        </div>
        {selected >= d.today && (
          <div className="hg-list hg-list--plain hg-cal__add">
            <ListRow
              lead={<Lead icon="plus" uiIcon />}
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
      <Band />
      <UpcomingSection d={d} filter={filter} />
    </>,
  );
}
