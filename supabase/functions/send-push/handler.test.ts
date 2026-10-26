import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, type Env } from './handler.ts';

// 시험용 키(실행할 때마다 새로 만듦)
async function pem(alg: 'EC' | 'RSA') {
  const pair = (await crypto.subtle.generateKey(
    alg === 'EC'
      ? { name: 'ECDSA', namedCurve: 'P-256' }
      : {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  return {
    pem: `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`,
    pub: pair.publicKey,
  };
}

const rows = [
  {
    notification_id: 'n1',
    title: '월급날',
    body: '체크해 주세요',
    target: '/salary',
    platform: 'ios',
    token: 'apns-1',
  },
  {
    notification_id: 'n1',
    title: '월급날',
    body: '체크해 주세요',
    target: '/salary',
    platform: 'android',
    token: 'fcm-1',
  },
  {
    notification_id: 'n2',
    title: '깜짝',
    body: null,
    target: '/calendar',
    platform: 'ios',
    token: 'apns-gone',
  },
];
type Log = { url: string; headers: Record<string, string>; body: string };

function fakeFetch(log: Log[]) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push({
      url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: String(init?.body ?? ''),
    });
    if (url.endsWith('/rpc/claim_push')) return Response.json(rows);
    if (url.endsWith('/rpc/drop_push_tokens')) return new Response('1');
    if (url.startsWith('https://oauth2.googleapis.com/token'))
      return Response.json({ access_token: 'ya29.x', expires_in: 3600 });
    if (url.includes('/3/device/apns-gone')) return new Response(null, { status: 410 });
    if (url.startsWith('https://api.sandbox.push.apple.com/3/device/')) return new Response(null);
    if (url.startsWith('https://fcm.googleapis.com/')) return Response.json({ name: 'x' });
    return new Response('no', { status: 500 });
  }) as typeof fetch;
}

const base: Env = {
  SUPABASE_URL: 'http://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'svc',
  PUSH_CRON_SECRET: 's3',
};
const req = (secret = 's3') => new Request('http://f', { headers: { 'x-push-secret': secret } });

Deno.test('비밀 값이 다르면 거절', async () => {
  const log: Log[] = [];
  strictEqual((await handle(req('x'), base, fakeFetch(log))).status, 403);
  strictEqual(log.length, 0);
});

Deno.test('log 드라이버: 꺼내기만 하고 보내지 않음', async () => {
  const log: Log[] = [];
  const res = await handle(req(), base, fakeFetch(log));
  deepStrictEqual(await res.json(), { claimed: 3, sent: 3, dropped: 0 });
  deepStrictEqual(
    log.map((l) => l.url),
    ['http://db.test/rest/v1/rpc/claim_push'],
  );
});

Deno.test(
  'send: iOS는 APNs(ES256 토큰), Android는 FCM(서비스 계정), 410이면 토큰 지움',
  async () => {
    const ec = await pem('EC');
    const rsa = await pem('RSA');
    const env: Env = {
      ...base,
      PUSH_DRIVER: 'send',
      APNS_KEY_ID: 'KEY123',
      APNS_TEAM_ID: 'TEAM456',
      APNS_PRIVATE_KEY: ec.pem,
      APNS_ENV: 'sandbox',
      FCM_SERVICE_ACCOUNT: JSON.stringify({
        project_id: 'sweetwo-test',
        client_email: 'push@sweetwo-test.iam.gserviceaccount.com',
        private_key: rsa.pem,
      }),
    };
    const log: Log[] = [];
    const res = await handle(req(), env, fakeFetch(log));
    deepStrictEqual(await res.json(), { claimed: 3, sent: 2, dropped: 1 });

    const apns = log.find((l) => l.url.endsWith('/3/device/apns-1'));
    strictEqual(apns?.headers['apns-topic'], 'kr.sweetwo.app');
    strictEqual(apns?.headers['apns-push-type'], 'alert');
    deepStrictEqual(JSON.parse(apns?.body ?? '{}'), {
      aps: { alert: { title: '월급날', body: '체크해 주세요' }, sound: 'default' },
      target: '/salary',
      id: 'n1',
    });
    // APNs JWT: 헤더 kid, iss = 팀 ID, ES256 서명이 공개 키로 맞음
    const jwt = (apns?.headers.authorization ?? '').replace('bearer ', '');
    const [h, c, s] = jwt.split('.');
    const dec = (x: string) => JSON.parse(atob(x.replace(/-/g, '+').replace(/_/g, '/')));
    strictEqual(dec(h ?? '').kid, 'KEY123');
    strictEqual(dec(c ?? '').iss, 'TEAM456');
    const sig = Uint8Array.from(atob((s ?? '').replace(/-/g, '+').replace(/_/g, '/')), (x) =>
      x.charCodeAt(0),
    );
    strictEqual(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        ec.pub,
        sig,
        new TextEncoder().encode(`${h}.${c}`),
      ),
      true,
    );

    const fcm = log.find(
      (l) => l.url === 'https://fcm.googleapis.com/v1/projects/sweetwo-test/messages:send',
    );
    strictEqual(fcm?.headers.authorization, 'Bearer ya29.x');
    deepStrictEqual(JSON.parse(fcm?.body ?? '{}').message.data, { target: '/salary', id: 'n1' });
    // 숨긴 본문(서프라이즈)은 제목만
    const hidden = log.find((l) => l.url.endsWith('/3/device/apns-gone'));
    deepStrictEqual(JSON.parse(hidden?.body ?? '{}').aps.alert, { title: '깜짝' });
    const drop = log.find((l) => l.url.endsWith('/rpc/drop_push_tokens'));
    deepStrictEqual(JSON.parse(drop?.body ?? '{}'), { p_tokens: ['apns-gone'] });
  },
);
