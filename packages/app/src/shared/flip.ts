import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * 목록 줄이 자리를 옮길 때 짧은 이동 애니메이션(FLIP, W-02 체크하면 확인한 쪽으로, 2026-11-19).
 * 컨테이너의 직접 자식 중 `data-flip` 값이 있는 것을 키로 보고, 렌더 뒤 위치가 바뀌었으면 옛 위치에서 제자리로 움직임.
 * ‘동작 줄이기’(prefers-reduced-motion: reduce)면 움직이지 않음
 */
export function useFlip(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  const prev = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const calm =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.querySelectorAll<HTMLElement>(':scope > [data-flip]').forEach((el) => {
      const key = el.dataset.flip ?? '';
      const top = el.offsetTop;
      next.set(key, top);
      const was = prev.current.get(key);
      if (!calm && was !== undefined && was !== top && typeof el.animate === 'function') {
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 220,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        });
      }
    });
    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
