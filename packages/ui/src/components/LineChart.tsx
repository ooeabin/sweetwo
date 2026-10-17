import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cx } from './cx';

// 시간에 따른 금액(docs/design/components/LineChart.md). 카드 끝까지 꽉 찬 면, 눈금·격자·x축 글자·끝점 없음.
// 값은 말풍선으로만 읽음(처음엔 마지막 달). 마우스·끌기·←→로 달을 옮김. 기간 탭은 맨 아래.
export interface LineChartPoint {
  label: string;
  value: number;
  /** 비교 계열(예상 순자산). 값과 모두 같으면 점선을 그리지 않음 */
  expected?: number;
}

export interface LineChartProps {
  label: string;
  value: ReactNode;
  /** 큰 값 아래 회색 줄 */
  sub?: ReactNode;
  /** 변화 알약: 늘면 초록, 줄면 살구(빨강 없음) */
  delta?: { dir: 'up' | 'down'; text: string };
  points: LineChartPoint[];
  /** 말풍선 값 표기 */
  format: (v: number) => string;
  /** 범례: 선 */
  name: string;
  /** 범례: 점선 */
  expectedName?: string;
  /** 말풍선 비교 값 줄 */
  expectedText?: (v: string) => string;
  /** 그림 이름(화면 읽기) */
  plotLabel: string;
  periods?: { label: string; active?: boolean; disabled?: boolean }[];
  periodsLabel?: string;
  onPeriod?: (i: number) => void;
}

const H = 200;
const PAD_T = 56; // 말풍선 자리
const PAD_B = 20;
const IN_L = 20; // 첫 달은 왼쪽 20px 안
const IN_R = 28; // 마지막 달은 오른쪽 28px 안
const EDGE = 8; // 말풍선은 카드 좌우 8px 안으로

const at = (a: number[], i: number) => a[i] ?? 0;

/** 단조 3차 곡선(값이 없는 곳으로 튀지 않게) */
function curve(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return '';
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++)
    d.push((at(ys, i + 1) - at(ys, i)) / (at(xs, i + 1) - at(xs, i) || 1));
  const m: number[] = [at(d, 0)];
  for (let i = 1; i < n - 1; i++) {
    const a = at(d, i - 1);
    const b = at(d, i);
    m.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  m.push(at(d, n - 2));
  for (let i = 0; i < n - 1; i++) {
    const di = at(d, i);
    if (di === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = at(m, i) / di;
    const b = at(m, i + 1) / di;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * di;
      m[i + 1] = t * b * di;
    }
  }
  let p = '';
  for (let i = 0; i < n - 1; i++) {
    const x0 = at(xs, i);
    const x1 = at(xs, i + 1);
    const y0 = at(ys, i);
    const y1 = at(ys, i + 1);
    const h = (x1 - x0) / 3;
    p += ` C${x0 + h},${y0 + at(m, i) * h} ${x1 - h},${y1 - at(m, i + 1) * h} ${x1},${y1}`;
  }
  return p;
}

