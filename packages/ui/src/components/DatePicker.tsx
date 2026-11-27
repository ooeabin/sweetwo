import {
  addDays,
  formatDateDot,
  formatDateFull,
  formatYm,
  parseDateDot,
  parseTimeText,
  todayKst,
} from '@sweetwo/core';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface DatePickerLabels {
  /** 달력 여는 버튼 */
  open: string;
  prev: string;
  next: string;
  /** 시각 칸(time일 때) */
  time: string;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const ymOf = (d: string) => d.slice(0, 7);
const shiftMonth = (ym: string, n: number) => {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
};
const lastDay = (ym: string) => {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const split = (v: string) => ({ d: v.slice(0, 10), t: v.length > 10 ? v.slice(11, 16) : '' });

// 날짜 칸(docs/design/components/DatePicker.md, 2026-11-17 어드민). 브라우저 기본 date·datetime-local 대신.
// 칸에 “2026.11.25”를 직접 치거나(“20261125”, “2026-11-25”도), 오른쪽 달력 버튼으로 달력을 열어 고름. 날짜는 KST.
// 값은 'YYYY-MM-DD'(time이면 'YYYY-MM-DDTHH:MM'), 덜 찼거나 없는 날짜면 ''.
// 달력 키보드: ←/→ 하루, ↑/↓ 한 주, PageUp/PageDown 한 달, Home/End 그 달 처음·끝, Enter 고름, Esc 닫음.
export function DatePicker({
  label,
  hideLabel,
  value,
  onChange,
  time,
  disabled,
  help,
  labels,
  width,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (v: string) => void;
  /** 시각 칸도(HH:MM) */
  time?: boolean;
  disabled?: boolean;
  help?: string;
  labels: DatePickerLabels;
  /** 칸 너비(px). 없으면 부모 폭 */
  width?: number;
}) {
  const id = useId();
  const labelId = `${id}-l`;
  const helpId = `${id}-h`;
  const [dText, setDText] = useState(() => (split(value).d ? formatDateDot(split(value).d) : ''));
  const [tText, setTText] = useState(() => split(value).t);
  const [bad, setBad] = useState(false);
  const sent = useRef(value);
  // 밖에서 값이 바뀌면(초기화 등) 칸 글자도 맞춤
  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    const s = split(value);
    setDText(s.d ? formatDateDot(s.d) : '');
    setTText(s.t);
    setBad(false);
  }, [value]);
  const emit = (dt: string, tt: string) => {
    const d = parseDateDot(dt);
    const t = time ? parseTimeText(tt) : '';
    const v = d && t !== null ? (time ? `${d}T${t}` : d) : '';
    sent.current = v;
    if (v !== value) onChange(v);
  };

  const [open, setOpen] = useState(false);
  const today = todayKst();
  const picked = parseDateDot(dText);
  const [focus, setFocus] = useState(picked ?? today);
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  // 키보드로 옮기면 그 날짜에 포커스
  useEffect(() => {
    if (!open || !moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, focus]);

  const show = () => {
    setFocus(picked ?? today);
    moved.current = true;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const choose = (d: string) => {
    const dt = formatDateDot(d);
    setDText(dt);
    setBad(false);
    emit(dt, tText);
    setOpen(false);
    if (time && !parseTimeText(tText)) timeRef.current?.focus();
    else btn.current?.focus();
  };
  const onGridKey = (e: KeyboardEvent) => {
    const ym = ymOf(focus);
    const day = Number(focus.slice(8, 10));
    const to = (d: string) => {
      e.preventDefault();
      moved.current = true;
      setFocus(d);
    };
    const inMonth = (n: number) => {
      const m = shiftMonth(ym, n);
      return `${m}-${String(Math.min(day, lastDay(m))).padStart(2, '0')}`;
    };
    switch (e.key) {
      case 'ArrowLeft':
        return to(addDays(focus, -1));
      case 'ArrowRight':
        return to(addDays(focus, 1));
      case 'ArrowUp':
        return to(addDays(focus, -7));
      case 'ArrowDown':
        return to(addDays(focus, 7));
      case 'PageUp':
        return to(inMonth(-1));
      case 'PageDown':
        return to(inMonth(1));
      case 'Home':
        return to(`${ym}-01`);
      case 'End':
        return to(`${ym}-${lastDay(ym)}`);
      case 'Escape':
        e.preventDefault();
        return close();
    }
  };

  // 그 달 칸(일요일 시작, 다른 달 칸은 비움)
  const ym = ymOf(focus);
  const first = new Date(`${ym}-01T00:00:00Z`).getUTCDay();
  const n = lastDay(ym);
  const cells: (string | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <div className="hg-field" style={width ? { width, flex: 'none' } : undefined}>
      <span id={labelId} className={hideLabel ? 'hg-sr' : 'hg-field__label'}>
        {label}
      </span>
      <div ref={wrap} className="hg-datepick">
        <div
          className={cx('hg-input hg-datepick__box', bad && 'is-error', disabled && 'is-disabled')}
        >
          <input
            className="hg-datepick__text"
            aria-labelledby={labelId}
            aria-invalid={bad || undefined}
            aria-describedby={help ? helpId : undefined}
            inputMode="numeric"
            placeholder="0000.00.00"
            maxLength={10}
            value={dText}
            disabled={disabled}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d.\-/ ]/g, '');
              setDText(t);
              if (bad && parseDateDot(t)) setBad(false);
              emit(t, tText);
            }}
            onBlur={() => {
              const d = parseDateDot(dText);
              if (d) setDText(formatDateDot(d));
              setBad(dText.trim() !== '' && !d);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                show();
              }
            }}
          />
          {time && (
            <input
              ref={timeRef}
              className="hg-datepick__time"
              aria-label={`${label} ${labels.time}`}
              inputMode="numeric"
              placeholder="00:00"
              maxLength={5}
              value={tText}
              disabled={disabled}
              onChange={(e) => {
                const t = e.target.value.replace(/[^\d:]/g, '');
                setTText(t);
                emit(dText, t);
              }}
              onBlur={() => {
                const t = parseTimeText(tText);
                if (t) setTText(t);
              }}
            />
          )}
          <button
            ref={btn}
            type="button"
            className="hg-datepick__btn"
            aria-label={`${label} ${labels.open}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={disabled}
            onClick={() => (open ? setOpen(false) : show())}
          >
            <Icon name="calendar" size={16} />
          </button>
        </div>
        {open && (
          <div className="hg-datepick__pop" role="dialog" aria-label={label} onKeyDown={onGridKey}>
            <div className="hg-datepick__head">
              <button
                type="button"
                className="hg-chevnav"
                aria-label={labels.prev}
                onClick={() => {
                  moved.current = false;
                  setFocus(`${shiftMonth(ym, -1)}-01`);
                }}
              >
                <Icon name="chevron-left" size={24} />
              </button>
              <b aria-live="polite">{formatYm(ym)}</b>
              <button
                type="button"
                className="hg-chevnav"
                aria-label={labels.next}
                onClick={() => {
                  moved.current = false;
                  setFocus(`${shiftMonth(ym, 1)}-01`);
                }}
              >
                <Icon name="chevron-right" size={24} />
              </button>
            </div>
            <table ref={grid} className="hg-datepick__grid">
              <thead>
                <tr>
                  {DOW.map((d) => (
                    <th key={d} scope="col">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => (
                  <tr key={i}>
                    {w.map((d, j) => (
                      <td key={j}>
                        {d && (
                          <button
                            type="button"
                            data-day={d}
                            className={cx(
                              'hg-datepick__day',
                              d === picked && 'is-selected',
                              d === today && 'is-today',
                            )}
                            tabIndex={d === focus ? 0 : -1}
                            aria-label={formatDateFull(d)}
                            aria-pressed={d === picked}
                            aria-current={d === today ? 'date' : undefined}
                            onClick={() => choose(d)}
                          >
                            {Number(d.slice(8, 10))}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {help && (
        <span id={helpId} className="hg-help">
          {help}
        </span>
      )}
    </div>
  );
}

// 기간(시작 ~ 끝) 칸 둘(2026-11-17 어드민 감사 로그 필터). 끝이 시작보다 앞이면 끝 칸 아래 오류
export function DateRange({
  label,
  from,
  to,
  onChange,
  fromLabel,
  toLabel,
  error,
  labels,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  fromLabel: string;
  toLabel: string;
  /** 끝이 시작보다 앞일 때 보일 말 */
  error: string;
  labels: DatePickerLabels;
}) {
  const wrong = !!from && !!to && to < from;
  return (
    <div className="hg-daterange" role="group" aria-label={label}>
      <DatePicker
        label={fromLabel}
        hideLabel
        width={156}
        value={from}
        labels={labels}
        onChange={(v) => onChange(v, to)}
      />
      <span className="hg-daterange__sep" aria-hidden="true">
        ~
      </span>
      <DatePicker
        label={toLabel}
        hideLabel
        width={156}
        value={to}
        labels={labels}
        onChange={(v) => onChange(from, v)}
      />
      {wrong && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
