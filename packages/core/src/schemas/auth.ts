import { z } from 'zod';

// 로그인, 가입, 앱 잠금 규칙(docs/spec/15-login-signup.md A-02~A-06)

export const authProviders = ['kakao', 'google', 'apple'] as const;
export const AuthProvider = z.enum(authProviders);
export type AuthProvider = z.infer<typeof AuthProvider>;

/**
 * 가입 때 동의하는 문서 버전(앱이 보여 주는 원본과 같게). 웹사이트 L-05 약관(apps/site/src/content/terms·privacy)과
 * 동의 문서(apps/site/src/content/consents)의 frontmatter version과 맞춘다. 이용약관·개인정보는 서버가 AD-15에서 승인돼
 * 시행 중인 버전이 있으면 그것을 기록하고(S1-17), 없을 때만 이 값.
 */
export const CONSENT_VERSIONS = {
  terms: 'v2',
  privacy: 'v1',
  space_sharing: 'v1',
  marketing: 'v1',
} as const;
/** 예전 이름(설정 S-14 마케팅 기록 등). 이용약관 버전과 같음 */
export const TERMS_VERSION = CONSENT_VERSIONS.terms;

/** A-04: 앞뒤 공백만 지우고 소문자. 가운데 공백은 말없이 지우지 않고 형식 오류로(2026-11-10). */
export const normalizeEmail = (s: string) => s.trim().toLowerCase();
/** 이메일 주소 최대 길이(RFC 5321) */
export const EMAIL_MAX = 254;
// 로컬 부분: 흔히 쓰는 글자, 점은 처음·끝·연속 불가. 도메인: 글자·숫자·하이픈 이름을 점으로, 끝은 2자 이상 영문(또는 xn--)
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
/** 형식 검사만(인증 메일 없음). a@b.c, a@b..com, 안쪽 공백, 64자 넘는 앞부분은 거부 */
export const isEmail = (s: string) =>
  s.length <= EMAIL_MAX && EMAIL_RE.test(s) && (s.split('@')[0] ?? '').length <= 64;
export const NotifyEmail = z.string().transform(normalizeEmail).pipe(z.string().refine(isEmail));

// 흔한 도메인 오타(A-04 “혹시 …인가요?”). 형식은 맞아도 거의 틀림없는 오타만
const DOMAIN_TYPO: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'naver.co': 'naver.com',
  'naver.cm': 'naver.com',
  'navr.com': 'naver.com',
  'naer.com': 'naver.com',
  'nvaer.com': 'naver.com',
  'daum.ent': 'daum.net',
  'daum.nte': 'daum.net',
  'duam.net': 'daum.net',
  'hanmail.ent': 'hanmail.net',
  'hanmail.nte': 'hanmail.net',
  'hanmial.net': 'hanmail.net',
  'hanmail.com': 'hanmail.net',
  'kakao.co': 'kakao.com',
  'nate.co': 'nate.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
};
/** 도메인 오타면 고친 주소, 아니면 null. ‘.con’, ‘.cmo’로 끝나면 ‘.com’ */
export function emailTypoSuggestion(raw: string): string | null {
  const e = normalizeEmail(raw);
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const fixed =
    DOMAIN_TYPO[domain] ??
    (/\.(con|cmo|ocm|vom)$/.test(domain) ? domain.replace(/\.[a-z]+$/, '.com') : null);
  if (!fixed || fixed === domain) return null;
  const next = `${local}@${fixed}`;
  return isEmail(next) ? next : null;
}

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

/**
 * 약한 PIN(A-06 2번, 2026-11-10 넓힘): 같은 숫자 6개, 이어지는 숫자(오름·내림, 9 다음 0으로 도는 것 포함: 890123, 210987),
 * 두 개씩 3번(112233), 두 숫자 번갈아(121212).
 */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  const d = [...pin].map(Number);
  const at = (i: number) => d[i] ?? 0;
  if (d.every((v) => v === d[0])) return true;
  const step = (s: number) => d.every((v, i) => i === 0 || (v - at(i - 1) + 10) % 10 === s);
  if (step(1) || step(9)) return true;
  if (at(0) === at(1) && at(2) === at(3) && at(4) === at(5)) return true;
  return d.every((v, i) => i < 2 || v === at(i - 2));
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

/** 로그인 창 대기 상한(A-03) */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
