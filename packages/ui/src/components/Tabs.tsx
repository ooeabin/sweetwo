import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

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
 * 고르기(`SegChoice`, 2026-11-24 사용자 결정 ‘고르기 토글’): 입력에서 꼭 하나를 고름. 회색 판 + 흰 알약은 입력 고르기에 쓰지 않음.
 * 2026-11-24 사용자 결정 ‘F 떠 있는 흰 알약’(테두리 없음):
 * - 버튼(`hg-choice`): 짧은 2~3개. 회색 판 안 같은 너비 칸, 고른 칸은 흰 판 + 그림자 + 700.
 * - 카드 줄(`hg-choice--rows`): 4개 이상, 긴 글자, 설명(`sub`)이 있을 때. 줄마다 56px 이상, 오른쪽 원(고르면 오렌지 체크).
 * 어느 쪽인지는 `variant`를 안 주면 위 기준으로 정함(`choiceVariant`). `role="radiogroup"` + `role="radio"`(탭이 아니라 선택)
 */
export interface ChoiceItem<T extends string> {
  value: T;
  label: string;
  /** 설명(보조 줄). 있으면 라디오 줄 */
  sub?: string;
  /** 흐린 선택지(이유 문구 없이, 못 고름) */
  disabled?: boolean;
}

/** 버튼(A)인지 라디오 줄(C)인지: 4개 이상, 설명 있음, 긴 글자(2개는 9자, 3개는 5자 넘음)면 줄 */
export function choiceVariant<T extends string>(items: ChoiceItem<T>[]): 'buttons' | 'rows' {
  if (items.length >= 4 || items.some((i) => i.sub)) return 'rows';
  const longest = Math.max(...items.map((i) => [...i.label].length));
  return longest > (items.length === 3 ? 5 : 9) ? 'rows' : 'buttons';
}

export function SegChoice<T extends string>({
  items,
  value,
  onChange,
  label,
  variant,
}: {
  items: ChoiceItem<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  variant?: 'buttons' | 'rows';
}) {
  const v = variant ?? choiceVariant(items);
  return (
    <div
      className={cx('hg-choice', v === 'rows' && 'hg-choice--rows')}
      role="radiogroup"
      aria-label={label}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={it.value === value}
          disabled={it.disabled}
          className={cx('hg-choice__item', it.value === value && 'is-on')}
          onClick={() => onChange(it.value)}
        >
          <span className="hg-choice__text">
            <span className="hg-choice__label">{it.label}</span>
            {it.sub && <span className="hg-choice__sub">{it.sub}</span>}
          </span>
          {v === 'rows' && (
            <span className="hg-choice__dot" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
          )}
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
