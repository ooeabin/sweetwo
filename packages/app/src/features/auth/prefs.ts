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
  setLastProvider: (p: AuthProvider | null) => set('sweetwo.last-provider', p),
  /** 이 기기에서 마지막으로 로그인한 계정(사용자 ID). 다른 계정이 로그인하면 앞 계정 PIN을 지움(2026-11-10) */
  lastUser: () => get('sweetwo.last-user'),
  setLastUser: (id: string | null) => set('sweetwo.last-user', id),
  /** O-01은 첫 실행에만 */
  started: () => get('sweetwo.started') === '1',
  setStarted: () => set('sweetwo.started', '1'),
  /** 첫 실행 초대 코드 자동 입력(O-01 시트)은 이 기기에서 한 번만 물음(2026-11-13) */
  inviteAutofillChecked: () => get('sweetwo.invite-autofill') === '1',
  setInviteAutofillChecked: () => set('sweetwo.invite-autofill', '1'),
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
  /**
   * 로그인 전에 P-01 ‘합류하기’를 누른 초대 코드(이 기기, 앱을 다시 열어도 남음). 합류를 마치거나 코드가 막히면 지움.
   * 가입 도중 앱을 닫았다 열어도 시작한 사람 질문(O-11)이 아니라 합류로 이어 감(2026-11-14 재테스트 R2)
   */
  pendingInvite: () => {
    const v = get('sweetwo.pending-invite');
    return v && /^[A-HJ-NP-Z2-9]{6}$/.test(v) ? v : null;
  },
  setPendingInvite: (code: string | null) => set('sweetwo.pending-invite', code),
};
