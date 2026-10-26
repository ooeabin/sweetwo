// 앱으로 들어오는 링크 허용 목록(DEV_GUIDE ‘데스크톱 로그인과 딥링크’, ‘모바일 세션’). 데스크톱 main과 모바일 브리지가 같이 씀.
// - sweetwo://auth/callback?code=…&state=… : code, state만 받는다
// - sweetwo://auth/callback?error=…&state=… : 브라우저에서 취소, 동의 거부(error는 영문 소문자와 _만)
// - sweetwo://i/{code} : 초대
// - sweetwo://n, sweetwo://n/settings : 알림 메일 링크(알림 센터, 알림 설정). 정한 화면만
// - 모바일 앱 링크: https://sweetwo.kr/i/{code}, /n, /n/settings(같은 규칙. 로그인 콜백은 sweetwo://로만)
// 나머지는 모두 버린다(null).
export type DeepLink =
  | { kind: 'auth'; code: string; state: string }
  | { kind: 'auth_error'; error: string; state: string }
  | { kind: 'invite'; code: string }
  | { kind: 'open'; path: string };

/** 알림 메일 링크(sweetwo.kr/n…) → 앱 화면. 여기 없는 것은 버림 */
const OPEN: Record<string, string> = {
  n: '/notifications',
  'n/settings': '/settings/notifications',
};

const TOKEN = /^[A-Za-z0-9._~-]{1,512}$/;
const INVITE = /^[A-Za-z0-9]{4,32}$/;
const ERROR = /^[a-z_]{1,64}$/;
/** 앱 링크로 받는 웹사이트(운영). 개발·스테이징은 sweetwo:// 링크만 */
export const APP_LINK_HOSTS = ['sweetwo.kr', 'www.sweetwo.kr'] as const;

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  let path: string;
  if (url.protocol === 'sweetwo:') {
    path = `${url.host}${url.pathname}`.replace(/\/+$/, '').replace(/^\/+/, '');
  } else if (
    url.protocol === 'https:' &&
    (APP_LINK_HOSTS as readonly string[]).includes(url.hostname) &&
    !url.port
  ) {
    path = url.pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    if (path === 'auth/callback') return null;
  } else {
    return null;
  }
  if (path === 'auth/callback') {
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const error = url.searchParams.get('error') ?? '';
    if (!TOKEN.test(state)) return null;
    if (error) return ERROR.test(error) ? { kind: 'auth_error', error, state } : null;
    return TOKEN.test(code) ? { kind: 'auth', code, state } : null;
  }
  const open = OPEN[path];
  if (open && !url.search) return { kind: 'open', path: open };
  const m = /^i\/([^/]+)$/.exec(path);
  if (m?.[1] && INVITE.test(m[1])) return { kind: 'invite', code: m[1] };
  return null;
}

export const findDeepLink = (argv: readonly string[]) =>
  argv.find((a) => a.startsWith('sweetwo://'));
