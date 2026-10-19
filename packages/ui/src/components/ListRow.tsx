import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

// 목록 한 줄(docs/design/components/ListRow.md). 누를 수 있으면 button, 아니면 div.
export function ListRow({
  icon,
  lead,
  label,
  sub,
  value,
  unit,
  onClick,
  chevron = Boolean(onClick),
}: {
  icon?: IconName;
  lead?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  unit?: string;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : (lead ?? <span />)}
      <span className="hg-listrow__text">
        <span className="hg-listrow__label">{label}</span>
        {sub && <span className="hg-listrow__sub">{sub}</span>}
      </span>
      {value !== undefined ? (
        <span className="hg-listrow__value">
          {value}
          {unit && <span className="hg-unit">{unit}</span>}
        </span>
      ) : (
        <span />
      )}
      {chevron ? <span className="hg-chevron" aria-hidden="true" /> : <span />}
    </>
  );
  return onClick ? (
    <button type="button" className="hg-listrow" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="hg-listrow">{inner}</div>
  );
}

/** 행 앞 아이콘 칸(hg-lead): 영역 색 원 + 아이콘, 또는 3D 그림 */
export function Lead({
  tone,
  icon,
  art,
}: {
  tone?: 'together' | 'family' | 'goal' | 'safety' | 'invest';
  icon?: IconName;
  /** 3D 그림(Illustration 등) */
  art?: ReactNode;
}) {
  return (
    <span className={tone ? `hg-lead hg-lead--${tone}` : 'hg-lead'} aria-hidden="true">
      {art ?? (icon ? <Icon name={icon} /> : null)}
    </span>
  );
}

export function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="hg-list" aria-label={label}>
      {children}
    </div>
  );
}
