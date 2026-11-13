import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { IconButton } from './IconButton';

// 메뉴 서랍(docs/design/components/Drawer.md, 2026-11-09 GCOO 홈처럼): 오른쪽에서 들어오는 흰 판 + 뒤 막.
// 머리 오른쪽에 도구(알림 종) + 닫기 ✕, 본문은 글자만 있는 줄 묶음, 맨 아래 작은 버전 글자.
// 포커스는 판 안에서 돌고, Esc·막 누르기·✕로 닫힘. 닫으면 연 버튼으로 포커스가 돌아감. ‘동작 줄이기’면 미끄러짐 없음(CSS).
// 2026-11-11 QA 4구간 S4-09: body 끝에 그리고(portal), 열린 동안 뒤 화면은 inert(화면 읽기·Tab·누르기 막음) + 스크롤 잠금(hg-scroll-lock).

export interface DrawerItem {
  key: string;
  label: string;
  /** 지금 화면(굵은 ink, aria-current="page") */
  current?: boolean;
  onSelect: () => void;
}

export function Drawer({
  label,
  navLabel,
  closeLabel,
  groups,
  tools,
  foot,
  onClose,
}: {
  /** 화면 읽기 이름(“메뉴”, 대화상자) */
  label: string;
  /** 줄 묶음 nav 이름(대화상자와 다르게, 2026-11-11 S4-20). 없으면 이름 없는 nav */
  navLabel?: string;
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
  // 그릴 자리(body 끝). 렌더 중에 한 번 만들고, 효과에서 붙임
  const host = useRef<HTMLDivElement | null>(null);
  if (!host.current && typeof document !== 'undefined') {
    host.current = document.createElement('div');
    host.current.className = 'hg-drawer-host';
  }
  // 연 버튼(☰)은 뒤 화면을 inert로 만들기 전에 기억(inert가 되면 포커스가 빠짐)
  const opener = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null,
  );
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const h = host.current;
    const back = opener.current;
    if (!h) return;
    document.body.appendChild(h);
    // 뒤 화면(body의 다른 자식)은 inert, 문서 스크롤은 잠금
    const others = [...document.body.children].filter(
      (el): el is HTMLElement => el !== h && el instanceof HTMLElement && !el.inert,
    );
    for (const el of others) el.inert = true;
    const root = document.documentElement;
    root.classList.add('hg-scroll-lock');
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
      for (const el of others) el.inert = false;
      root.classList.remove('hg-scroll-lock');
      h.remove();
      // 닫으면 연 버튼으로(넓은 창으로 바뀌어 닫혔으면 그 버튼이 숨어 있어 포커스가 가지 않음)
      back?.focus();
    };
  }, []);
  if (!host.current) return null;
  return createPortal(
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
        <nav className="hg-drawer__body" aria-label={navLabel}>
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
    </div>,
    host.current,
  );
}
