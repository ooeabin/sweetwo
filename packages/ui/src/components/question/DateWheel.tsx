import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../cx';

// 생년월일 휠(docs/design/components/DateWheel.md). 연, 월, 일 세 줄을 위아래로 굴려 고름.
// 가운데 줄이 고른 값, 위아래는 점점 흐리게. 줄마다 spinbutton: ↑↓ 하나, PageUp/PageDown 10(연)·3(월, 일), Home/End 처음/끝.
// 마우스 휠, 터치 스크롤은 그대로 굴러가고 멈춘 칸이 값이 됨(scroll-snap).

export interface YMD {
  y: number;
  m: number;
  d: number;
}

const ROW = 44; // 한 줄 높이(CSS --wheel-row와 같음)
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function Column({
  label,
  items,
  value,
  unit,
  page,
  onChange,
  format,
}: {
  label: string;
  items: number[];
  value: number;
  unit: string;
  page: number;
  onChange: (v: number) => void;
  /** 칸 글자(기본 숫자 + 단위). 읽기 값도 이걸로 */
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(items.indexOf(value), 0);
  const settle = useRef<number | undefined>(undefined);
  const ignore = useRef(false);

  // 값이 바뀌면(키보드, 다른 줄 때문에 일 수가 줄어듦) 그 칸으로 굴림
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ROW) === idx) return;
    ignore.current = true;
    el.scrollTo({ top: idx * ROW });
    window.setTimeout(() => {
      ignore.current = false;
    }, 50);
  }, [idx]);

  const onScroll = () => {
    if (ignore.current) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(Math.max(Math.round(el.scrollTop / ROW), 0), items.length - 1);
      const v = items[i];
      if (v !== undefined && v !== value) onChange(v);
    }, 90);
  };

  const step = (n: number) => {
    const v = items[Math.min(Math.max(idx + n, 0), items.length - 1)];
    if (v !== undefined) onChange(v);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n =
      e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowUp'
          ? -1
          : e.key === 'PageDown'
            ? page
            : e.key === 'PageUp'
              ? -page
              : e.key === 'Home'
                ? -idx
                : e.key === 'End'
                  ? items.length - 1 - idx
                  : null;
    if (n === null) return;
    e.preventDefault();
    step(n);
  };

  return (
    <div
      ref={ref}
      className="hg-wheel__col"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={items[0]}
      aria-valuemax={items[items.length - 1]}
      aria-valuetext={format ? format(value) : `${value}${unit}`}
      onScroll={onScroll}
      onKeyDown={onKey}
    >
      {items.map((v) => (
        <div
          key={v}
          aria-hidden="true"
          className={cx('hg-wheel__item', v === value && 'is-on')}
          onClick={() => onChange(v)}
        >
          {format ? (
            format(v)
          ) : (
            <>
              {v}
              <span className="hg-wheel__unit">{unit}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** 날짜 휠(연·월·일 3열, yearOnly면 연도만). value가 없으면 initial(기본 올해 − 30년 1월 1일)에서 시작하고 그 값을 바로 알려 줌 */
export function DateWheel({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  initial,
  className,
  yearOnly,
  yearMonth,
  lunar,
}: {
  label: string;
  value: YMD | null;
  onChange: (v: YMD) => void;
  minYear: number;
  maxYear: number;
  initial?: YMD;
  className?: string;
  /** 연도만 1열(O-13, P-03a 출생연도). 값의 월·일은 1 */
  yearOnly?: boolean;
  /** 연·월 2열(예정 연·월, 여행 가는 달, 기한). 값의 일은 1 */
  yearMonth?: boolean;
  /** 음력(2026-11-04 Y-07c): 어느 달이든 1~30일(맞는 날인지는 화면이 따로 확인) */
  lunar?: boolean;
}) {
  const dim = (y: number, m: number) => (lunar ? 30 : daysIn(y, m));
  const start = initial ?? { y: maxYear - 12, m: 1, d: 1 };
  const v = value ?? start;
  useEffect(() => {
    if (!value) onChange(start);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: dim(v.y, v.m) }, (_, i) => i + 1);
  const set = (p: Partial<YMD>) => {
    const n = { ...v, ...p };
    n.d = Math.min(n.d, dim(n.y, n.m)); // 2월 30일 같은 날은 그 달 끝날로
    onChange(n);
  };

  return (
    <div
      className={cx(
        'hg-wheel',
        yearOnly && 'hg-wheel--year',
        yearMonth && 'hg-wheel--ym',
        className,
      )}
      role="group"
      aria-label={label}
    >
      <span className="hg-wheel__band" aria-hidden="true" />
      <Column
        label="년"
        items={years}
        value={v.y}
        unit="년"
        page={10}
        onChange={(y) => set({ y })}
      />
      {!yearOnly && (
        <>
          <Column
            label="월"
            items={months}
            value={v.m}
            unit="월"
            page={3}
            onChange={(m) => set({ m })}
          />
          {!yearMonth && (
            <Column
              label="일"
              items={days}
              value={v.d}
              unit="일"
              page={3}
              onChange={(d) => set({ d })}
            />
          )}
        </>
      )}
    </div>
  );
}

export type PayDay = number | 'last';
const LAST = 32; // 휠 안에서 ‘말일’ 자리(31 다음)

/** 월급날 휠(1~31일 + 말일 1열, docs/design/components/DateWheel.md ‘일만’). 값이 없으면 initial을 바로 알려 줌 */
export function DayWheel({
  label,
  value,
  onChange,
  lastLabel,
  hint,
  initial = 25,
}: {
  label: string;
  value: PayDay | null;
  onChange: (v: PayDay) => void;
  lastLabel: string;
  /** 휠 아래 한 줄(‘말일’ 안내) */
  hint?: ReactNode;
  initial?: PayDay;
}) {
  useEffect(() => {
    if (value === null) onChange(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const v = value ?? initial;
  const items = Array.from({ length: LAST }, (_, i) => i + 1);
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
      <div className="hg-wheel hg-wheel--day" role="group" aria-label={label}>
        <span className="hg-wheel__band" aria-hidden="true" />
        <Column
          label={label}
          items={items}
          value={v === 'last' ? LAST : v}
          unit="일"
          page={7}
          format={(d) => (d === LAST ? lastLabel : `${d}일`)}
          onChange={(d) => onChange(d === LAST ? 'last' : d)}
        />
      </div>
      {hint && <p className="hg-wheel__age">{hint}</p>}
    </div>
  );
}

/** 숫자 하나 1열 휠(방해 금지 시각 등, 2026-11-03 기본 드롭다운 대신). 칸 글자는 format */
export function NumberWheel({
  label,
  value,
  items,
  format,
  onChange,
}: {
  label: string;
  value: number;
  items: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="hg-wheel hg-wheel--day" role="group" aria-label={label}>
      <span className="hg-wheel__band" aria-hidden="true" />
      <Column
        label={label}
        items={items}
        value={value}
        unit=""
        page={6}
        format={format}
        onChange={onChange}
      />
    </div>
  );
}
