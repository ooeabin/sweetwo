import {
  formatDateDow,
  formatDateReadout,
  formatMonthDayDow,
  lunarDaySolar,
  lunarMonthCells,
  monthCells,
} from '@sweetwo/core';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Chip } from './Chip';
import { cx } from './cx';
import { Icon } from './Icon';
import { DateWheel } from './question/DateWheel';
import { SegChoice } from './Tabs';

// 달력 시트와 폼 날짜 한 줄(docs/design/components/DateSheet.md, 2026-11-24 사용자 결정).
// 폼 안에 연·월·일 휠을 펼쳐 두지 않고 날짜는 한 줄(DateField) → 누르면 아래에서 달력 시트(DateSheet).
// 시트: 제목(질문) → (양력/음력) → 월 머리 “‹ 2026년 11월 ⌄ ›” → 요일 → 날짜 → 아래 주 버튼 “11월 26일 (목) 선택”.
// ⌄를 누르면 연·월 휠로 바뀌어 먼 연·월로 바로 이동. 키보드: ←→ 하루, ↑↓ 한 주, PageUp/PageDown 한 달, Home/End 그 달 처음·끝, Enter 고름.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export interface DateCal {
  /** 음력(값의 연·월·일이 음력) */
  lunar: boolean;
  /** 음력 윤달 */
  leap: boolean;
}

export interface DateSheetLabels {
  prevMonth: string;
  nextMonth: string;
  /** 월 머리(연·월 휠 열고 닫기) */
  pickMonth: string;
  /** 고른 날이 없을 때 주 버튼 */
  none: string;
  /** 주 버튼(고른 날 “11월 26일 (목)”) */
  confirm: (day: string) => string;
  /** 연·월 휠을 열었을 때 주 버튼 */
  goMonth: (y: number, m: number) => string;
  /** 연·월 휠 이름 */
  wheel: string;
  solar: string;
  lunar: string;
  leap: string;
}

export const dateSheetLabels: DateSheetLabels = {
  prevMonth: '이전 달',
  nextMonth: '다음 달',
  pickMonth: '연·월 고르기',
  none: '날짜를 골라 주세요',
  confirm: (day) => `${day} 선택`,
  goMonth: (y, m) => `${y}년 ${m}월 보기`,
  wheel: '연·월',
  solar: '양력',
  lunar: '음력',
  leap: '윤달',
};

export interface DateSheetProps {
  /** 시트 제목(질문 그대로) */
  title: string;
  /** 'YYYY-MM-DD'(음력이면 음력 연·월·일). 없으면 아직 안 고름 */
  value: string | null;
  /** 오늘 'YYYY-MM-DD'(KST, 부르는 쪽이 core todayKst로) */
  today: string;
  /** 값이 없을 때 처음 보이는 달(기본 오늘) */
  initial?: string;
  /** 고를 수 있는 처음·끝 날(양력). 밖은 흐리게 + 못 누름 */
  min?: string;
  max?: string;
  /** 연·월 휠과 달 이동 범위(기본 min·max의 해, 없으면 오늘 −100 ~ +50년) */
  minYear?: number;
  maxYear?: number;
  /** 양력/음력 고르기가 필요한 곳만. 값이 있으면 시트 맨 위에 고르기 */
  calendar?: DateCal;
  onDone: (v: string, cal?: DateCal) => void;
  onClose: () => void;
  closeLabel?: string;
  /** 값을 지우는 글자 버튼(선택 항목). 없으면 안 보임 */
  clearLabel?: string;
  onClear?: () => void;
  labels?: DateSheetLabels;
}

/** 달 칸: 앞 빈 칸 null + 1~말일. 음력은 그 달이 없으면 null */
function cellsOf(y: number, m: number, cal: DateCal | undefined): (number | null)[] | null {
  if (cal?.lunar) return lunarMonthCells(y, m, cal.leap);
  return monthCells(y, m);
}

