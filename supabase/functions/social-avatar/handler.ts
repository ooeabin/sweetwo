// 소셜 계정 프로필 사진 받기(2026-11-05, 25 S-11e ‘처음 사진’, 2026-11-18 직접 지정한 사진만). 앱이 우리 둘 공간이 생긴 뒤 한 번만 부름.
// 1) 앱 사용자 JWT로 내 계정을 읽음. 이미 사진이 있거나(올림, 지움 포함) 한 번 시도했으면 건드리지 않고 204
// 2) 앱이 로그인 직후 받은 제공자 토큰(provider_token, 본문 {provider, token})으로 제공자 API를 불러 확인(비밀 값 없음, 사용자 토큰만)
//    - 구글: People API people/me?personFields=photos 의 대표 사진(metadata.primary)이 default: true면 기본 이미지
//    - 카카오: /v2/user/me 의 kakao_account.profile.is_default_image
//    기본 이미지(구글 글자 원, 카카오 기본 이미지)면 받지 않고 204(앱은 우리 글자 아바타). 직접 지정한 사진만 허용한 주소에서 받음
// 3) 그림이면 바이트를 그대로 돌려줌(supabase-js functions.invoke가 Blob으로 받게 application/octet-stream, 앱이 512px 정사각 JPEG로 다시 그려 EXIF를 없애고 내 저장소에 저장). 없거나 못 받으면 204
// 원본 주소, 제공자 토큰, 그림은 서버에 남기지 않음. user_metadata·identity_data의 사진 주소는 읽지 않음.
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export type Env = Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
>;

const HOSTS = ['.googleusercontent.com', '.kakaocdn.net'];
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 5 * 1024 * 1024;
export type Provider = 'google' | 'kakao';
const GOOGLE_API = 'https://people.googleapis.com/v1/people/me?personFields=photos';
const KAKAO_API = 'https://kapi.kakao.com/v2/user/me';

const allowed = (u: URL) =>
  u.protocol === 'https:' &&
  HOSTS.some((h) => u.hostname.endsWith(h) && u.hostname.length > h.length);

const toUrl = (raw: unknown, provider: Provider): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u: URL;
  try {
    // 카카오는 http 주소를 줄 때가 있음
    u = new URL(raw.trim().replace(/^http:\/\//, 'https://'));
  } catch {
    return null;
  }
  if (!allowed(u)) return null;
  // 구글은 끝의 크기(=s100, =s96-c)를 512 정사각으로
  if (provider === 'google') u = new URL(u.href.replace(/=s\d+(-c)?$/, '=s512-c'));
  return u.href;
};

interface GooglePhoto {
  url?: string;
  default?: boolean | null;
  metadata?: { primary?: boolean; source?: { type?: string } };
}

/** 제공자 응답 → 직접 지정한 사진 주소(기본 이미지거나 없으면 null). 구글은 false를 응답에서 빼므로 default가 true일 때만 기본 이미지 */
export function pickPhoto(provider: Provider, body: unknown): string | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (provider === 'google') {
    const photos = Array.isArray(b.photos) ? (b.photos as GooglePhoto[]) : [];
    const main =
      photos.find((p) => p.metadata?.primary) ??
      photos.find((p) => p.metadata?.source?.type === 'PROFILE');
    if (!main || main.default === true) return null;
    return toUrl(main.url, 'google');
  }
  const account = (b.kakao_account ?? {}) as Record<string, unknown>;
  const profile = (account.profile ?? {}) as Record<string, unknown>;
  // 동의하지 않았거나(profile_image_needs_agreement) 기본 이미지면 없음. 값이 분명한 false일 때만 지정한 사진
  if (account.profile_image_needs_agreement === true || account.profile_needs_agreement === true)
    return null;
  if (profile.is_default_image !== false) return null;
  return toUrl(profile.profile_image_url, 'kakao');
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
  const user = (await me.json()) as { id?: string; identities?: { provider?: string }[] };
  let input: { provider?: unknown; token?: unknown } = {};
  try {
    input = (await req.json()) as typeof input;
  } catch {
    return none();
  }
  const provider = input.provider;
  const token = input.token;
  if ((provider !== 'google' && provider !== 'kakao') || typeof token !== 'string' || !token)
    return none();
  // 내 계정으로 가입한 제공자의 토큰일 때만
  if (!(user.identities ?? []).some((i) => i.provider === provider)) return none();
  try {
    // 이미 사진이 있거나(올림, 지움 포함) 한 번 시도했으면 건드리지 않음
    const row = await fetchFn(
      `${env.SUPABASE_URL}/rest/v1/app_user?select=avatar_path,avatar_social_checked_at&id=eq.${encodeURIComponent(user.id ?? '')}`,
      { headers: { apikey: key, Authorization: auth } },
    );
    if (!row.ok) return none();
    const [mine] = (await row.json()) as {
      avatar_path: string | null;
      avatar_social_checked_at: string | null;
    }[];
    if (!mine || mine.avatar_path || mine.avatar_social_checked_at) return none();
    const info = await fetchFn(provider === 'google' ? GOOGLE_API : KAKAO_API, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!info.ok) return none();
    const url = pickPhoto(provider, await info.json());
    if (!url) return none();
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
