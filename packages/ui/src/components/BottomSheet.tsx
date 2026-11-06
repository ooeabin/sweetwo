import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

// 아래에서 올라오는 시트(docs/design/components/BottomSheet.md). 좁은 창은 화면 아래에 붙고,
// 넓은 창은 가운데 카드. Esc, 막 누르기, 닫기 버튼으로 닫힘. 포커스는 시트 안에서 돈다.
export function BottomSheet({
  title,
  onClose,
  closeLabel = '닫기',
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children?: ReactNode;
  /** 맨 아래 버튼(꽉 차게) */
  actions?: ReactNode;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !box.current) return;
      const els = [
        ...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input'),
      ];
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="hg-scrim hg-scrim--sheet"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className="hg-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <span className="hg-sheet__handle" aria-hidden="true" />
        <div className="hg-sheet__head">
          <h2 id={id} className="hg-sheet__title">
            {title}
          </h2>
          <button
            type="button"
            className="hg-sheet__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
        {actions && <div className="hg-sheet__actions">{actions}</div>}
      </div>
    </div>
  );
}
