import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 선택 칩. 고르면 aria-pressed(docs/design/components/Chip.md)
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  order?: number;
  small?: boolean;
}

export function Chip({ selected = false, order, small, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx('hg-chip', small && 'hg-chip--sm', selected && 'is-selected', className)}
      {...rest}
    >
      {order !== undefined && <span className="hg-chip__order">{order}</span>}
      {/* 2026-11-04 작은 칩은 고르면 앞에 체크(검정 채움 대신) */}
      {small && selected && order === undefined && (
        <Icon name="check" size={16} className="hg-chip__check" />
      )}
      {children}
    </button>
  );
}
