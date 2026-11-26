import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from './BottomSheet';
import { cx } from './cx';
import { Icon } from './Icon';

// 칸 고르기 시트(docs/design/components/PickSheet.md, 2026-11-26 사용자 결정 “남은 휠을 시안으로 통일”).
// 휠을 폼에 펼쳐 두지 않고 한 줄 필드(`hg-dline`, DateField와 같은 모양) → 누르면 아래에서 시트.
// 시트 안은 칸(44px 이상) 격자: 일(1~31 + 말일), 연·월(연도 ‹ › + 12개월), 연도만(스크롤), 시(0~23).
// 고른 칸은 `accent-app` 채움 + `on-accent-app-text` 700(달력 시트 DateSheet와 같음). 주 버튼을 눌러야 값이 바뀜.
// 키보드: ←→ 한 칸, ↑↓ 한 줄, Home/End 처음·끝(라디오 줄: 옮기면 바로 고름), Enter·Space 고름.

export type PayDay = number | 'last';

const pad = (n: number) => String(n).padStart(2, '0');

export interface PickLabels {
  prevYear: string;
  nextYear: string;
  /** 연·월 격자 이름 */
  yearMonth: string;
  /** 연도 격자 이름 */
  year: string;
  /** 일 격자 이름 */
  day: string;
  /** 시 격자 이름 */
  hour: string;
  /** 말일 칸 글자 */
  last: string;
  /** 아직 안 골랐을 때 주 버튼 */
  none: string;
  confirmYearMonth: (y: number, m: number) => string;
  confirmYear: (y: number) => string;
  /** 일: “매달 25일로 하기” */
  confirmDay: (d: PayDay) => string;
  /** 일 필드 한 줄: “매달 25일” */
  dayLine: (d: PayDay) => string;
  confirmHour: (text: string) => string;
  /** 시트 닫기 */
  close: string;
  /** 연·월 필드 한 줄 */
  yearMonthLine: (y: number, m: number) => string;
  yearLine: (y: number) => string;
  placeholderYearMonth: string;
  placeholderYear: string;
}

export const pickLabels: PickLabels = {
  prevYear: '이전 해',
  nextYear: '다음 해',
  yearMonth: '연·월',
  year: '연도',
  day: '일',
  hour: '시',
  last: '말일',
  none: '골라 주세요',
  confirmYearMonth: (y, m) => `${y}년 ${m}월 선택`,
  confirmYear: (y) => `${y}년 선택`,
  confirmDay: (d) => (d === 'last' ? '매달 말일로 하기' : `매달 ${d}일로 하기`),
  dayLine: (d) => (d === 'last' ? '매달 말일' : `매달 ${d}일`),
  confirmHour: (t) => `${t} 선택`,
  close: '닫기',
  yearMonthLine: (y, m) => `${y}년 ${m}월`,
  yearLine: (y) => `${y}년`,
  placeholderYearMonth: '연·월 고르기',
  placeholderYear: '연도 고르기',
};

// ── 칸 격자 ──────────────────────────────────────────────

interface PickItem<V> {
  value: V;
  /** 칸 글자 */
  label: ReactNode;
  /** 화면 읽기 이름(없으면 label) */
  name?: string;
  /** 차지하는 칸 수(말일) */
  span?: number;
}

