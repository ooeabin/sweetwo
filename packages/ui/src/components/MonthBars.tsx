import { cx } from './cx';

// 달마다 값 막대(docs/design/components/MonthBars.md). F-01 순자산 6달. 0에서 위로만, 이번 달만 진하게 + 값.
// 지난 달은 옅은 영역 색, 이번 달은 진한 영역 색(기본 invest). 칸은 늘 6개(달이 적으면 왼쪽을 비움).
export interface MonthBar {
  key: string;
  /** x축 글자(“10월”) */
  label: string;
  value: number;
  /** 툴팁(“2026년 10월 1,600만 원”) */
  tip: string;
  now?: boolean;
}

const COLS = 6;
const MAX_H = 96;

export function MonthBars({
  bars,
  label,
  nowText,
  tone = 'invest',
}: {
  bars: MonthBar[];
  /** 그림 이름(화면 읽기), 예: “달마다 순자산, 10월 1,600만 원” */
  label: string;
  /** 이번 달 막대 위 값(“1,600만”) */
  nowText?: string;
  tone?: 'invest' | 'safety' | 'goal' | 'family' | 'together';
}) {
  const shown = bars.slice(-COLS);
  const max = Math.max(...shown.map((b) => b.value), 1);
  const empty = COLS - shown.length;
  return (
    <div className={cx('hg-mbars', `hg-mbars--${tone}`)} role="img" aria-label={label}>
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} className="hg-mbars__col" aria-hidden="true" />
      ))}
      {shown.map((b) => (
        <span key={b.key} className={cx('hg-mbars__col', b.now && 'is-now')} title={b.tip}>
          <span className="hg-mbars__v">{b.now ? nowText : ''}</span>
          <i style={{ height: `${Math.max(Math.round((Math.max(b.value, 0) / max) * MAX_H), 4)}px` }} />
          <small>{b.label}</small>
        </span>
      ))}
    </div>
  );
}
