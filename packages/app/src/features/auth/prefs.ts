import type { AuthProvider } from '@sweetwo/core';

// 이 기기에만 두는 값(localStorage). 막혀 있어도 앱은 돌아가야 하니 실패는 무시한다.
const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* 저장 못 해도 다음에 다시 물을 뿐 */
  }
};
const sget = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const sset = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* 무시 */
  }
};

const isProvider = (v: string | null): v is AuthProvider =>
  v === 'kakao' || v === 'google' || v === 'apple';

export const prefs = {
  /** A-02 ‘최근 사용’: 이 기기에서 마지막으로 쓴 방법 */
  lastProvider: () => {
    const v = get('sweetwo.last-provider');
    return isProvider(v) ? v : null;
  },
  setLastProvider: (p: AuthProvider) => set('sweetwo.last-provider', p),
  /** O-01은 첫 실행에만 */
  started: () => get('sweetwo.started') === '1',
  setStarted: () => set('sweetwo.started', '1'),
  /** A-06 PIN 정하기는 이 기기에서 첫 로그인 직후 1회 */
  pinAsked: () => get('sweetwo.pin-asked') === '1',
  setPinAsked: (on: boolean) => set('sweetwo.pin-asked', on ? '1' : null),
  /** 웹: 리다이렉트 동안 누른 제공자와 돌아갈 화면(탭 안에서만) */
  pendingProvider: () => {
    const v = sget('sweetwo.pending-provider');
    return isProvider(v) ? v : null;
  },
  setPendingProvider: (p: AuthProvider | null) => sset('sweetwo.pending-provider', p),
  /** 앱 기기 기록용 설치 ID(이 기기에서 처음 만든 임의 값, 계정과 상관없이 유지) */
  installId: () => {
    const v = get('sweetwo.install-id');
    if (v) return v;
    const id = crypto.randomUUID();
    set('sweetwo.install-id', id);
    return id;
  },
  returnTo: () => sget('sweetwo.return-to'),
  setReturnTo: (path: string | null) => sset('sweetwo.return-to', path),
};
