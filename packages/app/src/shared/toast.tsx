import { lastOfflineBlock } from '@sweetwo/api';
import { Toast, TOAST_MS } from '@sweetwo/ui';
import { useEffect } from 'react';
import { create } from 'zustand';
import { sharedCopy } from './copy';

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

/**
 * 인터넷이 없어 방금 쓰기가 막혔으면(api lastOfflineBlock, 3초 안) 화면의 실패 안내 대신
 * “인터넷에 연결되면 할 수 있어요”(다시 시도 없음). 오프라인은 볼 수만 있음(30 동기화 4장)
 */
export const toast = (message: string, action?: ToastItem['action']) => {
  const blocked = Date.now() - lastOfflineBlock() < 3000;
  useToastStore
    .getState()
    .show(blocked ? { message: sharedCopy.needOnline } : { message, action });
};

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
