import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, MAX_BYTES, pickPhoto, type Env } from './handler.ts';

const env: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
};
const req = (
  body: unknown = { provider: 'google', token: 'g-token' },
  jwt = 'user-jwt',
  method = 'POST',
) =>
  new Request('https://fn/social-avatar', {
    method,
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

const GOOGLE_PHOTO = 'https://lh3.googleusercontent.com/a/xyz=s100';
const KAKAO_PHOTO = 'http://k.kakaocdn.net/dn/abc/img_640x640.jpg';
const google = (photo: Record<string, unknown> = {}) => ({
  photos: [
    { metadata: { primary: true, source: { type: 'PROFILE' } }, url: GOOGLE_PHOTO, ...photo },
  ],
});
const kakao = (profile: Record<string, unknown> = {}, account: Record<string, unknown> = {}) => ({
  kakao_account: {
    profile: { profile_image_url: KAKAO_PHOTO, is_default_image: false, ...profile },
    ...account,
  },
});

interface Opt {
  provider?: string;
  mine?: { avatar_path: string | null; avatar_social_checked_at: string | null };
  api?: unknown;
  apiStatus?: number;
  pic?: Response;
  log?: string[];
}
function fake(o: Opt = {}) {
  const log = o.log ?? [];
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push(url);
    const h = new Headers(init?.headers);
    if (url.endsWith('/auth/v1/user')) {
      if (h.get('authorization') !== 'Bearer user-jwt') return new Response('no', { status: 401 });
      return Response.json({ id: 'u1', identities: [{ provider: o.provider ?? 'google' }] });
    }
    if (url.includes('/rest/v1/app_user'))
      return Response.json([o.mine ?? { avatar_path: null, avatar_social_checked_at: null }]);
    if (
      url.startsWith('https://people.googleapis.com/') ||
      url.startsWith('https://kapi.kakao.com/')
    ) {
      strictEqual(h.get('authorization'), 'Bearer g-token');
      return o.apiStatus && o.apiStatus !== 200
        ? new Response('x', { status: o.apiStatus })
        : Response.json(o.api ?? google());
    }
    return (
      o.pic ??
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
    );
  }) as typeof fetch;
}

Deno.test('구글: 직접 지정한 사진만 주소로(default가 true면 기본 이미지), 크기는 512', () => {
  strictEqual(pickPhoto('google', google()), 'https://lh3.googleusercontent.com/a/xyz=s512-c');
  strictEqual(
    pickPhoto('google', google({ default: false })),
    'https://lh3.googleusercontent.com/a/xyz=s512-c',
  );
  strictEqual(pickPhoto('google', google({ default: true })), null);
  strictEqual(pickPhoto('google', {}), null);
  strictEqual(pickPhoto('google', { photos: [] }), null);
  strictEqual(pickPhoto('google', google({ url: 'https://evil.example.com/a.jpg' })), null);
  // 대표 사진이 기본 이미지면 다른 사진이 있어도 기본으로 봄
  strictEqual(
    pickPhoto('google', {
      photos: [
        { metadata: { primary: true }, url: GOOGLE_PHOTO, default: true },
        { metadata: {}, url: 'https://lh3.googleusercontent.com/b' },
      ],
    }),
    null,
  );
});

Deno.test('카카오: is_default_image가 false일 때만, http는 https로', () => {
  strictEqual(pickPhoto('kakao', kakao()), 'https://k.kakaocdn.net/dn/abc/img_640x640.jpg');
  strictEqual(pickPhoto('kakao', kakao({ is_default_image: true })), null);
  strictEqual(pickPhoto('kakao', kakao({ is_default_image: undefined })), null);
  strictEqual(pickPhoto('kakao', kakao({}, { profile_image_needs_agreement: true })), null);
  strictEqual(
    pickPhoto('kakao', kakao({ profile_image_url: 'https://kakaocdn.net.evil.com/a.jpg' })),
    null,
  );
  strictEqual(pickPhoto('kakao', {}), null);
});

Deno.test('로그인 안 했으면 401, 다른 메서드는 405, OPTIONS는 CORS', async () => {
  strictEqual((await handle(req(undefined, ''), env, fake())).status, 401);
  strictEqual((await handle(req(undefined, 'other'), env, fake())).status, 401);
  strictEqual((await handle(req(undefined, 'user-jwt', 'GET'), env, fake())).status, 405);
  const o = await handle(req(undefined, '', 'OPTIONS'), env, fake());
  strictEqual(o.status, 200);
  strictEqual(o.headers.get('access-control-allow-origin'), '*');
});

Deno.test('직접 지정한 사진이면 그림을 그대로 돌려줌(제공자 API는 사용자 토큰으로)', async () => {
  const log: string[] = [];
  const res = await handle(req(), env, fake({ log }));
  strictEqual(res.status, 200);
  strictEqual(res.headers.get('content-type'), 'application/octet-stream');
  deepStrictEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3]);
  strictEqual(
    log[log.length - 2],
    'https://people.googleapis.com/v1/people/me?personFields=photos',
  );
  strictEqual(log[log.length - 1], 'https://lh3.googleusercontent.com/a/xyz=s512-c');

  const k = await handle(
    req({ provider: 'kakao', token: 'g-token' }),
    env,
    fake({ provider: 'kakao', api: kakao() }),
  );
  strictEqual(k.status, 200);
});

Deno.test('기본 이미지면 저장할 그림을 주지 않음(204, 그림 주소도 부르지 않음)', async () => {
  const log: string[] = [];
  strictEqual(
    (await handle(req(), env, fake({ api: google({ default: true }), log }))).status,
    204,
  );
  strictEqual(
    log.some((u) => u.includes('googleusercontent')),
    false,
  );
  const k = await handle(
    req({ provider: 'kakao', token: 'g-token' }),
    env,
    fake({ provider: 'kakao', api: kakao({ is_default_image: true }) }),
  );
  strictEqual(k.status, 204);
});

Deno.test('이미 사진을 올렸거나 지운 적이 있거나 시도한 사람은 건드리지 않음', async () => {
  for (const mine of [
    { avatar_path: 'a/b.jpg', avatar_social_checked_at: null },
    { avatar_path: null, avatar_social_checked_at: '2026-11-18T00:00:00Z' },
  ]) {
    const log: string[] = [];
    strictEqual((await handle(req(), env, fake({ mine, log }))).status, 204);
    strictEqual(
      log.some((u) => u.includes('people.googleapis.com')),
      false,
    );
  }
});

Deno.test('토큰이 없거나 제공자가 다르거나 API가 실패하면 204', async () => {
  strictEqual((await handle(req({ provider: 'google' }), env, fake())).status, 204);
  strictEqual((await handle(req({ provider: 'apple', token: 't' }), env, fake())).status, 204);
  strictEqual(
    (await handle(req({ provider: 'kakao', token: 't' }), env, fake({ provider: 'google' })))
      .status,
    204,
  );
  strictEqual((await handle(req(), env, fake({ apiStatus: 401 }))).status, 204);
});

Deno.test('그림이 아니거나, 너무 크거나, 못 받으면 204', async () => {
  const html = new Response('<html>', { headers: { 'content-type': 'text/html' } });
  strictEqual((await handle(req(), env, fake({ pic: html }))).status, 204);
  const big = new Response(new Uint8Array(1), {
    headers: { 'content-type': 'image/png', 'content-length': String(MAX_BYTES + 1) },
  });
  strictEqual((await handle(req(), env, fake({ pic: big }))).status, 204);
  strictEqual(
    (await handle(req(), env, fake({ pic: new Response('x', { status: 404 }) }))).status,
    204,
  );
});
