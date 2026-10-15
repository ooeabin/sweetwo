import { createHash, randomBytes } from 'node:crypto';

// PKCE(RFC 7636). electron을 모르는 순수 함수라 Vitest로 검사한다.
export const base64url = (b: Buffer) => b.toString('base64url');
export const randomToken = (bytes = 32) => base64url(randomBytes(bytes));
export const challengeOf = (verifier: string) =>
  base64url(createHash('sha256').update(verifier).digest());

/** Supabase /authorize 주소. redirect_to는 웹 콜백 페이지(from=desktop, state를 실어 보냄). */
export function authorizeUrl(o: {
  supabaseUrl: string;
  webOrigin: string;
  provider: string;
  verifier: string;
  state: string;
}) {
  const redirect = new URL('/auth/callback', o.webOrigin);
  redirect.searchParams.set('from', 'desktop');
  redirect.searchParams.set('state', o.state);
  const u = new URL('/auth/v1/authorize', o.supabaseUrl);
  u.searchParams.set('provider', o.provider);
  u.searchParams.set('redirect_to', redirect.toString());
  u.searchParams.set('code_challenge', challengeOf(o.verifier));
  u.searchParams.set('code_challenge_method', 's256');
  return u.toString();
}
