import { fetchLoginState, noteDevice, noteLogin } from '@sweetwo/api';
import type { AuthProvider } from '@sweetwo/core';
import { track } from '../../shared/analytics';
import { copy } from './copy';
import { prefs } from './prefs';
import { session } from './session';
import { signOut } from './sign-out';
import { useAuthStore } from './store';

export const paths = {
  start: '/start', // O-01
  login: '/login', // A-02
  joinCode: '/i', // P-01 코드 직접 입력
  wait: '/login/wait', // A-03
  email: '/signup/email', // A-04
  terms: '/signup/terms', // A-05
  pinSetup: '/lock/setup', // A-06 설정
  expired: '/session-expired', // A-08
  newDevice: '/new-device', // A-08 새 기기 알림(/new-device/:session)
  reconsent: '/terms/update', // A-05r 약관 개정 재동의·마케팅 재확인
  callback: '/auth/callback',
  restore: '/account/restore', // A-02 ‘계정 삭제를 취소할까요?’
  home: '/', // 이번 달(온보딩이 생기면 멈춘 화면부터)
} as const;

/** A-02로 갈 때 넘기는 안내 */
/** notice: 버튼 위 띠(남아 있음). toast: true면 버튼 위 알약 토스트로 4초만(취소, 실패 같은 결과 안내). conflict: 가입한 방법 버튼에 말풍선 */
export type LoginNotice = { notice?: string; toast?: boolean; conflict?: AuthProvider };
/** A-02가 A-03에 넘겨 실패·취소 때 그대로 돌려받는 것(초대 문구, 뒤로, 진입, 2026-11-10) */
export type LoginEntryState = {
  fromStart?: boolean;
  entry?: 'first_run' | 'revisit' | 'invite' | 'session_expired';
  inviter?: string;
};

// A-03 대기 화면이 떠 있는지. 떠 있으면 로그인 결과는 A-03이 받고, 없으면(Android 뒤로로 나간 사이 로그인이 끝남) A-01이 받음
let waitOpen = false;
export const setWaitScreenOpen = (on: boolean) => {
  waitOpen = on;
};
export const isWaitScreenOpen = () => waitOpen;

/** 로그인이 끝난 뒤(또는 세션이 있는 재방문) 어디로 갈지. provider는 방금 누른 버튼. */
export async function routeAfterLogin(
  provider?: AuthProvider,
): Promise<{ to: string; state?: LoginNotice }> {
  const s = await fetchLoginState(provider);
  if (s.state === 'provider_conflict') {
    // 자동 합치기 없음: 이 로그인은 버리고 가입한 방법을 알려 준다
    await signOut();
    if (provider) track('login_failed', { method: provider, reason: 'email_conflict' });
    return {
      to: paths.login,
      state: { notice: copy.emailConflict(s.provider), conflict: s.provider },
    };
  }
  if (s.state === 'new') {
    // 실행(재방문) 때 가입을 끝내지 않은 세션이면 가입 취소로 보고 A-02부터(15 A-04 ‘뒤로·앱 종료: 가입 취소’, 2026-11-10).
    // 서버는 24시간 지난 미가입 계정을 지움(purge_abandoned_signups)
    if (!provider) {
      await signOut();
      return { to: paths.login };
    }
    await forgetOtherAccountPin();
    prefs.setLastProvider(provider);
    useAuthStore.getState().startSignup(provider);
    return { to: s.needs_email ? paths.email : paths.terms };
  }
  await forgetOtherAccountPin();
  if (provider) prefs.setLastProvider(provider);
  // 삭제 요청 30일 안 계정: “계정 삭제를 취소할까요?”
  if (s.state === 'deletion_requested') return { to: paths.restore };
  // existing: 다른 기기에 로그인돼 있으면 서버가 ‘새 기기에서 로그인했어요’ 알림·메일(15 A-08 4번)
  void noteLogin().catch(() => undefined);
  // 앱 기기 기록(AD-16). 웹(개발·e2e)은 기록 안 함
  const b = session.bridge;
  const pf = session.platform;
  if (b && pf !== 'web' && /^\d+\.\d+\.\d+$/.test(b.appVersion))
    void noteDevice(prefs.installId(), pf, b.appVersion).catch(() => undefined);
  if (session.bridge) {
    const lock = await session.bridge.lock.status();
    if (!lock.hasPin && !prefs.pinAsked()) return { to: paths.pinSetup };
  }
  const back = prefs.returnTo();
  prefs.setReturnTo(null);
  return { to: back ?? paths.home };
}

/** 이 기기에 앞 계정이 정한 PIN이 있으면 지움(다른 계정으로 로그인, 2026-11-10). 새 계정은 로그인 뒤 PIN을 새로 정함 */
async function forgetOtherAccountPin() {
  const uid = await session.userId().catch(() => null);
  if (!uid) return;
  const prev = prefs.lastUser();
  if (prev && prev !== uid) {
    await session.bridge?.lock.reset?.().catch(() => undefined);
    prefs.setPinAsked(false);
    // 앞 계정이 하던 화면(만료 뒤 돌아갈 곳)은 버림. 초대 링크(P-01)로 돌아가는 길은 계정과 상관없어 남김
    if (!prefs.returnTo()?.startsWith('/i/')) prefs.setReturnTo(null);
  }
  prefs.setLastUser(uid);
}
