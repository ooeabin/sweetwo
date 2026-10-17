import { adminSignOut } from '@sweetwo/api';
import { useEffect } from 'react';

// 어드민 세션(33 3장): 30분 무활동이면 로그아웃, 로그인 뒤 최대 8시간. 동시 세션 1개는 서버 설정(Supabase Auth 단일 세션).
const IDLE_MS = 30 * 60_000;
const MAX_MS = 8 * 3_600_000;
const START_KEY = 'sweetwo-admin-start';

const startedAt = () => {
  try {
    const v = Number(localStorage.getItem(START_KEY));
    if (v) return v;
    const now = Date.now();
    localStorage.setItem(START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
};
export const clearSessionClock = () => {
  try {
    localStorage.removeItem(START_KEY);
  } catch {
    /* 저장소를 못 쓰면 그대로 */
  }
};

/** 무활동·최대 시간 감시. 끝나면 onExpire */
export function useSessionGuard(onExpire: () => void) {
  useEffect(() => {
    const start = startedAt();
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ['mousedown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = window.setInterval(() => {
      const now = Date.now();
      if (now - last > IDLE_MS || now - start > MAX_MS) {
        clearSessionClock();
        void adminSignOut().finally(onExpire);
      }
    }, 30_000);
    return () => {
      window.clearInterval(t);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [onExpire]);
}
