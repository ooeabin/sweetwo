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

/** A-05r 약관 개정 재동의·마케팅 2년 재확인: 다시 물어볼 것(terms, privacy, marketing) */
export async function fetchPendingTerms(): Promise<{ kind: string; version: string }[]> {
  const { data, error } = await supabase().rpc('pending_terms');
  if (error) throw toError(error.message);
  return data ?? [];
}
/** 다시 동의(남은 필수 항목 모두 + 마케팅은 물어본 경우만) */
export async function agreeTerms(marketing: boolean | null) {
  const { error } = await supabase().rpc(
    'agree_terms',
    marketing === null ? {} : { p_marketing: marketing },
  );
  if (error) throw toError(error.message);
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

/** O-03: 소셜 로그인이 알려 준 이름(미리 채움, 최대 10자). 없으면 null */
export async function fetchSocialName(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  const m: Record<string, unknown> = data.session?.user.user_metadata ?? {};
  for (const k of ['name', 'full_name', 'nickname', 'preferred_username', 'user_name']) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return [...v.trim()].slice(0, 10).join('');
  }
  return null;
}

/** A-01: 최소 지원 버전과 점검 시간(AD-16, 로그인 전에도 읽을 수 있음) */
export async function fetchLaunchConfig(platform: 'desktop' | 'ios' | 'android' | 'web'): Promise<{
  min: string;
  maintenance: { starts: string; ends: string; message: string | null } | null;
}> {
  const { data, error } = await supabase()
    .from('app_config')
    .select(
      'min_version_desktop, min_version_web, min_version_ios, min_version_android, maintenance_starts_at, maintenance_ends_at, maintenance_message',
    )
    .eq('id', 1)
    .single();
  if (error) throw toError(error.message);
  return {
    min:
      platform === 'desktop'
        ? data.min_version_desktop
        : platform === 'ios'
          ? data.min_version_ios
          : platform === 'android'
            ? data.min_version_android
            : data.min_version_web,
    maintenance:
      data.maintenance_starts_at && data.maintenance_ends_at
        ? {
            starts: data.maintenance_starts_at,
            ends: data.maintenance_ends_at,
            message: data.maintenance_message ?? null,
          }
        : null,
  };
}
