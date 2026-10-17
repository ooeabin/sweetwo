import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// 놓친 달 정리 대상(21 ‘놓친 달’): 지금 정리하기 / 쉬어가기를 고르면 그 플랜(끝 날짜)으로 월말 정리 화면을 연다.
// 새로고침해도 이어지게 세션에만 둠. 정리가 끝나면 지움.
interface CloseTarget {
  /** 그 플랜의 끝 날짜(플랜을 찾는 날짜). null이면 이번 플랜 */
  day: string | null;
  mode: 'now' | 'rest' | null;
  /** 쉬어가기로 함께 넘길 지난 플랜들 */
  plans: string[];
  set: (t: { day: string; mode: 'now' | 'rest'; plans: string[] }) => void;
  clear: () => void;
}

export const useCloseTarget = create<CloseTarget>()(
  persist(
    (set) => ({
      day: null,
      mode: null,
      plans: [],
      set: (t) => set(t),
      clear: () => set({ day: null, mode: null, plans: [] }),
    }),
    {
      name: 'sweetwo-close-target',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ day: s.day, mode: s.mode, plans: s.plans }),
    },
  ),
);