export function LineChart(p: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const plot = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [bw, setBw] = useState(0);
  const n = p.points.length;
  const [sel, setSel] = useState(n - 1);
  const lastLabel = p.points[n - 1]?.label;

  // 기간이 바뀌면 다시 마지막 달
  useEffect(() => setSel(n - 1), [n, lastLabel]);

  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const read = () => setW(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showExpected = p.points.some((x) => x.expected !== undefined && x.expected !== x.value);
  const vals = p.points.flatMap((x) =>
    showExpected && x.expected !== undefined ? [x.value, x.expected] : [x.value],
  );
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const xAt = (i: number) => (n < 2 ? w - IN_R : IN_L + (i * (w - IN_L - IN_R)) / (n - 1));
  const yAt = (v: number) => PAD_T + ((hi - v) / (hi - lo)) * (H - PAD_T - PAD_B);
  const xs = p.points.map((_, i) => xAt(i));
  const ys = p.points.map((x) => yAt(x.value));
  const i = Math.min(Math.max(sel, 0), n - 1);
  const cur = p.points[i];
  const cx0 = xs[i] ?? 0;
  const cy0 = ys[i] ?? 0;

  useLayoutEffect(() => {
    if (bubble.current) setBw(bubble.current.offsetWidth);
  }, [i, w, cur?.label, cur?.value, cur?.expected]);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (n < 2 || !plot.current) return;
    const x = e.clientX - plot.current.getBoundingClientRect().left;
    let best = 0;
    for (let k = 1; k < n; k++) if (Math.abs(at(xs, k) - x) < Math.abs(at(xs, best) - x)) best = k;
    setSel(best);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowLeft'
        ? i - 1
        : e.key === 'ArrowRight'
          ? i + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setSel(Math.min(Math.max(next, 0), n - 1));
  };

  const line = n ? `M${xs[0]},${ys[0]}${curve(xs, ys)}` : '';
  const area = n
    ? `M0,${ys[0]} L${xs[0]},${ys[0]}${curve(xs, ys)} L${xs[n - 1]},${H} L0,${H} Z`
    : '';
  const eys = p.points.map((x) => yAt(x.expected ?? x.value));
  const eline = showExpected && n ? `M${xs[0]},${eys[0]}${curve(xs, eys)}` : '';
  const half = bw / 2;
  const bx = w ? Math.min(Math.max(cx0, half + EDGE), w - half - EDGE) : cx0;
  const text = cur
    ? [
        cur.label,
        p.format(cur.value),
        showExpected && cur.expected !== undefined && p.expectedText
          ? p.expectedText(p.format(cur.expected))
          : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <section className="hg-chart hg-chart--bleed" aria-label={p.label}>
      <div className="hg-chart__kpi">
        <span className="hg-chart__label">{p.label}</span>
        <span className="hg-chart__value hg-chart__value--lg">{p.value}</span>
        {p.sub}
        {p.delta && (
          <span className="hg-chart__delta">
            <i className={p.delta.dir === 'up' ? 'is-up' : 'is-down'}>{p.delta.text}</i>
          </span>
        )}
      </div>
      <div
        ref={plot}
        className="hg-chart__plot"
        style={{ touchAction: 'pan-y' }}
        role="slider"
        tabIndex={0}
        aria-label={p.plotLabel}
        aria-valuemin={0}
        aria-valuemax={Math.max(n - 1, 0)}
        aria-valuenow={i}
        aria-valuetext={text}
        onPointerMove={pick}
        onPointerDown={pick}
        onKeyDown={key}
      >
        {w > 0 && n > 0 && (
          <>
            <svg viewBox={`0 0 ${w} ${H}`} aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="area-top" />
                  <stop offset="1" className="area-bot" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${uid}-a)`} />
              <line className="line--lead" x1={0} y1={ys[0]} x2={xs[0]} y2={ys[0]} />
              {eline && <path className="line--expected" d={eline} />}
              <path className="line" d={line} />
              <line className="xhair" x1={cx0} y1={0} x2={cx0} y2={H} />
            </svg>
            <span className="hg-chart__dot" style={{ left: cx0, top: cy0 }} />
            <div
              ref={bubble}
              className="hg-chart__bubble"
              style={{ left: bx, top: cy0 }}
              aria-hidden="true"
            >
              <i>{cur?.label}</i>
              <b>{cur ? p.format(cur.value) : ''}</b>
              {showExpected && cur?.expected !== undefined && p.expectedText && (
                <i>{p.expectedText(p.format(cur.expected))}</i>
              )}
            </div>
          </>
        )}
      </div>
      <div className="hg-chart__foot">
        <div className="hg-legend">
          <span>
            <i className="lg-line" />
            {p.name}
          </span>
          {showExpected && p.expectedName && (
            <span>
              <i className="lg-dash" />
              {p.expectedName}
            </span>
          )}
        </div>
      </div>
      {p.periods && (
        <div className="hg-chart__tabs" role="group" aria-label={p.periodsLabel}>
          {p.periods.map((t, k) => (
            <button
              key={t.label}
              type="button"
              className={cx(t.active && 'is-active')}
              aria-pressed={!!t.active}
              disabled={t.disabled}
              onClick={() => p.onPeriod?.(k)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
