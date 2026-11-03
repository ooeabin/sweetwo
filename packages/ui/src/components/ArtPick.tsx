import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

// ArtPick(docs/design/components/ArtPick.md): 지정 그림 고르기. round = 프로필 지정 아바타(원), 아니면 목표 지정 사진(둥근 네모).
// 그림 파일이 없으면 회색 빈 자리 + empty 아이콘. 누르면 onPick. lead = 맨 앞 칸(내 사진 올리기 `hg-artpick__upload`).
export function ArtPick({
  items,
  value,
  onPick,
  round = false,
  empty,
  label,
  itemLabel,
  disabled = false,
  lead,
}: {
  items: { key: string; src?: string }[];
  value: string | null;
  onPick: (key: string) => void;
  round?: boolean;
  empty: IconName;
  label: string;
  itemLabel: (index: number) => string;
  disabled?: boolean;
  lead?: ReactNode;
}) {
  return (
    <ul className={cx('hg-artpick', round && 'hg-artpick--round')} aria-label={label}>
      {lead && <li>{lead}</li>}
      {items.map((it, i) => {
        const on = it.key === value;
        return (
          <li key={it.key}>
            <button
              type="button"
              className="hg-artpick__item"
              aria-pressed={on}
              aria-label={itemLabel(i)}
              disabled={disabled}
              onClick={() => onPick(it.key)}
            >
              {it.src ? <img src={it.src} alt="" /> : <Icon name={empty} size={24} />}
              {on && (
                <span className="hg-artpick__check" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
