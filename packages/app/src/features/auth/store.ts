import type { AuthProvider } from '@sweetwo/core';
import { create } from 'zustand';

// 가입 도중 값은 메모리에만(A-04 ‘뒤로, 앱 종료: 가입 취소’). 계정은 A-05에서 만든다.
interface AuthStore {
  signup: { provider: AuthProvider; notifyEmail: string | null } | null;
  /** A-01 ‘업데이트 없이 보기만 할게요’ */
  readOnly: boolean;
  startSignup: (provider: AuthProvider) => void;
  setNotifyEmail: (email: string) => void;
  clearSignup: () => void;
  setReadOnly: (on: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  signup: null,
  readOnly: false,
  startSignup: (provider) => set({ signup: { provider, notifyEmail: null } }),
  setNotifyEmail: (email) =>
    set((s) => (s.signup ? { signup: { ...s.signup, notifyEmail: email } } : s)),
  clearSignup: () => set({ signup: null }),
  setReadOnly: (on) => set({ readOnly: on }),
}));
