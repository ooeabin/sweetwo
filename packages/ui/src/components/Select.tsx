import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

// 목록에서 하나 고르기(docs/design/components/Select.md). 브라우저 기본 select 대신 버튼 + 펼친 목록(listbox).
// 닫힌 칸: button role="combobox" + aria-haspopup="listbox" + aria-expanded, 이름은 라벨(aria-labelledby), 값은 칸 글자.
// 키보드(2026-11-17): ↑/↓ 열고 옮김, Home/End 처음·끝, Enter·Space 고름, Esc 닫음(값 그대로), Tab 닫음, 글자를 치면 그 글자로 시작하는 항목.
// 포커스는 칸에 그대로 두고 지금 항목은 aria-activedescendant. 바깥을 누르면 닫힘.
export function Select<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
  disabled,
  width,
  help,
}: {
  label: string;
  /** 라벨을 화면 읽기에만(필터 줄처럼 칸이 나란히 있을 때) */
  hideLabel?: boolean;
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  /** 칸 너비(px). 없으면 부모 폭 */
  width?: number;
  help?: string;
}) {
  const id = useId();
  const labelId = `${id}-l`;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-o${i}`;
  const [open, setOpen] = useState(false);
  const cur = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(cur);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  // 지금 항목이 목록 밖이면 보이게
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`)
      ?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const show = (i = cur) => {
    setActive(i);
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    setOpen(false);
    if (o && o.value !== value) onChange(o.value);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = options.length;
    if (!n) return;
    const move = (i: number) => {
      e.preventDefault();
      if (!open) show(i);
      else setActive(i);
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(open ? Math.min(n - 1, active + 1) : cur);
      case 'ArrowUp':
        return move(open ? Math.max(0, active - 1) : cur);
      case 'Home':
        return move(0);
      case 'End':
        return move(n - 1);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return open ? pick(active) : show();
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case 'Tab':
        if (open) setOpen(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const k = e.key.toLowerCase();
          const from = open ? active : cur;
          for (let s = 1; s <= n; s++) {
            const i = (from + s) % n;
            if (options[i]?.label.toLowerCase().startsWith(k)) return move(i);
          }
        }
    }
  };
  const shown = options[cur]?.label ?? '';

  return (
    <div className="hg-field" style={width ? { width, flex: 'none' } : undefined}>
      <span id={labelId} className={hideLabel ? 'hg-sr' : 'hg-field__label'}>
        {label}
      </span>
      <div ref={wrap} className="hg-selectbox">
        <button
          type="button"
          role="combobox"
          className={cx('hg-select', open && 'is-open')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={labelId}
          aria-activedescendant={open ? optId(active) : undefined}
          aria-describedby={help ? `${id}-h` : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKey}
        >
          <span className="hg-select__value">{shown}</span>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
        {open && (
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className="hg-menu hg-select__list"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={optId(i)}
                role="option"
                aria-selected={i === cur}
                className={cx('hg-menu__item hg-select__opt', i === active && 'is-active')}
                // 누르는 동안 칸 포커스를 잃지 않게
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                <span>{o.label}</span>
                {i === cur && <Icon name="check" size={16} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {help && (
        <span id={`${id}-h`} className="hg-help">
          {help}
        </span>
      )}
    </div>
  );
}
