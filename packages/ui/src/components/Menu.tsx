import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

export interface MenuAction {
  label: string;
  icon?: IconName;
  /** 지우기: 맨 아래, 구분선 뒤, danger 글자 */
  danger?: boolean;
  onSelect: () => void;
}

// ⋯ 동작 목록(docs/design/components/Menu.md). 4개까지, 지우기는 맨 아래.
// 키보드: ↑/↓ 이동, Enter 실행, Esc 닫고 여는 버튼으로. 바깥을 누르면 닫힘. 좁은 창 BottomSheet는 BottomSheet를 만들 때.
export function Menu({
  label,
  actions,
  button,
  open: openProp,
  onOpenChange,
}: {
  label: string;
  actions: MenuAction[];
  /** 글자 버튼으로 열기(보조 버튼, 예: 오늘 띠 ‘추가’). 없으면 ⋯ */
  button?: string;
  /** 밖에서 열고 닫기(Ctrl+N 등) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(open) : v;
    setOwn(next);
    onOpenChange?.(next);
  };
  const wrap = useRef<HTMLSpanElement>(null);
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const plain = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);
  const all = [...plain, ...danger];

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const off = (e: MouseEvent) => {
      if (wrap.current?.contains(e.target as Node)) return;
      setOwn(false);
      change.current?.(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);

  const close = () => {
    setOpen(false);
    wrap.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const i = items.current.findIndex((b) => b === document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = all.length;
      items.current[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n]?.focus();
    }
  };
  const item = (a: MenuAction, i: number) => (
    <button
      key={a.label}
      ref={(el) => {
        items.current[i] = el;
      }}
      type="button"
      role="menuitem"
      className={a.danger ? 'hg-menu__item hg-menu__item--danger' : 'hg-menu__item'}
      onClick={() => {
        setOpen(false);
        a.onSelect();
      }}
    >
      {a.icon && <Icon name={a.icon} size={16} />}
      {a.label}
    </button>
  );

  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      {button ? (
        <button
          type="button"
          className="hg-btn hg-btn--secondary"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {button}
        </button>
      ) : (
        <IconButton
          icon="ellipsis"
          label={label}
          ghost
          className={open ? 'is-on' : undefined}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
      )}
      {open && (
        <div
          className="hg-menu hg-menu--actions"
          role="menu"
          aria-label={label}
          onKeyDown={onKey}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 'var(--space-1)',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          {plain.map((a, i) => item(a, i))}
          {danger.length > 0 && plain.length > 0 && (
            <div className="hg-menu__sep" role="separator" />
          )}
          {danger.map((a, i) => item(a, plain.length + i))}
        </div>
      )}
    </span>
  );
}
