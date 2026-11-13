import { cx } from './cx';

// 달마다 값 막대(docs/design/components/MonthBars.md). F-01 순자산 6달. 0에서 위로(음수가 있으면 0선 + 아래로), 이번 달만 진하게 + 값.
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
  const empty = COLS - shown.length;
  const neg = Math.max(...shown.map((b) => -b.value), 0);
  if (neg > 0) {
    // 음수가 있으면 0선(2026-11-12 QA 8구간 S8-08, 23 F-01 예외): 칸마다 높이 MAX_H인 그림 자리를 0선 위아래로 나눔.
    // 위·아래 높이는 가장 큰 양수·음수 비율대로, 음수 막대는 0선 아래로
    const pos = Math.max(...shown.map((b) => b.value), 0);
    const up = Math.round((MAX_H * pos) / (pos + neg));
    const h = (v: number) => Math.max(Math.round((Math.abs(v) * MAX_H) / (pos + neg)), 4);
    const plot = (b?: MonthBar) => (
      <span className="hg-mbars__plot" style={{ height: `${MAX_H}px` }}>
        <span className="hg-mbars__zero" style={{ bottom: `${MAX_H - up}px` }} />
        {b && (
          <i
            className={b.value < 0 ? 'is-neg' : undefined}
            style={
              b.value < 0
                ? { top: `${up}px`, height: `${h(b.value)}px` }
                : { bottom: `${MAX_H - up}px`, height: `${h(b.value)}px` }
            }
          />
        )}
      </span>
    );
    return (
      <div
        className={cx('hg-mbars', 'hg-mbars--neg', `hg-mbars--${tone}`)}
        role="img"
        aria-label={label}
      >
        {Array.from({ length: empty }, (_, i) => (
          <span key={`e${i}`} className="hg-mbars__col" aria-hidden="true">
            <span className="hg-mbars__v" />
            {plot()}
            <small>&nbsp;</small>
          </span>
        ))}
        {shown.map((b) => (
          <span key={b.key} className={cx('hg-mbars__col', b.now && 'is-now')} title={b.tip}>
            <span className="hg-mbars__v">{b.now ? nowText : ''}</span>
            {plot(b)}
            <small>{b.label}</small>
          </span>
        ))}
      </div>
    );
  }
  const max = Math.max(...shown.map((b) => b.value), 1);
  return (
    <div className={cx('hg-mbars', `hg-mbars--${tone}`)} role="img" aria-label={label}>
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} className="hg-mbars__col" aria-hidden="true" />
      ))}
      {shown.map((b) => (
        <span key={b.key} className={cx('hg-mbars__col', b.now && 'is-now')} title={b.tip}>
          <span className="hg-mbars__v">{b.now ? nowText : ''}</span>
          <i
            style={{ height: `${Math.max(Math.round((Math.max(b.value, 0) / max) * MAX_H), 4)}px` }}
          />
          <small>{b.label}</small>
        </span>
      ))}
    </div>
  );
}
