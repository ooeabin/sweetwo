// 소셜 계정 프로필 사진 받기(2026-11-05, 25 S-11e ‘처음 사진’). 앱이 우리 둘 공간이 생긴 뒤 한 번만 부름.
// 1) 앱 사용자 JWT로 Auth에서 내 계정을 읽음(사진 주소는 요청 본문이 아니라 로그인 제공자가 준 identity_data에서만)
// 2) 카카오·구글이고 사진이 있으면 허용한 주소(googleusercontent.com, kakaocdn.net)에서만 받음
// 3) 그림이면 바이트를 그대로 돌려줌(supabase-js functions.invoke가 Blob으로 받게 application/octet-stream, 앱이 512px 정사각 JPEG로 다시 그려 EXIF를 없애고 내 저장소에 저장). 없거나 못 받으면 204
// 원본 주소와 그림은 서버에 남기지 않음.
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export type Env = Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
>;

const HOSTS = ['.googleusercontent.com', '.kakaocdn.net'];
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 5 * 1024 * 1024;

interface Identity {
  provider?: string;
  identity_data?: Record<string, unknown>;
}

const allowed = (u: URL) =>
  u.protocol === 'https:' &&
  HOSTS.some((h) => u.hostname.endsWith(h) && u.hostname.length > h.length);

/** 제공자가 준 사진 주소 → 받을 주소(없거나 기본 사진이면 null) */
export function pictureUrl(identities: Identity[]): string | null {
  for (const provider of ['kakao', 'google']) {
    const d = identities.find((i) => i.provider === provider)?.identity_data ?? {};
    const raw = [d.avatar_url, d.picture].find(
      (v): v is string => typeof v === 'string' && !!v.trim(),
    );
    if (!raw) continue;
    let u: URL;
    try {
      // 카카오는 http 주소를 줄 때가 있음
      u = new URL(raw.trim().replace(/^http:\/\//, 'https://'));
    } catch {
      continue;
    }
    if (!allowed(u)) continue;
    // 카카오 기본 프로필(사람 모양)은 사진이 없는 것으로 봄
    if (provider === 'kakao' && /default_profile/i.test(u.href)) continue;
    // 구글은 끝의 크기(=s96-c)를 512 정사각으로
    if (provider === 'google') u = new URL(u.href.replace(/=s\d+(-c)?$/, '=s512-c'));
    return u.href;
  }
  return null;
}

// 앱(모바일 웹뷰, 개발 브라우저)에서 바로 부르므로 CORS
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: BodyInit | null, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...CORS, ...headers } });
const none = () => reply(null, 204);

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  if (req.method === 'OPTIONS') return reply('ok', 200);
  if (req.method !== 'POST') return reply('method', 405);
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth)) return reply('unauthorized', 401);
  const key = serverKey(env);
  if (!key) return reply('no key', 500);
  const me = await fetchFn(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: key, Authorization: auth },
  });
  if (!me.ok) return reply('unauthorized', 401);
  const user = (await me.json()) as { identities?: Identity[] };
  const url = pictureUrl(user.identities ?? []);
  if (!url) return none();
  try {
    const res = await fetchFn(url, { redirect: 'follow' });
    if (!res.ok || (res.url && !allowed(new URL(res.url)))) return none();
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!TYPES.includes(type)) return none();
    if (Number(res.headers.get('content-length') ?? '0') > MAX_BYTES) return none();
    const body = new Uint8Array(await res.arrayBuffer());
    if (!body.length || body.length > MAX_BYTES) return none();
    return reply(body, 200, {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
  } catch {
    return none();
  }
}
