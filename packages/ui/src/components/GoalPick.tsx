import type { ReactNode } from 'react';
import { cx } from './cx';
import { goalIcon } from './goal-icons';
import { Icon } from './Icon';

// 그림 카드로 목표 고르기(docs/design/components/GoalPick.md). 고른 순서 = 순번 원, 해제하면 당겨짐.
export interface GoalPickItem {
  key: string;
  name: string;
  /** 지정 사진 주소(2026-11-04 실사, 파일이 없으면 아이콘) */
  photo?: string;
  recommended?: boolean;
}

export function GoalPick({
  items,
  order,
  onToggle,
  customKey,
  customLabel,
  recommendedLabel,
}: {
  items: GoalPickItem[];
  /** 고른 순서(1부터), 안 골랐으면 undefined */
  order: (key: string) => number | undefined;
  onToggle: (key: string) => void;
  /** 직접 만들기 카드(맨 끝) */
  customKey?: string;
  customLabel?: string;
  recommendedLabel: string;
}) {
  const card = (key: string, name: string, art: ReactNode, rec?: boolean) => {
    const n = order(key);
    return (
      <button
        key={key}
        type="button"
        aria-pressed={n !== undefined}
        className={cx('hg-pick__item', n !== undefined && 'is-on')}
        onClick={() => onToggle(key)}
      >
        {rec && <span className="hg-tag">{recommendedLabel}</span>}
        {n !== undefined && <span className="hg-pick__order">{n}</span>}
        {art}
        <span>{name}</span>
      </button>
    );
  };
  return (
    <div className="hg-pick">
      {items.map((t) =>
        card(
          t.key,
          t.name,
          t.photo ? (
            <span
              className="hg-pick__art hg-pick__art--icon hg-pick__art--photo"
              aria-hidden="true"
            >
              <img src={t.photo} alt="" />
            </span>
          ) : (
            // 사진이 아직 없으면 아이콘(2026-11-02, 쿠팡플레이 장르 고르기처럼)
            <span className="hg-pick__art hg-pick__art--icon" aria-hidden="true">
              <Icon name={goalIcon(t.key)} size={24} />
            </span>
          ),
          t.recommended,
        ),
      )}
      {customKey &&
        customLabel &&
        card(
          customKey,
          customLabel,
          <span className="hg-pick__art hg-pick__art--custom" aria-hidden="true">
            <Icon name="plus" />
          </span>,
        )}
    </div>
  );
}
