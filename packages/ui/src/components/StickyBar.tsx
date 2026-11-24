import { useLayoutEffect, useRef, type ReactNode } from 'react';

// 화면 아래 고정 주 버튼 바(hg-stickybar). 자기 높이를 --hg-bottom-bar-h로 알려 Toast가 그 위로 뜨게 한다
// (docs/design/components/Toast.md ‘아래 고정 바’). 화면마다 따로 처리하지 않는다.
export function StickyBar({
  children,
  pair = false,
}: {
  children: ReactNode;
  /** 버튼 둘(보조 위 + 주 아래, 8px 띄움, 2026-11-24 구역 5) */
  pair?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--hg-bottom-bar-h', `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--hg-bottom-bar-h');
    };
  }, []);
  return (
    <div ref={ref} className={pair ? 'hg-stickybar hg-stickybar--pair' : 'hg-stickybar'}>
      {children}
    </div>
  );
}
