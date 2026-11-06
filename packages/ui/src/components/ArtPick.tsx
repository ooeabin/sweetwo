import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

// ArtPick(docs/design/components/ArtPick.md): 사진 고르기 칸. round = 원, 아니면 둥근 네모(목표 사진 G-02p).
// 그림 파일이 없으면 회색 빈 자리 + empty 아이콘. 누르면 onPick. lead = 맨 앞 칸(사진 올리기 `hg-artpick__upload`, 이름까지 소비자가 그림).
// name이 있으면 칸 아래 이름(2026-11-05 ‘내 사진’ ‘기본 사진’), 화면 읽기 이름도 같음.
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
  items: { key: string; src?: string; name?: string }[];
  value: string | null;
  onPick: (key: string) => void;
  round?: boolean;
  empty: IconName;
  label: string;
  itemLabel?: (index: number) => string;
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
              aria-label={it.name ?? itemLabel?.(i) ?? ''}
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
            {it.name && (
              <span className="hg-artpick__name" aria-hidden="true">
                {it.name}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
