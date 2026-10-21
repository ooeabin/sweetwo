import { useEffect, useRef } from 'react';
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
}: {
  label: string;
  items: number[];
  value: number;
  unit: string;
  page: number;
  onChange: (v: number) => void;
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
      aria-valuetext={`${value}${unit}`}
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
          {v}
          <span className="hg-wheel__unit">{unit}</span>
        </div>
      ))}
    </div>
  );
}

/** 생년월일 3열 휠. value가 없으면 initial(기본 올해 − 30년 1월 1일)에서 시작하고 그 값을 바로 알려 줌 */
export function DateWheel({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  initial,
  className,
}: {
  label: string;
  value: YMD | null;
  onChange: (v: YMD) => void;
  minYear: number;
  maxYear: number;
  initial?: YMD;
  className?: string;
}) {
  const start = initial ?? { y: maxYear - 12, m: 1, d: 1 };
  const v = value ?? start;
  useEffect(() => {
    if (!value) onChange(start);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysIn(v.y, v.m) }, (_, i) => i + 1);
  const set = (p: Partial<YMD>) => {
    const n = { ...v, ...p };
    n.d = Math.min(n.d, daysIn(n.y, n.m)); // 2월 30일 같은 날은 그 달 끝날로
    onChange(n);
  };

  return (
    <div className={cx('hg-wheel', className)} role="group" aria-label={label}>
      <span className="hg-wheel__band" aria-hidden="true" />
      <Column
        label="년"
        items={years}
        value={v.y}
        unit="년"
        page={10}
        onChange={(y) => set({ y })}
      />
      <Column
        label="월"
        items={months}
        value={v.m}
        unit="월"
        page={3}
        onChange={(m) => set({ m })}
      />
      <Column label="일" items={days} value={v.d} unit="일" page={3} onChange={(d) => set({ d })} />
    </div>
  );
}
