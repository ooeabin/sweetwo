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
  useToastStore.getState().show(blocked ? { message: sharedCopy.needOnline } : { message, action });
};

/**
 * 결과 알림이 없던 서버 동작(되돌리기 등, 2026-11-06): 실패하면 “저장하지 못했어요”(13 공통 상태 10번).
 * `onClick: () => quietly(undo())`처럼 쓰고, 성공은 화면이 바로 바뀌어 따로 알리지 않음
 */
export const quietly = (p: Promise<unknown>) => {
  void p.catch(() => toast(sharedCopy.saveFailed));
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
    <div aria-live="polite" className="hg-toasts">
      <Toast key={current.id} message={current.message} action={current.action} />
    </div>
  );
}
