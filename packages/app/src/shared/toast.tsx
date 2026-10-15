import { Toast, TOAST_MS } from '@sweetwo/ui';
import { useEffect } from 'react';
import { create } from 'zustand';

// 토스트 하나씩(새 것이 이전 것을 바꿈). 시간은 디자인 Toast 규칙.
type ToastItem = { id: number; message: string; action?: { label: string; onClick: () => void } };
const useToastStore = create<{
  current: ToastItem | null;
  show: (t: Omit<ToastItem, 'id'>) => void;
  hide: () => void;
}>((set) => ({
  current: null,
  show: (t) => set({ current: { ...t, id: Date.now() } }),
  hide: () => set({ current: null }),
}));

export const toast = (message: string, action?: ToastItem['action']) =>
  useToastStore.getState().show({ message, action });

export function ToastHost() {
  const { current, hide } = useToastStore();
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, current.action ? TOAST_MS.withAction : TOAST_MS.plain);
    return () => clearTimeout(t);
  }, [current, hide]);
  if (!current) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'var(--space-8)',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 var(--space-4)',
        zIndex: 50,
      }}
    >
      <Toast key={current.id} message={current.message} action={current.action} />
    </div>
  );
}
