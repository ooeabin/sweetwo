import type { ReactNode } from 'react';
import { cx } from './cx';

// 알약 탭(hg-tabs)과 세그먼트(hg-seg). docs/design/components/Tabs.md
export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** 이름 앞(사람 탭의 Avatar 등) */
  lead?: ReactNode;
  /** 아직 열 수 없는 탭 */
  disabled?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'tabs',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  variant?: 'tabs' | 'seg';
}) {
  const base = variant === 'tabs' ? 'hg-tab' : 'hg-seg__item';
  return (
    <div className={variant === 'tabs' ? 'hg-tabs' : 'hg-seg'} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          disabled={it.disabled}
          className={cx(base, it.value === value && 'is-active')}
          onClick={() => onChange(it.value)}
        >
          {it.lead}
          {it.label}
        </button>
      ))}
    </div>
  );
}
