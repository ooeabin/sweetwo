// sweetwo:// 링크 허용 목록(docs/DEV_GUIDE.md ‘데스크톱 로그인과 딥링크’). electron을 모르는 순수 함수라 Vitest로 검사한다.
// - sweetwo://auth/callback?code=…&state=… : code, state만 받는다
// - sweetwo://i/{code} : 초대
// 나머지는 모두 버린다(null).
export type DeepLink =
  { kind: 'auth'; code: string; state: string } | { kind: 'invite'; code: string };

const TOKEN = /^[A-Za-z0-9._~-]{1,512}$/;
const INVITE = /^[A-Za-z0-9]{4,32}$/;

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'sweetwo:') return null;
  const path = `${url.host}${url.pathname}`.replace(/\/+$/, '');
  if (path === 'auth/callback') {
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    return TOKEN.test(code) && TOKEN.test(state) ? { kind: 'auth', code, state } : null;
  }
  const m = /^i\/([^/]+)$/.exec(path);
  if (m?.[1] && INVITE.test(m[1])) return { kind: 'invite', code: m[1] };
  return null;
}

export const findDeepLink = (argv: readonly string[]) =>
  argv.find((a) => a.startsWith('sweetwo://'));
