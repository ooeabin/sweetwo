import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';

// 메뉴 서랍(docs/design/components/Drawer.md, 2026-11-09 GCOO 홈처럼): 오른쪽에서 들어오는 흰 판 + 뒤 막.
// 머리 오른쪽에 도구(알림 종) + 닫기 ✕, 본문은 글자만 있는 줄 묶음, 맨 아래 작은 버전 글자.
// 포커스는 판 안에서 돌고, Esc·막 누르기·✕로 닫힘. 닫으면 연 버튼으로 포커스가 돌아감. ‘동작 줄이기’면 미끄러짐 없음(CSS).

export interface DrawerItem {
  key: string;
  label: string;
  /** 지금 화면(굵은 ink, aria-current="page") */
  current?: boolean;
  onSelect: () => void;
}

export function Drawer({
  label,
  closeLabel,
  groups,
  tools,
  foot,
  onClose,
}: {
  /** 화면 읽기 이름(“메뉴”) */
  label: string;
  closeLabel: string;
  /** 줄 묶음(묶음 사이 hairline-soft 선) */
  groups: DrawerItem[][];
  /** 머리 오른쪽 ✕ 앞 도구(알림 종) */
  tools?: ReactNode;
  /** 맨 아래 작은 글자(버전) */
  foot?: ReactNode;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // 첫 포커스는 판 자체(화면 읽기가 “메뉴, 대화상자”부터 읽음)
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const els = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href]')];
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === box.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="hg-drawer-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className="hg-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="hg-drawer__head">
          {tools}
          <IconButton icon="x" label={closeLabel} ghost onClick={onClose} />
        </div>
        <nav className="hg-drawer__body" aria-label={label}>
          {groups
            .filter((g) => g.length > 0)
            .map((g) => (
              <ul key={g[0]?.key} className="hg-drawer__group">
                {g.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className={cx('hg-drawer__item', it.current && 'is-current')}
                      aria-current={it.current ? 'page' : undefined}
                      onClick={it.onSelect}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </nav>
        {foot && <p className="hg-drawer__foot">{foot}</p>}
      </div>
    </div>
  );
}
