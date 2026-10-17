import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

// 되돌릴 수 없는 행동 앞의 확인(docs/design/components/Modal.md): 영구 삭제, 연결 끊기, 계정 삭제만.
// 실행 버튼은 danger, 오른쪽 끝. Esc·바깥 누르면 취소, 포커스는 모달 안에.
export function Modal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key !== 'Tab' || !box.current) return;
      const els = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
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
  }, [onCancel]);
  return (
    <div
      className="hg-scrim"
      style={{ position: 'fixed', inset: 0, zIndex: 50 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={box}
        className="hg-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={body ? `${id}-b` : undefined}
      >
        <h2 id={`${id}-t`} className="hg-modal__title">
          {title}
        </h2>
        {body && (
          <p id={`${id}-b`} className="hg-modal__body">
            {body}
          </p>
        )}
        <div className="hg-modal__actions">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
