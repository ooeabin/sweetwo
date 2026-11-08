import { cx } from './cx';
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

/** 행 앞 아이콘 칸(hg-lead): 영역 색 원 + 아이콘, 3D 그림, 또는 원 판 없는 3D 아이콘(art3d) */
export function Lead({
  tone,
  icon,
  art,
  photo,
  art3d,
  action,
}: {
  tone?: 'together' | 'family' | 'goal' | 'safety' | 'invest';
  icon?: IconName;
  /** 3D 그림(Illustration 등) */
  art?: ReactNode;
  /** 사진 주소(목표 사진, 원 안을 꽉 채움, 2026-11-04) */
  photo?: string;
  /** 작은 3D 아이콘 주소(icon3d, 2026-11-05). 원 판 없이 사물만, 있으면 icon 대신 */
  art3d?: string;
  /** UI 동작 아이콘(‘+ 추가’ 줄 등)이면 true: 2026-11-08부터 그림 자리 아이콘은 그리지 않고 빈 원, 동작 아이콘만 그림 */
  action?: boolean;
}) {
  // 2026-11-08 그림 아이콘(3D, 종류 아이콘)은 2D 플랫으로 다시 만들 때까지 빈 원(Illustrations ‘나중 과제’)
  const flat = !photo && !art && !!art3d;
  return (
    <span
      className={cx(
        'hg-lead',
        !flat && tone && (action || !!art) && `hg-lead--${tone}`,
        photo && 'hg-lead--photo',
        flat && 'hg-lead--art',
      )}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photo} alt="" />
      ) : (
        (art ?? (art3d ? <img src={art3d} alt="" /> : action && icon ? <Icon name={icon} /> : null))
      )}
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
