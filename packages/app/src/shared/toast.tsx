import { lastOfflineBlock, lastReadOnlyBlock } from '@sweetwo/api';
import { Toast, TOAST_MS } from '@sweetwo/ui';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { sharedCopy } from './copy';
import { speakMasked } from './masked-text';

// 토스트 하나씩(새 것이 이전 것을 바꿈). 시간은 디자인 Toast 규칙.
// 2026-11-11 화면(경로)이 바뀌면 닫음(O-07 ‘복사했어요’가 다음 화면까지 남던 문제). carry면 바로 다음 화면 하나까지만 가져감
type ToastItem = {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  /** 결과를 알리고 다른 화면으로 옮기는 동작(저장 뒤 돌아가기, 지우고 목록으로): 다음 화면 하나까지 남김 */
  carry?: boolean;
};
const useToastStore = create<{
  current: ToastItem | null;
  show: (t: Omit<ToastItem, 'id'>) => void;
  hide: () => void;
  /** 경로가 바뀜: carry면 한 번 넘기고(carry 끔) 아니면 닫음 */
  routeChanged: () => void;
}>((set, get) => ({
  current: null,
  show: (t) => set({ current: { ...t, id: Date.now() } }),
  hide: () => set({ current: null }),
  routeChanged: () => {
    const c = get().current;
    if (!c) return;
    set({ current: c.carry ? { ...c, carry: false } : null });
  },
}));

/**
 * 인터넷이 없어 방금 쓰기가 막혔으면(api lastOfflineBlock, 3초 안) 화면의 실패 안내 대신
 * “인터넷에 연결되면 할 수 있어요”(다시 시도 없음). 오프라인은 볼 수만 있음(30 동기화 4장)
 */
let quiet: ReturnType<typeof setTimeout> | null = null;
export const toast = (message: string, action?: ToastItem['action'], carry = false) => {
  if (quiet) return;
  const blocked = Date.now() - lastOfflineBlock() < 3000;
  // 보기만 모드(A-01 ‘업데이트 없이 보기만 할게요’)에서 막힌 쓰기: 실패 안내 대신 13-12 문구 + ‘지금 업데이트’
  const readOnly = Date.now() - lastReadOnlyBlock() < 3000;
  useToastStore
    .getState()
    .show(
      blocked
        ? { message: sharedCopy.needOnline }
        : readOnly
          ? { message: sharedCopy.readOnly, action: updateAction() }
          : { message, action, carry },
    );
};

/**
 * 결과를 알린 뒤 바로 다른 화면으로 옮길 때(저장하고 돌아가기, 지우고 목록으로): 다음 화면까지 남는 토스트.
 * 그다음 화면 이동에서는 다른 토스트처럼 닫힌다
 */
export const carryToast = (message: string, action?: ToastItem['action']) =>
  toast(message, action, true);

/** 앱 받기 페이지(스토어 버튼)로. 모바일은 앱 안 브라우저 */
const DOWNLOAD_URL = 'https://sweetwo.kr/download';
const updateAction = (): ToastItem['action'] => ({
  label: sharedCopy.updateNow,
  onClick: () => {
    const b = typeof window === 'undefined' ? undefined : window.sweetwo;
    if (b?.openUrl) void b.openUrl(DOWNLOAD_URL);
    else window.open(DOWNLOAD_URL, '_blank', 'noopener');
  },
});

/**
 * 떠 있는 토스트 닫기(2026-11-09 W-12: 달성 축하로 넘어가기 전에 체크 ‘되돌리기’ 토스트를 닫음).
 * quietMs를 주면 그동안 새 토스트도 띄우지 않음(체크 토스트가 축하로 넘어간 뒤에 늦게 뜨지 않게)
 */
export const hideToast = (quietMs = 0) => {
  if (quiet) clearTimeout(quiet);
  quiet = quietMs > 0 ? setTimeout(() => (quiet = null), quietMs) : null;
  useToastStore.getState().hide();
};

/**
 * 결과 알림이 없던 서버 동작(되돌리기 등, 2026-11-06): 실패하면 “저장하지 못했어요”(13 공통 상태 10번).
 * `onClick: () => quietly(undo())`처럼 쓰고, 성공은 화면이 바로 바뀌어 따로 알리지 않음
 */
export const quietly = (p: Promise<unknown>) => {
  void p.catch(() => toast(sharedCopy.saveFailed));
};

export function ToastHost() {
  const { current, hide, routeChanged } = useToastStore();
  const { pathname } = useLocation();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    routeChanged();
  }, [pathname, routeChanged]);
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, current.action ? TOAST_MS.withAction : TOAST_MS.plain);
    return () => clearTimeout(t);
  }, [current, hide]);
  if (!current) return null;
  // 행동(‘되돌리기’ 등)을 누르면 바로 닫음(2026-11-12 QA 5구간 S5-03: 남아 있으면 두 번 눌려 같은 줄이 두 번 생김)
  const action = current.action;
  return (
    <div aria-live="polite" className="hg-toasts">
      <Toast
        key={current.id}
        message={speakMasked(current.message)}
        action={
          action && {
            label: action.label,
            onClick: () => {
              hide();
              action.onClick();
            },
          }
        }
      />
    </div>
  );
}
