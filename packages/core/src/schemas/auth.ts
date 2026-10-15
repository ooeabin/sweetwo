import { z } from 'zod';

// 로그인, 가입, 앱 잠금 규칙(docs/spec/15-login-signup.md A-02~A-06)

export const authProviders = ['kakao', 'google', 'apple'] as const;
export const AuthProvider = z.enum(authProviders);
export type AuthProvider = z.infer<typeof AuthProvider>;

/** 가입 때 동의하는 약관 버전. 웹사이트 L-05 약관이 바뀌면 함께 올린다. */
export const TERMS_VERSION = '2026-10-v1';

/** A-04: 공백 제거, 소문자. 형식 검사만(인증 메일 없음). */
export const normalizeEmail = (s: string) => s.replace(/\s+/g, '').toLowerCase();
export const NotifyEmail = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .max(254)
      .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/),
  );

/** login_state() 응답(서버 응답은 Zod로 검사) */
export const LoginState = z.discriminatedUnion('state', [
  z.object({ state: z.literal('new'), needs_email: z.boolean() }),
  z.object({ state: z.literal('provider_conflict'), provider: AuthProvider }),
  z.object({
    state: z.enum(['existing', 'deletion_requested']),
    provider: AuthProvider,
    onboarding_done: z.boolean(),
    onboarding_step: z.string().nullable(),
  }),
]);
export type LoginState = z.infer<typeof LoginState>;

/** complete_signup(), login_state()가 던지는 오류 이름 */
export const SignupError = z.enum([
  'already_signed_up',
  'provider_mismatch',
  'email_required',
  'terms_version_required',
]);
export type SignupError = z.infer<typeof SignupError>;

// A-06 앱 잠금 PIN
export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
/** 이 횟수 이상 틀리면 “{n}번 더 틀리면 다시 로그인해야 해요” */
export const PIN_WARN_FROM = 3;
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** 같은 숫자 6개, 연속 숫자(오름, 내림)는 쓸 수 없다. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = (s: number) => d.every((v, i) => i === 0 || v - (d[i - 1] ?? 0) === s);
  return step(1) || step(-1);
}
export const Pin = z
  .string()
  .regex(/^\d{6}$/)
  .refine((p) => !isWeakPin(p), { message: 'weak_pin' });

/** 남은 기회 안내(3회째 틀린 뒤부터). 안내가 필요 없으면 null. */
export function pinRemainingNotice(failedCount: number): number | null {
  if (failedCount < PIN_WARN_FROM) return null;
  return Math.max(PIN_MAX_ATTEMPTS - failedCount, 0);
}

// 웹 세션(A-02 ‘로그인 유지’, A-08)
export const WEB_KEEP_LOGIN_MS = 14 * 24 * 60 * 60 * 1000;
export const WEB_IDLE_LOCK_MS = 30 * 60 * 1000;
/** 데스크톱 브라우저 로그인 대기 상한(A-03) */
export const DESKTOP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
