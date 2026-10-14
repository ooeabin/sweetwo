import type { ReactNode } from 'react';
import { cx } from './cx';

// 정보 묶음. 기본은 흰 카드, 영역을 알릴 때만 틴트(docs/design/components/Card.md)
type Tint = 'together' | 'family' | 'goal' | 'safety' | 'invest';

export function Card({
  label,
  value,
  unit,
  meta,
  badge,
  raised,
  tint,
  children,
  className,
}: {
  label?: ReactNode;
  value?: ReactNode;
  unit?: string;
  meta?: ReactNode;
  badge?: ReactNode;
  raised?: boolean;
  tint?: Tint;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'hg-card',
        raised && 'hg-card--raised',
        tint && `hg-card--tint hg-card--${tint}`,
        className,
      )}
    >
      {(label || badge) && (
        <div className="hg-card__top">
          {label && <span className="hg-card__label">{label}</span>}
          {badge}
        </div>
      )}
      {value !== undefined && (
        <p className="hg-card__value">
          {value}
          {unit && <span className="hg-unit">{unit}</span>}
        </p>
      )}
      {meta && <p className="hg-card__meta hg-meta">{meta}</p>}
      {children}
    </div>
  );
}
