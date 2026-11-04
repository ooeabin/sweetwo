import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

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
      {children}
    </button>
  );
}
