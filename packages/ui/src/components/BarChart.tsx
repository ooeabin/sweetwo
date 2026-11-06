import type { ReactNode } from 'react';
import { cx } from './cx';

// 계획 기준 위아래 막대(docs/design/components/BarChart.md). 가운데 계획선에서 더 넣은 달은 위, 덜 넣은 달은 아래.
// 막대 끝에 차이 숫자, 이번 달은 ink. 색은 알약에만(100% 이상 초록, 미만 살구). 막대마다 툴팁(title).
export interface BarChartBar {
  key: string;
  /** x축 글자(“8월”) */
  label: string;
  /** 계획과의 차이(원) */
  diff: number;
  /** 막대 끝 숫자(“+30”, “−30”, “0”) */
  diffText: string;
  /** 툴팁(“7월 190만 원, 계획보다 30만 원 덜”) */
  tip: string;
  now?: boolean;
}

const COL = 64;
const BAR = 44;
const HALF = 80;
const TOP = 24; // 위 숫자 자리
const BOTTOM = 24; // 아래 숫자 자리
const AXIS = 24; // 월 글자
const R = 6;

/** 끝 모서리만 둥근 막대(위로 뻗으면 위쪽, 아래로 뻗으면 아래쪽) */
function barPath(x: number, base: number, h: number) {
  const up = h > 0;
  const len = Math.abs(h);
  const r = Math.min(R, len, BAR / 2);
  const end = up ? base - len : base + len;
  const s = up ? 1 : -1; // 끝에서 기준선 쪽 방향
  return [
    `M${x},${base}`,
    `L${x},${end + s * r}`,
    `Q${x},${end} ${x + r},${end}`,
    `L${x + BAR - r},${end}`,
    `Q${x + BAR},${end} ${x + BAR},${end + s * r}`,
    `L${x + BAR},${base}`,
    'Z',
  ].join(' ');
}

export function BarChart({
  label,
  value,
  delta,
  note,
  bars,
  plotLabel,
}: {
  label: string;
  /** 요약 값(평균) */
  value: ReactNode;
  /** 계획 대비 알약: 100% 이상 up(초록), 미만 down(살구) */
  delta?: { dir: 'up' | 'down'; text: string };
  /** 머리 아래 한 줄 설명 */
  note?: string;
  bars: BarChartBar[];
  /** 그림 이름(화면 읽기) */
  plotLabel: string;
}) {
  const max = Math.max(...bars.map((b) => Math.abs(b.diff)), 1);
  // 칸은 늘 6개 이상(막대가 적어도 크기가 같게), 최근 달이 오른쪽 끝
  const cols = Math.max(bars.length, 6);
  const w = cols * COL;
  const off = cols - bars.length;
  const base = TOP + HALF;
  const h = TOP + HALF * 2 + BOTTOM + AXIS;
  return (
    <section className="hg-chart" aria-label={label}>
      <div className="hg-chart__head">
        <div className="hg-chart__kpi">
          <span className="hg-chart__label">{label}</span>
          <span className="hg-chart__value">{value}</span>
          {delta && (
            <span className="hg-chart__delta">
              <i className={delta.dir === 'up' ? 'is-up' : 'is-down'}>{delta.text}</i>
            </span>
          )}
        </div>
      </div>
      {note && <p className="hg-chart__note">{note}</p>}
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={plotLabel}>
        {bars.map((b, i) => {
          const x = (i + off) * COL + (COL - BAR) / 2;
          const len = Math.round((Math.abs(b.diff) / max) * HALF);
          const cls = b.diff > 0 ? 'dev-up' : b.diff < 0 ? 'dev-dn' : 'dev-eq';
          const tip = <title>{b.tip}</title>;
          const valueY = b.diff > 0 ? base - len - 8 : b.diff < 0 ? base + len + 16 : base - 8;
          return (
            <g key={b.key}>
              {b.diff === 0 ? (
                <rect
                  className={cx(cls, b.now && 'is-now')}
                  x={x}
                  y={base - 2}
                  width={BAR}
                  height={4}
                  rx={2}
                >
                  {tip}
                </rect>
              ) : (
                <path
                  className={cx(cls, b.now && 'is-now')}
                  d={barPath(x, base, b.diff > 0 ? len : -len)}
                >
                  {tip}
                </path>
              )}
              <text
                className={cx('dev-v', b.now && 'is-now')}
                x={x + BAR / 2}
                y={valueY}
                textAnchor="middle"
              >
                {b.diffText}
              </text>
              <text
                className={b.now ? 'label' : undefined}
                x={x + BAR / 2}
                y={h - 6}
                textAnchor="middle"
              >
                {b.label}
              </text>
            </g>
          );
        })}
        <line className="dev-plan" x1={0} x2={w} y1={base} y2={base} />
      </svg>
    </section>
  );
}
