import {
  LoginState,
  NotifyEmail,
  SignupError,
  TERMS_VERSION,
  type AuthProvider,
} from '@sweetwo/core';
import { supabase } from './client';

// 로그인과 가입 서버 호출(docs/spec/15-login-signup.md). 응답은 Zod로 검사.

export class AuthCallError extends Error {
  constructor(public readonly code: SignupError | 'network' | 'unknown') {
    super(code);
  }
}

const toError = (message: string | undefined) => {
  const parsed = SignupError.safeParse(message);
  if (parsed.success) return new AuthCallError(parsed.data);
  return new AuthCallError(message?.includes('fetch') ? 'network' : 'unknown');
};

/** 로그인 직후 어디로 갈지. provider는 방금 누른 버튼(재방문이면 생략). */
export async function fetchLoginState(provider?: AuthProvider): Promise<LoginState> {
  const { data, error } = await supabase().rpc(
    'login_state',
    provider ? { p_provider: provider } : {},
  );
  if (error) throw toError(error.message);
  return LoginState.parse(data);
}

/** A-05: 계정 생성 + 동의 기록 */
export async function completeSignup(input: {
  provider: AuthProvider;
  notifyEmail: string | null;
  marketing: boolean;
}) {
  const email = input.notifyEmail === null ? null : NotifyEmail.parse(input.notifyEmail);
  const { error } = await supabase().rpc('complete_signup', {
    p_provider: input.provider,
    p_notify_email: email ?? '', // 빈 값이면 소셜 이메일을 쓴다
    p_marketing: input.marketing,
    p_terms_version: TERMS_VERSION,
  });
  if (error) throw toError(error.message);
}

// 웹 전용 세션 동작(데스크톱은 main 프로세스가 한다)
export const webAuth = {
  /** 제공자 로그인 페이지로 이동(리다이렉트) */
  async start(provider: AuthProvider, redirectTo: string) {
    const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw toError(error.message);
  },
  async exchange(code: string) {
    const { error } = await supabase().auth.exchangeCodeForSession(code);
    if (error) throw toError(error.message);
  },
  async hasSession() {
    const { data } = await supabase().auth.getSession();
    return data.session !== null;
  },
  async signOut() {
    await supabase().auth.signOut({ scope: 'local' });
  },
};

/** A-01: 최소 지원 버전(로그인 전에도 읽을 수 있음) */
export async function fetchMinVersion(platform: 'desktop' | 'web'): Promise<string> {
  const { data, error } = await supabase()
    .from('app_config')
    .select('min_version_desktop, min_version_web')
    .eq('id', 1)
    .single();
  if (error) throw toError(error.message);
  return platform === 'desktop' ? data.min_version_desktop : data.min_version_web;
}
