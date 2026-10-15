import { useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface ReorderItem {
  id: string;
  label: string;
  sub?: ReactNode;
}

// 순서 바꾸기 목록(docs/design/components/ReorderList.md). 손잡이로 끌거나 위·아래 버튼으로 옮김.
// 옮길 때마다 onChange(새 순서). 알림은 숨은 aria-live 줄.
export function ReorderList({
  label,
  items,
  onChange,
  labels,
}: {
  label: string;
  items: ReorderItem[];
  onChange: (ids: string[]) => void;
  labels: {
    up: (name: string) => string;
    down: (name: string) => string;
    moved: (name: string, pos: number, total: number) => string;
    handle: (name: string) => string;
  };
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [said, setSaid] = useState('');
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: number, to: number, focus?: 'up' | 'down') => {
    if (to < 0 || to >= items.length || from === to) return;
    const ids = items.map((x) => x.id);
    const [id] = ids.splice(from, 1);
    if (!id) return;
    ids.splice(to, 0, id);
    onChange(ids);
    const name = items[from]?.label ?? '';
    setSaid(labels.moved(name, to + 1, items.length));
    // 옮긴 줄의 같은 버튼에 포커스(끝에 닿아 꺼졌으면 반대 버튼)
    if (focus)
      requestAnimationFrame(() => {
        const same = buttons.current[`${id}-${focus}`];
        const other = buttons.current[`${id}-${focus === 'up' ? 'down' : 'up'}`];
        (same && !same.disabled ? same : other)?.focus();
      });
  };

  return (
    <div className="hg-list">
      <ol className="hg-reorder" aria-label={label}>
        {items.map((x, i) => (
          <li
            key={x.id}
            className={cx(
              'hg-reorder__row',
              drag === x.id && 'is-dragging',
              over === i && drag !== x.id && 'is-drop-before',
            )}
            draggable={drag === x.id}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', x.id);
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex((y) => y.id === drag);
              if (from >= 0) move(from, from < i ? i - 1 : i);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
          >
            <span
              className="hg-reorder__handle"
              aria-hidden="true"
              title={labels.handle(x.label)}
              onPointerDown={() => setDrag(x.id)}
              onPointerUp={() => setDrag((d) => (d === x.id ? null : d))}
            >
              <Icon name="dots-six-vertical" size={20} />
            </span>
            <span className="hg-reorder__text">
              <span className="hg-reorder__label">{x.label}</span>
              {x.sub && <span className="hg-reorder__sub">{x.sub}</span>}
            </span>
            <span className="hg-reorder__moves">
              <IconButton
                ref={(el) => {
                  buttons.current[`${x.id}-up`] = el;
                }}
                icon="chevron-up"
                label={labels.up(x.label)}
                ghost
                small
                disabled={i === 0}
                onClick={() => move(i, i - 1, 'up')}
              />
              <IconButton
                ref={(el) => {
                  buttons.current[`${x.id}-down`] = el;
                }}
                icon="chevron-down"
                label={labels.down(x.label)}
                ghost
                small
                disabled={i === items.length - 1}
                onClick={() => move(i, i + 1, 'down')}
              />
            </span>
          </li>
        ))}
      </ol>
      <span className="hg-sr" aria-live="polite">
        {said}
      </span>
    </div>
  );
}
