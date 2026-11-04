import type { ReactNode } from 'react';

// F-08 분포 그림(docs/design/components/Distribution.md): 종 모양 곡선을 10% 칸 10개로 나누고 우리 위치에 점 + “우리”.
// 위치는 백분위(0~100, 아래에서부터). 칸 색은 chart-invest 하나, 아래 칸에서 위로 갈수록 진하게, 우리 칸만 100%.
const W = 320;
const H = 120;
const BASE = 100;
const Z = 2.6; // 곡선 양끝 z

// 표준정규 분위수(Acklam 근사)
function invNorm(p: number): number {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.928510446969, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  const poly = (k: number[], x: number) => k.reduce((t, v) => t * x + v, 0);
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return poly(c, r) / (poly(d, r) * r + 1);
  }
  if (q > 1 - 0.02425) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -poly(c, r) / (poly(d, r) * r + 1);
  }
  const r = q - 0.5;
  const s = r * r;
  return (poly(a, s) * r) / (poly(b, s) * s + 1);
}
const x = (z: number) => ((z + Z) / (2 * Z)) * W;
const y = (z: number) => BASE - Math.exp(-(z * z) / 2) * (BASE - 12);

function band(z0: number, z1: number) {
  const n = 12;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    pts.push(`${x(z).toFixed(1)},${y(z).toFixed(1)}`);
  }
  return `M${x(z0).toFixed(1)},${BASE} L${pts.join(' L')} L${x(z1).toFixed(1)},${BASE} Z`;
}

export function Distribution({
  label,
  tag,
  title,
  sub,
  percentile,
  axis,
  youLabel,
  ariaLabel,
}: {
  label: ReactNode;
  tag?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** 아래에서부터 백분위 0~100(상위 n%면 100 − n) */
  percentile: number;
  axis: { low: string; mid: string; high: string };
  youLabel: string;
  ariaLabel: string;
}) {
  const p = Math.min(Math.max(percentile, 1), 99) / 100;
  const cuts = Array.from({ length: 11 }, (_, i) =>
    i === 0 ? -Z : i === 10 ? Z : invNorm(i / 10),
  );
  const mine = Math.min(Math.floor(p * 10), 9);
  const zp = Math.min(Math.max(invNorm(p), -Z), Z);
  const px = x(zp);
  const py = y(zp);
  return (
    <div className="hg-dist">
      <div className="hg-dist__head">
        <span className="hg-dist__label">{label}</span>
        {tag}
      </div>
      <p className="hg-dist__title">{title}</p>
      <svg viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label={ariaLabel}>
        {cuts.slice(0, 10).map((z0, i) => (
          <path
            key={i}
            className="band"
            d={band(z0 + (i ? 0.012 : 0), (cuts[i + 1] ?? Z) - 0.012)}
            style={{ opacity: i === mine ? 1 : 0.25 + i * 0.05 }}
          />
        ))}
        <line className="base" x1={0} x2={W} y1={BASE} y2={BASE} />
        <line className="pin" x1={px} x2={px} y1={py} y2={BASE} />
        <circle className="dot" cx={px} cy={py} r={5} />
        <g
          className="you"
          transform={`translate(${Math.min(Math.max(px - 18, 0), W - 36)}, ${Math.max(py - 30, 0)})`}
        >
          <rect width={36} height={20} rx={10} />
          <text x={18} y={14} textAnchor="middle">
            {youLabel}
          </text>
        </g>
        <text x={0} y={H + 12}>
          {axis.low}
        </text>
        <text x={W / 2} y={H + 12} textAnchor="middle">
          {axis.mid}
        </text>
        <text x={W} y={H + 12} textAnchor="end">
          {axis.high}
        </text>
      </svg>
      {sub && <p className="hg-dist__sub">{sub}</p>}
    </div>
  );
}
