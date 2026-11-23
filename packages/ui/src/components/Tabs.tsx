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
          onClick={(e) => {
            onChange(it.value);
            // 좁은 창 가로 스크롤에서 고른 탭이 가려지지 않게
            e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          }}
        >
          {it.lead}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 구간 선택(`hg-seg hg-seg--block`, 2026-11-23): 2~3개 중 하나를 꼭 고르는 입력. 너비를 꽉 채움.
 * 탭이 아니라 선택이라 `role="radiogroup"` + `role="radio"`(W-01·W-11 ‘어떻게 챙겨요?’)
 */
export function SegChoice<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="hg-seg hg-seg--block" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={it.value === value}
          className={cx('hg-seg__item', it.value === value && 'is-active')}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 밑줄 탭(`hg-linetabs`, 바탕 기준 2026-11-23): 목록 위 걸러 보기. 글자 15px, 고른 탭만 700 ink + 2px ink 밑줄, 나머지 stone 400.
 * 탭 줄 아래 화면 끝까지 hairline 한 줄. 탭 이름 뒤 숫자(count)는 같은 글자. `role="tablist"` + `role="tab"`
 */
export function LineTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="hg-linetabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          className={cx('hg-linetab', it.value === value && 'is-active')}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {it.count !== undefined && <span className="hg-linetab__n"> {it.count}</span>}
        </button>
      ))}
    </div>
  );
}
