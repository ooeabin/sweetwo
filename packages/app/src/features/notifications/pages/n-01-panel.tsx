import { useEffect, useRef } from 'react';
import { useNotiPanel } from '../data';
import { NotiView } from '../view';

// N-01 알림 패널(넓은 창): 오른쪽 시트, 막 없음. 바깥 누름·Esc·닫기·종 다시 누름으로 닫힘
export function N01Panel() {
  const { open, set } = useNotiPanel();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // 종 버튼은 스스로 열고 닫음
      if (box.current?.contains(t) || t.closest('.hg-topnav__tools, .hg-frame__mhead')) return;
      set(false);
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open, set]);
  if (!open) return null;
  return (
    <div ref={box}>
      <NotiView variant="sheet" onClose={() => set(false)} />
    </div>
  );
}
