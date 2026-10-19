import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';

// 목표 진행(docs/design/components/Meter.md). 10칸, 걸친 칸은 비율만큼. 상태는 색이 아니라 글자로(chip).
export type MeterTone = 'goal' | 'safety' | 'invest' | 'together' | 'family';

export function Meter({
  name,
  sub,
  pct,
  pace,
  paceLabel,
  chip,
  tone = 'goal',
  badge,
  lead,
}: {
  name: string;
  /** 이름 아래 금액 줄(“390만 / 780만 원”) */
  sub?: ReactNode;
  /** 진행 % (0~100 밖은 잘라서 칸에) */
  pct: number;
  /** 계획상 지금 위치 %(없으면 눈금 없음) */
  pace?: number;
  paceLabel?: string;
  chip?: string;
  tone?: MeterTone;
  /** 이름 옆 배지(‘지연’ 등) */
  badge?: ReactNode;
  /** 이름 앞 아이콘 칸(Lead, 목표 3D 그림) */
  lead?: ReactNode;
}) {
  const p = Math.min(Math.max(pct, 0), 100);
  return (
    <div className={cx('hg-meter', tone !== 'goal' && `hg-meter--${tone}`)}>
      <div className="hg-meter__head">
        {lead}
        <div className="hg-meter__name">
          <b>
            {name} {badge}
          </b>
          {sub && <span>{sub}</span>}
        </div>
        <span className="hg-meter__pct">
          {Math.round(pct)}
          <small>%</small>
        </span>
      </div>
      <div className="hg-meter__segs" role="img" aria-label={`${name} ${Math.round(pct)}%`}>
        {Array.from({ length: 10 }, (_, i) => {
          const f = Math.min(Math.max((p - i * 10) / 10, 0), 1);
          return (
            <i
              key={i}
              className={f >= 1 ? 'is-on' : f > 0 ? 'is-part' : undefined}
              style={f > 0 && f < 1 ? ({ '--f': f } as CSSProperties) : undefined}
            />
          );
        })}
        {pace !== undefined && (
          <span className="hg-meter__pace" style={{ left: `${Math.min(Math.max(pace, 0), 100)}%` }}>
            <i>{paceLabel}</i>
          </span>
        )}
      </div>
      {chip && <span className="hg-meter__chip">{chip}</span>}
    </div>
  );
}
