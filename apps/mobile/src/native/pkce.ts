// PKCE(RFC 7636) 웹뷰용(WebCrypto). 데스크톱 apps/desktop/src/main/pkce.ts와 같은 값을 만든다.
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function challengeOf(verifier: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(d));
}

/** Supabase /authorize 주소. redirect_to는 웹 콜백 페이지(from=app, state를 실어 보냄). */
export async function authorizeUrl(o: {
  supabaseUrl: string;
  webOrigin: string;
  provider: string;
  verifier: string;
  state: string;
}) {
  const redirect = new URL('/auth/callback', o.webOrigin);
  redirect.searchParams.set('from', 'app');
  redirect.searchParams.set('state', o.state);
  const u = new URL('/auth/v1/authorize', o.supabaseUrl);
  u.searchParams.set('provider', o.provider);
  u.searchParams.set('redirect_to', redirect.toString());
  u.searchParams.set('code_challenge', await challengeOf(o.verifier));
  u.searchParams.set('code_challenge_method', 's256');
  return u.toString();
}
