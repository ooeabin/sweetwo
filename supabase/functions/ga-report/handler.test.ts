import { deepStrictEqual, strictEqual } from 'node:assert';
import {
  buildRequests,
  cohortWeeks,
  FUNNEL,
  handle,
  resetCache,
  toReport,
  type Env,
  type GaReport,
} from './handler.ts';

// 실제 GA·Google 호출은 없음: fetch를 흉내 냄
const base: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
};
const NOW = new Date('2026-11-17T03:00:00Z'); // KST 화요일 12시
const req = (body: unknown = { days: 7 }, token = 'admin-jwt') =>
  new Request('https://fn/ga-report', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
const row = (dims: string[], mets: number[]) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: mets.map((m) => ({ value: String(m) })),
});

async function testKey() {
  const k = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', k.privateKey));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
}

function fake(admin: { mfa: boolean; roles: string[] } | null, log: string[] = [], gaStatus = 200) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push(url);
    if (url.endsWith('/rest/v1/rpc/admin_me')) {
      const h = new Headers(init?.headers);
      if (h.get('authorization') !== 'Bearer admin-jwt' || !admin)
        return new Response('{"code":"42501"}', { status: 403 });
      return Response.json(admin);
    }
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'ga-token', expires_in: 3600 });
    if (url.includes(':batchRunReports')) {
      if (gaStatus !== 200) return new Response('err', { status: gaStatus });
      const { requests } = JSON.parse(String(init?.body)) as { requests: unknown[] };
      return Response.json({ reports: requests.map(() => ({ rows: [] })) });
    }
    return new Response('?', { status: 404 });
  }) as typeof fetch;
}

Deno.test('어드민 아님·2단계 인증 전·권한 없는 역할(CS)은 403', async () => {
  resetCache();
  strictEqual((await handle(req(), base, fake(null))).status, 403);
  strictEqual((await handle(req({}, ''), base, fake(null))).status, 401);
  strictEqual((await handle(req(), base, fake({ mfa: false, roles: ['super'] }))).status, 403);
  strictEqual((await handle(req(), base, fake({ mfa: true, roles: ['cs'] }))).status, 403);
});

Deno.test('비밀이 없으면 not_connected(GA를 부르지 않음)', async () => {
  resetCache();
  const log: string[] = [];
  const res = await handle(req(), base, fake({ mfa: true, roles: ['analyst'] }, log));
  deepStrictEqual(await res.json(), { state: 'not_connected' });
  strictEqual(
    log.some((u) => u.includes('google')),
    false,
  );
});

Deno.test('GA 실패면 failed, 성공은 기간마다 10분 캐시', async () => {
  resetCache();
  const env = {
    ...base,
    GA_PROPERTY_ID: '123',
    GA_SA_KEY: JSON.stringify({
      client_email: 'sa@x.iam.gserviceaccount.com',
      private_key: await testKey(),
    }),
  };
  const bad = await handle(req(), env, fake({ mfa: true, roles: ['ops'] }, [], 500), () => NOW);
  deepStrictEqual(await bad.json(), { state: 'failed' });
  const log: string[] = [];
  const f = fake({ mfa: true, roles: ['super'] }, log);
  const ok = (await (await handle(req(), env, f, () => NOW)).json()) as {
    state: string;
    days: number;
  };
  strictEqual(ok.state, 'ok');
  strictEqual(ok.days, 7);
  strictEqual(log.filter((u) => u.includes(':batchRunReports')).length, 2);
  await handle(req(), env, f, () => new Date(NOW.getTime() + 5 * 60_000));
  strictEqual(log.filter((u) => u.includes(':batchRunReports')).length, 2);
  await handle(req(), env, f, () => new Date(NOW.getTime() + 11 * 60_000));
  strictEqual(log.filter((u) => u.includes(':batchRunReports')).length, 4);
});

Deno.test('요청: 묶음당 5개 이하, 퍼널은 32장 이벤트 이름, 코호트는 지난 주들', () => {
  const [a, b] = buildRequests(28, NOW);
  strictEqual(a.length <= 5 && b.length <= 5, true);
  deepStrictEqual(
    (a[2] as { dimensionFilter: { filter: { inListFilter: { values: string[] } } } })
      .dimensionFilter.filter.inListFilter.values,
    [...FUNNEL],
  );
  const w = cohortWeeks(NOW, 2);
  deepStrictEqual(w, [
    { name: '2026-11-02', start: '2026-11-02', end: '2026-11-08' },
    { name: '2026-11-09', start: '2026-11-09', end: '2026-11-15' },
  ]);
});

Deno.test(
  '형식 변환: DAU·WAU·MAU는 마지막 날, 퍼널 빈 단계 0, 유입에 스토어 클릭, 코호트 1·2·4·8주',
  () => {
    const r: GaReport[] = [
      { rows: [row(['20261116'], [10, 30, 80]), row(['20261117'], [12, 31, 82])] },
      { rows: [row(['Android'], [20, 5]), row(['iOS'], [40, 9]), row(['web'], [70, 60])] },
      { rows: [row(['onboarding_completed'], [8]), row(['invite_sent'], [3])] },
      { rows: [row(['screen_view'], [900, 50]), row(['menu_item_tapped'], [120, 30])] },
      { rows: [row([], [130, 74])] },
      { rows: [row(['google / organic'], [40]), row(['(direct) / (none)'], [25])] },
      { rows: [row(['google / organic'], [6]), row(['instagram / social'], [2])] },
      {
        rows: [
          row(['2026-11-02', '0000'], [50, 50]),
          row(['2026-11-02', '0001'], [20, 50]),
          row(['2026-11-02', '0002'], [15, 50]),
        ],
      },
    ];
    const out = toReport(7, r, '2026-11-17T03:00:00.000Z');
    deepStrictEqual(out.active, { dau: 12, wau: 31, mau: 82 });
    deepStrictEqual(out.daily[0], { date: '2026-11-16', users: 10 });
    deepStrictEqual(out.users, { active: 130, new: 74 });
    strictEqual(out.platforms[0].platform, 'web');
    deepStrictEqual(
      out.funnel.map((f) => f.users),
      [0, 8, 0, 3, 0, 0],
    );
    deepStrictEqual(out.events[0], { event: 'screen_view', count: 900, users: 50 });
    deepStrictEqual(out.sources, [
      { source: 'google / organic', sessions: 40, store_clicks: 6 },
      { source: '(direct) / (none)', sessions: 25, store_clicks: 0 },
      { source: 'instagram / social', sessions: 0, store_clicks: 2 },
    ]);
    deepStrictEqual(out.cohorts, [{ week: '2026-11-02', users: 50, w1: 20, w2: 15, w4: 0, w8: 0 }]);
  },
);