/** 날짜 하나의 읽기 이름·요일 표시용 양력 날짜(음력이면 그 날의 양력) */
export function solarOfPicked(v: string, cal?: DateCal): string | null {
  if (!cal?.lunar) return v;
  const [y = 0, m = 1, d = 1] = v.split('-').map(Number);
  return lunarDaySolar(y, m, d, cal.leap);
}

export function DateSheet({
  title,
  value,
  today,
  initial,
  min,
  max,
  minYear,
  maxYear,
  calendar,
  onDone,
  onClose,
  closeLabel = '닫기',
  clearLabel,
  onClear,
  labels = dateSheetLabels,
}: DateSheetProps) {
  const lo = minYear ?? (min ? Number(min.slice(0, 4)) : Number(today.slice(0, 4)) - 100);
  const hi = maxYear ?? (max ? Number(max.slice(0, 4)) : Number(today.slice(0, 4)) + 50);
  const [cal, setCal] = useState<DateCal | undefined>(calendar);
  const [sel, setSel] = useState<string | null>(value);
  const base = value ?? initial ?? today;
  const [view, setView] = useState(() => {
    const y = Math.min(Math.max(Number(base.slice(0, 4)), lo), hi);
    return { y, m: Number(base.slice(5, 7)) };
  });
  const [wheel, setWheel] = useState(false);
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const kbd = useRef(false);
  const cellRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const lunar = !!cal?.lunar;
  const leapHere = lunar ? lunarMonthCells(view.y, view.m, true) !== null : false;
  const effCal: DateCal | undefined = cal && { lunar: cal.lunar, leap: cal.leap && leapHere };
  const cells =
    cellsOf(view.y, view.m, effCal) ??
    cellsOf(view.y, view.m, cal && { ...cal, leap: false }) ??
    [];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const r = cells.slice(i, i + 7);
    while (r.length < 7) r.push(null);
    rows.push(r);
  }
  const days = cells.filter((c) => c !== null).length;

  const selParts = sel ? sel.split('-').map(Number) : null;
  const selHere = selParts && selParts[0] === view.y && selParts[1] === view.m ? selParts[2] : null;
  const todayParts = today.split('-').map(Number);
  const todayHere =
    !lunar && todayParts[0] === view.y && todayParts[1] === view.m ? (todayParts[2] ?? null) : null;
  const off = (d: number) => {
    if (lunar) return false; // 음력은 연도 범위만(달 이동 한계)
    const s = isoOf(view.y, view.m, d);
    return (!!min && s < min) || (!!max && s > max);
  };

  const canPrev = view.y > lo || view.m > 1;
  const canNext = view.y < hi || view.m < 12;
  const go = (n: number) => {
    const t = view.y * 12 + (view.m - 1) + n;
    const y = Math.floor(t / 12);
    const m = (t % 12) + 1;
    if (y < lo || y > hi) return false;
    setView({ y, m });
    setCal((c) => c && { ...c, leap: false });
    return true;
  };

  // 키보드로 옮긴 날로 포커스
  const tab = focusDay ?? selHere ?? todayHere ?? 1;
  useEffect(() => {
    if (!kbd.current || wheel) return;
    kbd.current = false;
    cellRefs.current[tab]?.focus();
  });

  const moveDay = (delta: number) => {
    kbd.current = true;
    if (lunar) {
      setFocusDay(Math.min(Math.max(tab + delta, 1), days));
      return;
    }
    const t = new Date(Date.UTC(view.y, view.m - 1, tab + delta));
    const ny = t.getUTCFullYear();
    const nm = t.getUTCMonth() + 1;
    if (ny < lo || ny > hi) return;
    setView({ y: ny, m: nm });
    setFocusDay(t.getUTCDate());
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowLeft') moveDay(-1);
    else if (k === 'ArrowRight') moveDay(1);
    else if (k === 'ArrowUp') moveDay(-7);
    else if (k === 'ArrowDown') moveDay(7);
    else if (k === 'Home') {
      kbd.current = true;
      setFocusDay(1);
    } else if (k === 'End') {
      kbd.current = true;
      setFocusDay(days);
    } else if (k === 'PageUp' || k === 'PageDown') {
      kbd.current = true;
      if (go(k === 'PageUp' ? -1 : 1)) setFocusDay(Math.min(tab, days));
    } else return;
    e.preventDefault();
  };
  const onDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 48 && Math.abs(e.clientY - s.y) < 40) go(dx < 0 ? 1 : -1);
  };

  const picked = sel ? solarOfPicked(sel, cal) : null;
  const pickedText = sel ? formatMonthDayDow(picked ?? sel) : '';
  // 음력은 월·일만 보이게 “8월 15일 (일)”(요일은 그 날의 양력 요일)
  const confirmText =
    sel && lunar
      ? `${Number(sel.slice(5, 7))}월 ${Number(sel.slice(8, 10))}일${picked ? ` (${DOW[new Date(`${picked}T00:00:00Z`).getUTCDay()]})` : ''}`
      : pickedText;

  const done = () => {
    if (sel) onDone(sel, cal && { lunar: cal.lunar, leap: cal.leap && leapHere });
  };

  return (
    <BottomSheet
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      actions={
        <>
          {wheel ? (
            <Button variant="primary" block onClick={() => setWheel(false)}>
              {labels.goMonth(view.y, view.m)}
            </Button>
          ) : (
            <Button variant="primary" block disabled={!sel} onClick={done}>
              {sel ? labels.confirm(confirmText) : labels.none}
            </Button>
          )}
          {clearLabel && onClear && !wheel && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'center' }}
              onClick={onClear}
            >
              {clearLabel}
            </button>
          )}
        </>
      }
    >
      <div className="hg-calsheet">
        {cal && (
          <SegChoice<'solar' | 'lunar'>
            label={title}
            value={cal.lunar ? 'lunar' : 'solar'}
            onChange={(v) => {
              setCal({ lunar: v === 'lunar', leap: false });
              setFocusDay(null);
            }}
            items={[
              { value: 'solar', label: labels.solar },
              { value: 'lunar', label: labels.lunar },
            ]}
          />
        )}
        <div className="hg-calsheet__head">
          <button
            type="button"
            className="hg-calsheet__nav"
            aria-label={labels.prevMonth}
            disabled={!canPrev}
            onClick={() => go(-1)}
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <button
            type="button"
            className="hg-calsheet__month"
            aria-label={`${view.y}년 ${view.m}월, ${labels.pickMonth}`}
            aria-expanded={wheel}
            onClick={() => setWheel((w) => !w)}
          >
            <span aria-hidden="true">
              {view.y}년 {view.m}월
            </span>
            <Icon name={wheel ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          <button
            type="button"
            className="hg-calsheet__nav"
            aria-label={labels.nextMonth}
            disabled={!canNext}
            onClick={() => go(1)}
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
        {wheel ? (
          <div className="hg-calsheet__body">
            <DateWheel
              label={labels.wheel}
              yearMonth
              value={{ y: view.y, m: view.m, d: 1 }}
              minYear={lo}
              maxYear={hi}
              onChange={(v) => setView({ y: v.y, m: v.m })}
            />
          </div>
        ) : (
          <div className="hg-calsheet__body">
            {lunar && leapHere && (
              <Chip
                small
                selected={!!cal?.leap}
                onClick={() => setCal((c) => c && { ...c, leap: !c.leap })}
              >
                {labels.leap}
              </Chip>
            )}
            <div
              className="hg-calsheet__grid"
              role="grid"
              aria-label={`${view.y}년 ${view.m}월`}
              onKeyDown={onKey}
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={() => (swipe.current = null)}
            >
              <div className="hg-calsheet__row" role="row">
                {DOW.map((d, i) => (
                  <span
                    key={d}
                    role="columnheader"
                    className={cx('hg-calsheet__dow', i === 0 && 'is-sun')}
                  >
                    {d}
                  </span>
                ))}
              </div>
              {rows.map((r, ri) => (
                <div key={ri} className="hg-calsheet__row" role="row">
                  {r.map((d, ci) =>
                    d === null ? (
                      <span key={ci} role="gridcell" aria-hidden="true" />
                    ) : (
                      <button
                        key={ci}
                        ref={(el) => {
                          cellRefs.current[d] = el;
                        }}
                        type="button"
                        role="gridcell"
                        className={cx(
                          'hg-calsheet__day',
                          ci === 0 && 'is-sun',
                          d === todayHere && 'is-today',
                          d === selHere && 'is-on',
                        )}
                        aria-selected={d === selHere}
                        aria-current={d === todayHere ? 'date' : undefined}
                        aria-label={
                          lunar
                            ? `음력 ${view.y}년 ${view.m}월 ${d}일`
                            : formatDateReadout(isoOf(view.y, view.m, d))
                        }
                        disabled={off(d)}
                        tabIndex={d === tab ? 0 : -1}
                        onClick={() => {
                          setSel(isoOf(view.y, view.m, d));
                          setFocusDay(d);
                        }}
                      >
                        <span className="hg-calsheet__num">{d}</span>
                      </button>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * 폼 날짜 한 줄(`DateField`): 회색 판 한 줄 “2026년 11월 26일 (목)” + 보조(‘양력’ 등) + ›. 누르면 달력 시트(DateSheet).
 * 시트에서 “선택”을 누르면 값이 바뀌고 닫힘. 안 정했으면 자리표시.
 */
export function DateField({
  label,
  value,
  onChange,
  today,
  placeholder = '날짜 고르기',
  sub,
  calendar,
  onCalendarChange,
  invalid,
  below,
  ...sheet
}: Omit<DateSheetProps, 'title' | 'onDone' | 'onClose' | 'value' | 'calendar'> & {
  /** 시트 제목이자 화면 읽기 이름(질문 그대로) */
  label: string;
  value: string | null;
  /** 시트에서 골랐을 때(음력이면 cal도) */
  onChange: (v: string, cal?: DateCal) => void;
  /** 양력/음력 고르기가 있는 곳 */
  calendar?: DateCal;
  onCalendarChange?: (cal: DateCal) => void;
  placeholder?: string;
  /** 줄 오른쪽 안 보조 13(‘양력’, ‘음력’) */
  sub?: string;
  invalid?: boolean;
  /** 줄 아래 안내·오류 */
  below?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const picked = value ? solarOfPicked(value, calendar) : null;
  const text = !value
    ? null
    : calendar?.lunar
      ? `${value.slice(0, 4)}년 ${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일${picked ? ` (${DOW[new Date(`${picked}T00:00:00Z`).getUTCDay()]})` : ''}`
      : formatDateDow(value);
  return (
    <div className="hg-dfield">
      <button
        type="button"
        className={cx('hg-dline', invalid && 'is-error')}
        aria-haspopup="dialog"
        aria-label={`${label}, ${text ?? placeholder}${sub ? `, ${sub}` : ''}`}
        onClick={() => setOpen(true)}
      >
        <span className="hg-dline__main">
          <span className={cx('hg-dline__text', !text && 'is-empty')}>{text ?? placeholder}</span>
          {text && sub && <span className="hg-dline__sub">{sub}</span>}
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      {below && <div className="hg-form__below">{below}</div>}
      {open && (
        <DateSheet
          {...sheet}
          title={label}
          today={today}
          value={value}
          calendar={calendar}
          onClose={() => setOpen(false)}
          onDone={(v, cal) => {
            onChange(v, cal);
            if (cal) onCalendarChange?.(cal);
            setOpen(false);
          }}
          onClear={
            sheet.onClear &&
            (() => {
              sheet.onClear?.();
              setOpen(false);
            })
          }
        />
      )}
    </div>
  );
}