function PickGrid<V extends string | number>({
  label,
  items,
  value,
  onChange,
  cols,
  scroll,
  className,
}: {
  label: string;
  items: PickItem<V>[];
  value: V | null;
  onChange: (v: V) => void;
  cols: number;
  /** 길면 스크롤(연도): 열릴 때 고른 칸(없으면 initial)을 가운데로 */
  scroll?: { initial?: V };
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const kbd = useRef(false);
  const idx = Math.max(
    items.findIndex((i) => i.value === value),
    -1,
  );
  const tab =
    idx >= 0
      ? idx
      : Math.max(
          items.findIndex((i) => i.value === scroll?.initial),
          0,
        );

  useLayoutEffect(() => {
    if (!scroll) return;
    const el = box.current;
    const cell = refs.current[tab];
    if (!el || !cell) return;
    // 시트가 올라오는 중이어도 같이 움직이니 두 상자의 화면 좌표 차로 계산(offsetTop은 기준 부모에 따라 어긋남).
    // scrollTop을 직접 정해 바로 옮김(‘동작 줄이기’와 상관없이 애니메이션 없음)
    const c = cell.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    el.scrollTop += c.top - b.top - el.clientHeight / 2 + c.height / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!kbd.current) return;
    kbd.current = false;
    refs.current[idx]?.focus();
  });

  const move = (to: number) => {
    const n = Math.min(Math.max(to, 0), items.length - 1);
    const it = items[n];
    if (!it) return;
    kbd.current = true;
    onChange(it.value);
  };
  const onKey = (e: KeyboardEvent) => {
    const at = idx >= 0 ? idx : tab;
    const k = e.key;
    if (k === 'ArrowRight') move(at + 1);
    else if (k === 'ArrowLeft') move(at - 1);
    else if (k === 'ArrowDown') move(at + cols);
    else if (k === 'ArrowUp') move(at - cols);
    else if (k === 'Home') move(0);
    else if (k === 'End') move(items.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={box}
      className={cx('hg-picksheet__grid', scroll && 'is-scroll', className)}
      role="radiogroup"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      onKeyDown={onKey}
    >
      {items.map((it, i) => (
        <button
          key={String(it.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === idx}
          aria-label={it.name}
          tabIndex={i === tab ? 0 : -1}
          className={cx('hg-picksheet__cell', i === idx && 'is-on')}
          style={it.span ? { gridColumn: `span ${it.span}` } : undefined}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── 시트 틀 ──────────────────────────────────────────────

/** 시트 틀: 제목 + 칸 + 아래 주 버튼. 다른 시트(W-01d) 위에서도 열리게 body로 올림. Esc는 이 시트만 닫음 */
function PickShell({
  title,
  closeLabel,
  onClose,
  actions,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation(); // 아래 시트(W-01d)까지 같이 닫히지 않게
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <BottomSheet title={title} closeLabel={closeLabel} onClose={onClose} actions={actions}>
      <div className="hg-picksheet">{children}</div>
    </BottomSheet>,
    document.body,
  );
}

/** 폼 한 줄(`hg-dline`): 값 또는 자리표시 + 오른쪽 ›. 누르면 시트 */
function PickLine({
  label,
  text,
  placeholder,
  invalid,
  onOpen,
  below,
  sub,
}: {
  label: string;
  text: string | null;
  placeholder: string;
  invalid?: boolean;
  onOpen: () => void;
  below?: ReactNode;
  sub?: string;
}) {
  return (
    <div className="hg-dfield">
      <button
        type="button"
        className={cx('hg-dline', invalid && 'is-error')}
        aria-haspopup="dialog"
        aria-label={`${label}, ${text ?? placeholder}`}
        onClick={onOpen}
      >
        <span className="hg-dline__main">
          <span className={cx('hg-dline__text', !text && 'is-empty')}>{text ?? placeholder}</span>
          {text && sub && <span className="hg-dline__sub">{sub}</span>}
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      {below && <div className="hg-form__below">{below}</div>}
    </div>
  );
}

// ── 연·월 ────────────────────────────────────────────────

/**
 * 연·월 칸(시트 안, 달력 시트의 월 머리 ⌄, 달력 머리 “12월 ⌄”): 연도 ‹ › + 12개월 칸.
 * 연도를 넘겨도 고른 달은 그대로, 달 칸을 누르면 바로 알려 줌
 */
export function YearMonthPanel({
  y,
  m,
  minYear,
  maxYear,
  onChange,
  labels = pickLabels,
}: {
  y: number;
  m: number;
  minYear: number;
  maxYear: number;
  onChange: (y: number, m: number) => void;
  labels?: Pick<PickLabels, 'prevYear' | 'nextYear' | 'yearMonth' | 'yearLine'>;
}) {
  return (
    <div className="hg-picksheet__ym">
      <div className="hg-picksheet__yearhead">
        <button
          type="button"
          className="hg-picksheet__nav"
          aria-label={labels.prevYear}
          disabled={y <= minYear}
          onClick={() => onChange(y - 1, m)}
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <span className="hg-picksheet__year" aria-live="polite">
          {labels.yearLine(y)}
        </span>
        <button
          type="button"
          className="hg-picksheet__nav"
          aria-label={labels.nextYear}
          disabled={y >= maxYear}
          onClick={() => onChange(y + 1, m)}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
      <PickGrid<number>
        label={labels.yearMonth}
        cols={4}
        value={m}
        items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }))}
        onChange={(mm) => onChange(y, mm)}
      />
    </div>
  );
}

function startYm(): { y: number; m: number } {
  const now = new Date();
  const m = now.getMonth() + 2; // 다음 달(1~13)
  return m > 12 ? { y: now.getFullYear() + 1, m: 1 } : { y: now.getFullYear(), m };
}

/**
 * 연·월 한 줄 + 시트(예정 연·월, 여행 가는 달, 기한, 적용 시작 달). 값 'YYYY-MM'.
 * 값이 없으면 다음 달을 바로 답으로 알려 줌(휠 때와 같음). 범위 밖은 부르는 쪽이 error로 알림
 */
export function YearMonthField({
  label,
  value,
  onChange,
  error,
  minYear,
  maxYear,
  labels = pickLabels,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  error?: string;
  minYear?: number;
  maxYear?: number;
  labels?: PickLabels;
}) {
  const [open, setOpen] = useState(false);
  const y0 = new Date().getFullYear();
  const lo = minYear ?? y0 - 50;
  const hi = maxYear ?? y0 + 40;
  useEffect(() => {
    if (!value) {
      const s = startYm();
      onChange(`${s.y}-${pad(s.m)}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = value ? { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) } : null;
  return (
    <div className="hg-field">
      <PickLine
        label={label}
        text={cur ? labels.yearMonthLine(cur.y, cur.m) : null}
        placeholder={labels.placeholderYearMonth}
        invalid={!!error}
        onOpen={() => setOpen(true)}
      />
      {error && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
      {open && (
        <YearMonthSheet
          title={label}
          y={cur?.y ?? startYm().y}
          m={cur?.m ?? startYm().m}
          minYear={lo}
          maxYear={hi}
          labels={labels}
          onClose={() => setOpen(false)}
          onDone={(y, m) => {
            onChange(`${y}-${pad(m)}`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** 연·월 시트(YearMonthField가 엶). 주 버튼 “2026년 12월 선택” */
export function YearMonthSheet({
  title,
  y,
  m,
  minYear,
  maxYear,
  onDone,
  onClose,
  labels = pickLabels,
}: {
  title: string;
  y: number;
  m: number;
  minYear: number;
  maxYear: number;
  onDone: (y: number, m: number) => void;
  onClose: () => void;
  labels?: PickLabels;
}) {
  const [v, setV] = useState({ y: Math.min(Math.max(y, minYear), maxYear), m });
  return (
    <PickShell
      title={title}
      closeLabel={labels.close}
      onClose={onClose}
      actions={
        <button
          type="button"
          className="hg-btn hg-btn--primary hg-btn--block"
          onClick={() => onDone(v.y, v.m)}
        >
          {labels.confirmYearMonth(v.y, v.m)}
        </button>
      }
    >
      <YearMonthPanel
        y={v.y}
        m={v.m}
        minYear={minYear}
        maxYear={maxYear}
        labels={labels}
        onChange={(yy, mm) => setV({ y: yy, m: mm })}
      />
    </PickShell>
  );
}

// ── 일(1~31 + 말일) ──────────────────────────────────────

/**
 * 일 한 줄 + 시트(W-01 나가는 날). 값 1~31 또는 'last'(말일). 한 줄 “매달 25일”, 시트는 1~31 + 말일 칸,
 * 주 버튼 “매달 25일로 하기”. 월급날 고르기는 PaydayPicker(칩 + 직접 입력하기)가 따로 있음
 */
export function DayField({
  label,
  value,
  onChange,
  labels = pickLabels,
  lastLabel,
  below,
}: {
  label: string;
  value: PayDay;
  onChange: (v: PayDay) => void;
  labels?: PickLabels;
  /** 말일 칸 글자(기본 “말일”) */
  lastLabel?: string;
  below?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickLine
        label={label}
        text={labels.dayLine(value)}
        placeholder=""
        onOpen={() => setOpen(true)}
        below={below}
      />
      {open && (
        <DaySheet
          title={label}
          value={value}
          labels={labels}
          lastLabel={lastLabel}
          onClose={() => setOpen(false)}
          onDone={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function DaySheet({
  title,
  value,
  onDone,
  onClose,
  labels = pickLabels,
  lastLabel,
}: {
  title: string;
  value: PayDay;
  onDone: (v: PayDay) => void;
  onClose: () => void;
  labels?: PickLabels;
  lastLabel?: string;
}) {
  const [v, setV] = useState<PayDay>(value);
  const items: PickItem<number>[] = [
    ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    { value: 32, label: lastLabel ?? labels.last, name: lastLabel ?? labels.last, span: 3 },
  ];
  return (
    <PickShell
      title={title}
      closeLabel={labels.close}
      onClose={onClose}
      actions={
        <button
          type="button"
          className="hg-btn hg-btn--primary hg-btn--block"
          onClick={() => onDone(v)}
        >
          {labels.confirmDay(v)}
        </button>
      }
    >
      <PickGrid<number>
        label={labels.day}
        cols={7}
        value={v === 'last' ? 32 : v}
        items={items}
        onChange={(n) => setV(n === 32 ? 'last' : n)}
      />
    </PickShell>
  );
}

// ── 연도만 ───────────────────────────────────────────────

/**
 * 연도 한 줄 + 시트(출생연도). 값이 없으면 자리표시, 시트는 initial(없으면 maxYear − 12) 근처로 스크롤해서 열림.
 * 고른 뒤 주 버튼 “1993년 선택”
 */
export function YearField({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  initial,
  labels = pickLabels,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (y: number) => void;
  minYear: number;
  maxYear: number;
  initial?: number;
  labels?: PickLabels;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hg-field">
      <PickLine
        label={label}
        text={value === null ? null : labels.yearLine(value)}
        placeholder={labels.placeholderYear}
        invalid={!!error}
        onOpen={() => setOpen(true)}
      />
      {error && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
      {open && (
        <YearSheet
          title={label}
          value={value}
          minYear={minYear}
          maxYear={maxYear}
          initial={initial ?? maxYear - 12}
          labels={labels}
          onClose={() => setOpen(false)}
          onDone={(y) => {
            onChange(y);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function YearSheet({
  title,
  value,
  minYear,
  maxYear,
  initial,
  onDone,
  onClose,
  labels = pickLabels,
}: {
  title: string;
  value: number | null;
  minYear: number;
  maxYear: number;
  initial: number;
  onDone: (y: number) => void;
  onClose: () => void;
  labels?: PickLabels;
}) {
  const [v, setV] = useState<number | null>(value);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  return (
    <PickShell
      title={title}
      closeLabel={labels.close}
      onClose={onClose}
      actions={
        <button
          type="button"
          className="hg-btn hg-btn--primary hg-btn--block"
          disabled={v === null}
          onClick={() => v !== null && onDone(v)}
        >
          {v === null ? labels.none : labels.confirmYear(v)}
        </button>
      }
    >
      <PickGrid<number>
        label={labels.year}
        cols={4}
        value={v}
        scroll={{ initial: Math.min(Math.max(initial, minYear), maxYear) }}
        items={years.map((y) => ({ value: y, label: `${y}년`, name: `${y}년` }))}
        onChange={setV}
      />
    </PickShell>
  );
}

// ── 시(0~23) ─────────────────────────────────────────────

/** 시 한 줄 + 시트(방해 금지 시작·끝). 칸 글자는 format(“오후 10시”) */
export function HourField({
  label,
  value,
  onChange,
  format,
  labels = pickLabels,
}: {
  label: string;
  value: number;
  onChange: (h: number) => void;
  format: (h: number) => string;
  labels?: PickLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickLine label={label} text={format(value)} placeholder="" onOpen={() => setOpen(true)} />
      {open && (
        <HourSheet
          title={label}
          value={value}
          format={format}
          labels={labels}
          onClose={() => setOpen(false)}
          onDone={(h) => {
            onChange(h);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function HourSheet({
  title,
  value,
  format,
  onDone,
  onClose,
  labels = pickLabels,
}: {
  title: string;
  value: number;
  format: (h: number) => string;
  onDone: (h: number) => void;
  onClose: () => void;
  labels?: PickLabels;
}) {
  const [v, setV] = useState(value);
  return (
    <PickShell
      title={title}
      closeLabel={labels.close}
      onClose={onClose}
      actions={
        <button
          type="button"
          className="hg-btn hg-btn--primary hg-btn--block"
          onClick={() => onDone(v)}
        >
          {labels.confirmHour(format(v))}
        </button>
      }
    >
      <PickGrid<number>
        label={labels.hour}
        cols={4}
        value={v}
        items={Array.from({ length: 24 }, (_, h) => ({ value: h, label: format(h) }))}
        onChange={setV}
      />
    </PickShell>
  );
}
