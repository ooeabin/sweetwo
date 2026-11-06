import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, MAX_BYTES, pictureUrl, type Env } from './handler.ts';

const env: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
};
const req = (token = 'user-jwt', method = 'POST') =>
  new Request('https://fn/social-avatar', {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
const kakao = (avatar_url: string) => [{ provider: 'kakao', identity_data: { avatar_url } }];

function fake(
  identities: unknown[],
  pic: Response = new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/jpeg' },
  }),
  log: string[] = [],
) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push(url);
    if (url.endsWith('/auth/v1/user')) {
      const h = new Headers(init?.headers);
      if (h.get('authorization') !== 'Bearer user-jwt') return new Response('no', { status: 401 });
      return Response.json({ identities });
    }
    return pic;
  }) as typeof fetch;
}

Deno.test('주소 고르기: 카카오 http는 https로, 기본 프로필은 없음, 구글은 512', () => {
  strictEqual(
    pictureUrl(kakao('http://k.kakaocdn.net/dn/abc/img_640x640.jpg')),
    'https://k.kakaocdn.net/dn/abc/img_640x640.jpg',
  );
  strictEqual(
    pictureUrl(
      kakao(
        'http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=http://t1.kakaocdn.net/account_images/default_profile.jpeg',
      ),
    ),
    null,
  );
  strictEqual(
    pictureUrl([
      {
        provider: 'google',
        identity_data: { picture: 'https://lh3.googleusercontent.com/a/xyz=s96-c' },
      },
    ]),
    'https://lh3.googleusercontent.com/a/xyz=s512-c',
  );
  strictEqual(
    pictureUrl([
      { provider: 'apple', identity_data: { avatar_url: 'https://lh3.googleusercontent.com/a' } },
    ]),
    null,
  );
  strictEqual(pictureUrl(kakao('https://evil.example.com/a.jpg')), null);
  strictEqual(pictureUrl(kakao('https://kakaocdn.net.evil.com/a.jpg')), null);
  strictEqual(pictureUrl([]), null);
});

Deno.test('로그인 안 했으면 401, 다른 메서드는 405, OPTIONS는 CORS', async () => {
  strictEqual((await handle(req(''), env, fake([]))).status, 401);
  strictEqual((await handle(req('other'), env, fake([]))).status, 401);
  strictEqual((await handle(req('user-jwt', 'GET'), env, fake([]))).status, 405);
  const o = await handle(req('', 'OPTIONS'), env, fake([]));
  strictEqual(o.status, 200);
  strictEqual(o.headers.get('access-control-allow-origin'), '*');
});

Deno.test('사진이 있으면 그림을 그대로 돌려줌', async () => {
  const log: string[] = [];
  const res = await handle(
    req(),
    env,
    fake(kakao('https://k.kakaocdn.net/dn/a.jpg'), undefined, log),
  );
  strictEqual(res.status, 200);
  strictEqual(res.headers.get('content-type'), 'application/octet-stream');
  deepStrictEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3]);
  deepStrictEqual(log, ['https://x.supabase.co/auth/v1/user', 'https://k.kakaocdn.net/dn/a.jpg']);
});

Deno.test('사진이 없거나, 그림이 아니거나, 너무 크거나, 못 받으면 204', async () => {
  strictEqual(
    (await handle(req(), env, fake([{ provider: 'kakao', identity_data: {} }]))).status,
    204,
  );
  const html = new Response('<html>', { headers: { 'content-type': 'text/html' } });
  strictEqual(
    (await handle(req(), env, fake(kakao('https://k.kakaocdn.net/a'), html))).status,
    204,
  );
  const big = new Response(new Uint8Array(1), {
    headers: { 'content-type': 'image/png', 'content-length': String(MAX_BYTES + 1) },
  });
  strictEqual((await handle(req(), env, fake(kakao('https://k.kakaocdn.net/a'), big))).status, 204);
  strictEqual(
    (
      await handle(
        req(),
        env,
        fake(kakao('https://k.kakaocdn.net/a'), new Response('x', { status: 404 })),
      )
    ).status,
    204,
  );
});
