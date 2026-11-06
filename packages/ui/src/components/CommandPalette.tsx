import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

export interface CommandItem {
  key: string;
  label: string;
  /** 보조 정보(금액, 날짜 등) */
  sub?: string;
  /** 단축키 표시(넓은 창만) */
  kbd?: string;
  /** 줄 앞 아이콘(2026-11-03) */
  icon?: IconName;
  onRun: () => void;
}
export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

/**
 * 검색, 빠른 실행(docs/design/components/CommandPalette.md). 위 입력 줄 + 오른쪽 Esc, 묶음 이름 아래 44px 줄.
 * ↑↓ 이동, Enter 실행, Esc·바깥 누르면 닫기. 결과 목록 listbox, 고른 줄 aria-selected.
 */
export function CommandPalette({
  query,
  onQuery,
  groups,
  onClose,
  labels,
  showKeys = true,
}: {
  query: string;
  onQuery: (q: string) => void;
  groups: CommandGroup[];
  onClose: () => void;
  labels: {
    input: string;
    placeholder: string;
    empty: string;
    /** 아래 키 안내 줄(넓은 창, 2026-11-03): ↑↓ 이동, Enter 열기, Esc 닫기 */
    keys?: { move: string; open: string; close: string };
  };
  /** 단축키 칸 보이기(좁은 창·터치에서는 숨김) */
  showKeys?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const flat = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(0);
  const at = Math.min(active, Math.max(flat.length - 1, 0));
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => prev?.focus();
  }, []);
  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.onRun();
  };
  let n = -1;
  // 앱 틀(탭 막대 등) 위에 덮이게 body에 붙임(2026-11-03, 좁은 창 탭 막대가 딤 위로 보이던 것)
  return createPortal(
    <div
      className="hg-scrim hg-scrim--top"
      style={{ position: 'fixed', inset: 0, zIndex: 70 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hg-cmd" role="dialog" aria-modal="true" aria-label={labels.input}>
        <div className="hg-cmd__input">
          <Icon name="search" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={flat.length ? `${id}-${at}` : undefined}
            aria-label={labels.input}
            placeholder={labels.placeholder}
            value={query}
            onChange={(e) => {
              onQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(at + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(at - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(flat[at]);
              }
            }}
          />
          {showKeys && <span className="hg-kbd">Esc</span>}
        </div>
        <div className="hg-cmd__list" id={`${id}-list`} role="listbox" aria-label={labels.input}>
          {flat.length === 0 && <p className="hg-cmd__empty">{labels.empty}</p>}
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className="hg-cmd__group" aria-hidden="true">
                  {g.label}
                </div>
                {g.items.map((item) => {
                  n += 1;
                  const i = n;
                  const on = i === at;
                  return (
                    <button
                      key={item.key}
                      id={`${id}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      tabIndex={-1}
                      className={on ? 'hg-cmd__item is-active' : 'hg-cmd__item'}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                    >
                      {item.icon && (
                        <span className="hg-cmd__lead" aria-hidden="true">
                          <Icon name={item.icon} size={16} />
                        </span>
                      )}
                      <span className="hg-cmd__text">
                        {item.label}
                        {item.sub && <em>{item.sub}</em>}
                      </span>
                      {showKeys && (on || item.kbd) && (
                        <span className="hg-kbd">{on ? 'Enter' : item.kbd}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
        {showKeys && labels.keys && (
          <div className="hg-cmd__foot" aria-hidden="true">
            <span>
              <span className="hg-kbd">↑</span>
              <span className="hg-kbd">↓</span>
              {labels.keys.move}
            </span>
            <span>
              <span className="hg-kbd">Enter</span>
              {labels.keys.open}
            </span>
            <span>
              <span className="hg-kbd">Esc</span>
              {labels.keys.close}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
