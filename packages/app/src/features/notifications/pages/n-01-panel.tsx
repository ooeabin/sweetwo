import { useEffect, useRef } from 'react';
import { useNotiPanel } from '../data';
import { NotiView } from '../view';

// N-01 알림 패널(넓은 창): 오른쪽 시트, 막 없음. 바깥 누름·Esc·닫기·종 다시 누름으로 닫힘
export function N01Panel() {
  const { open, set } = useNotiPanel();
  const box = useRef<HTMLDivElement>(null);
  // 연 버튼(종). Esc·닫기로 닫으면 포커스를 돌려줌(2026-11-12 QA 10구간 S10-09, NotificationPanel.md)
  // 패널이 첫 줄에 포커스를 주기 전(그리는 때)에 잡아 둠
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined')
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wasOpen.current = open;
  const close = () => {
    set(false);
    const el = opener.current;
    if (el && el !== document.body && el.isConnected) el.focus();
  };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // 종 버튼은 스스로 열고 닫음
      if (box.current?.contains(t) || t.closest('.hg-appside__foot, .hg-frame__mhead')) return;
      set(false);
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open, set]);
  if (!open) return null;
  return (
    <div ref={box}>
      <NotiView variant="sheet" onClose={close} />
    </div>
  );
}
