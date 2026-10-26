import { fetchLoginState, noteLogin } from '@sweetwo/api';
import type { AuthProvider } from '@sweetwo/core';
import { track } from '../../shared/analytics';
import { copy } from './copy';
import { prefs } from './prefs';
import { session } from './session';
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
export type LoginNotice = { notice?: string; conflict?: AuthProvider };

/** 로그인이 끝난 뒤(또는 세션이 있는 재방문) 어디로 갈지. provider는 방금 누른 버튼. */
export async function routeAfterLogin(
  provider?: AuthProvider,
): Promise<{ to: string; state?: LoginNotice }> {
  const s = await fetchLoginState(provider);
  if (s.state === 'provider_conflict') {
    // 자동 합치기 없음: 이 로그인은 버리고 가입한 방법을 알려 준다
    await session.signOut();
    if (provider) track('login_failed', { method: provider, reason: 'email_conflict' });
    return {
      to: paths.login,
      state: { notice: copy.emailConflict(s.provider), conflict: s.provider },
    };
  }
  if (provider) prefs.setLastProvider(provider);
  if (s.state === 'new') {
    const p = provider ?? prefs.lastProvider();
    if (!p) {
      await session.signOut();
      return { to: paths.login, state: { notice: copy.relogin } };
    }
    useAuthStore.getState().startSignup(p);
    return { to: s.needs_email ? paths.email : paths.terms };
  }
  // 삭제 요청 30일 안 계정: “계정 삭제를 취소할까요?”
  if (s.state === 'deletion_requested') return { to: paths.restore };
  // existing: 다른 기기에 로그인돼 있으면 서버가 ‘새 기기에서 로그인했어요’ 알림·메일(15 A-08 4번)
  void noteLogin().catch(() => undefined);
  if (session.bridge) {
    const lock = await session.bridge.lock.status();
    if (!lock.hasPin && !prefs.pinAsked()) return { to: paths.pinSetup };
  }
  const back = prefs.returnTo();
  prefs.setReturnTo(null);
  return { to: back ?? paths.home };
}
