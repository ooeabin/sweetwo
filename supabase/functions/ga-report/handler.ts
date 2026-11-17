// 어드민 AD-21 ‘분석’(27 AD-21, ADR 0010): GA4 Data API를 서비스 계정으로 불러 집계값만 돌려줌.
// 1) 부른 사람이 어드민인지: 사용자 JWT로 rpc admin_me → 2단계 인증(mfa) + 역할(최고 관리자·운영·분석)
// 2) 비밀 GA_PROPERTY_ID, GA_SA_KEY(서비스 계정 JSON)가 없으면 { state: 'not_connected' }
// 3) batchRunReports 두 번(보고서 7개) → toReport로 화면 모양. 기간(7·28·90일)마다 10분 캐시(성공만)
// 사람 단위 값(사용자 id 등)은 요청하지도 돌려주지도 않음.
import { signJwt } from '../_shared/jwt.ts';
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export type Env = Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> & {
  GA_PROPERTY_ID?: string;
  GA_SA_KEY?: string;
};

export const DAYS = [7, 28, 90] as const;
export type Days = (typeof DAYS)[number];
const ROLES = ['super', 'ops', 'analyst'];
const TTL_MS = 10 * 60 * 1000;

/** 32장 핵심 퍼널(이름 그대로). signup_completed는 서버 이벤트라 GA 전송 전까지 0 [확인 필요] */
export const FUNNEL = [
  'signup_completed',
  'onboarding_completed',
  'saving_item_created',
  'invite_sent',
  'partner_joined',
  'payday_confirmed',
] as const;

// ── GA4 Data API 응답 모양(쓰는 것만) ──
type Cell = { value?: string };
type Row = { dimensionValues?: Cell[]; metricValues?: Cell[] };
export type GaReport = { rows?: Row[] };

export type Report = {
  state: 'ok';
  days: Days;
  at: string;
  active: { dau: number; wau: number; mau: number };
  daily: { date: string; users: number }[];
  users: { new: number; active: number };
  platforms: { platform: string; users: number; new: number }[];
  funnel: { event: string; users: number }[];
  events: { event: string; count: number; users: number }[];
  sources: { source: string; sessions: number; store_clicks: number }[];
  cohorts: { week: string; users: number; w1: number; w2: number; w4: number; w8: number }[];
};

const num = (c: Cell | undefined) => {
  const n = Number(c?.value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const dim = (r: Row, i = 0) => r.dimensionValues?.[i]?.value ?? '';
const rows = (r: GaReport | undefined) => r?.rows ?? [];
const ymd = (d: string) =>
  /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;

/** 날짜 문자열(YYYY-MM-DD, KST 기준 오늘에서 n일 전) */
export function kstDate(now: Date, daysAgo: number): string {
  const k = new Date(now.getTime() + 9 * 3600_000 - daysAgo * 86400_000);
  return k.toISOString().slice(0, 10);
}

/** 가입 주 코호트(첫 방문 주, 월요일 시작): 최근 n주(이번 주 제외) */
export function cohortWeeks(
  now: Date,
  count: number,
): { name: string; start: string; end: string }[] {
  const today = new Date(`${kstDate(now, 0)}T00:00:00Z`);
  const dow = (today.getUTCDay() + 6) % 7; // 월 = 0
  const thisMon = new Date(today.getTime() - dow * 86400_000);
  return Array.from({ length: count }, (_, i) => {
    const s = new Date(thisMon.getTime() - (count - i) * 7 * 86400_000);
    const e = new Date(s.getTime() + 6 * 86400_000);
    const d = (x: Date) => x.toISOString().slice(0, 10);
    return { name: d(s), start: d(s), end: d(e) };
  });
}

const inList = (field: string, values: readonly string[]) => ({
  filter: { fieldName: field, inListFilter: { values: [...values] } },
});
const exact = (field: string, value: string) => ({
  filter: { fieldName: field, stringFilter: { matchType: 'EXACT', value } },
});

/** Data API 요청 두 묶음(batchRunReports는 한 번에 5개까지) */
export function buildRequests(days: Days, now: Date) {
  const range = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
  const weeks = cohortWeeks(now, days === 7 ? 4 : days === 28 ? 8 : 12);
  const first = [
    // 0 하루별 활성 + 마지막 날의 DAU·WAU·MAU
    {
      dateRanges: range,
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'active1DayUsers' },
        { name: 'active7DayUsers' },
        { name: 'active28DayUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
    // 1 플랫폼(iOS·Android·web)별 활성·신규
    {
      dateRanges: range,
      dimensions: [{ name: 'platform' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
    },
    // 2 핵심 퍼널(이벤트별 사용자 수, 순서 무관)
    {
      dateRanges: range,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: inList('eventName', FUNNEL),
    },
    // 3 이벤트 수 상위 20
    {
      dateRanges: range,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    },
    // 4 전체 활성·신규(기간 합)
    { dateRanges: range, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }] },
  ];
  const second = [
    // 5 웹사이트 유입: 소스/매체별 세션
    {
      dateRanges: range,
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: exact('platform', 'web'),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    },
    // 6 웹사이트 스토어 클릭(site_store_clicked) 소스/매체별
    {
      dateRanges: range,
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: exact('eventName', 'site_store_clicked'),
      limit: 10,
    },
    // 7 첫 방문 주 코호트의 1·2·4·8주 뒤 활성(앱 첫 실행 기준, 가입 기준 아님)
    {
      dimensions: [{ name: 'cohort' }, { name: 'cohortNthWeek' }],
      metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
      cohortSpec: {
        cohorts: weeks.map((w) => ({
          name: w.name,
          dimension: 'firstSessionDate',
          dateRange: { startDate: w.start, endDate: w.end },
        })),
        cohortsRange: { granularity: 'WEEKLY', startOffset: 0, endOffset: 8 },
      },
    },
  ];
  return [first, second];
}

/** Data API 보고서 8개 → 화면 모양 */
export function toReport(days: Days, r: GaReport[], at: string): Report {
  const daily = rows(r[0]).map((x) => ({ date: ymd(dim(x)), users: num(x.metricValues?.[0]) }));
  const last = rows(r[0]).at(-1);
  const total = rows(r[4])[0];
  const funnelUsers = new Map(rows(r[2]).map((x) => [dim(x), num(x.metricValues?.[0])]));
  const clicks = new Map(rows(r[6]).map((x) => [dim(x), num(x.metricValues?.[0])]));
  const sources = rows(r[5]).map((x) => ({
    source: dim(x),
    sessions: num(x.metricValues?.[0]),
    store_clicks: clicks.get(dim(x)) ?? 0,
  }));
  // 세션 상위 10에 없는 소스의 스토어 클릭도 보이게
  for (const [source, n] of clicks)
    if (!sources.some((s) => s.source === source))
      sources.push({ source, sessions: 0, store_clicks: n });
  const cohort = new Map<string, Report['cohorts'][number]>();
  for (const x of rows(r[7])) {
    const week = dim(x, 0);
    const nth = Number(dim(x, 1));
    const c = cohort.get(week) ?? { week, users: 0, w1: 0, w2: 0, w4: 0, w8: 0 };
    c.users = Math.max(c.users, num(x.metricValues?.[1]));
    if (nth === 1) c.w1 = num(x.metricValues?.[0]);
    if (nth === 2) c.w2 = num(x.metricValues?.[0]);
    if (nth === 4) c.w4 = num(x.metricValues?.[0]);
    if (nth === 8) c.w8 = num(x.metricValues?.[0]);
    cohort.set(week, c);
  }
  return {
    state: 'ok',
    days,
    at,
    active: {
      dau: num(last?.metricValues?.[0]),
      wau: num(last?.metricValues?.[1]),
      mau: num(last?.metricValues?.[2]),
    },
    daily,
    users: { active: num(total?.metricValues?.[0]), new: num(total?.metricValues?.[1]) },
    platforms: rows(r[1])
      .map((x) => ({
        platform: dim(x),
        users: num(x.metricValues?.[0]),
        new: num(x.metricValues?.[1]),
      }))
      .sort((a, b) => b.users - a.users),
    funnel: FUNNEL.map((event) => ({ event, users: funnelUsers.get(event) ?? 0 })),
    events: rows(r[3]).map((x) => ({
      event: dim(x),
      count: num(x.metricValues?.[0]),
      users: num(x.metricValues?.[1]),
    })),
    sources,
    cohorts: [...cohort.values()].sort((a, b) => a.week.localeCompare(b.week)),
  };
}

// ── 서비스 계정 토큰(analytics.readonly) ──
type Sa = { client_email: string; private_key: string };
let access: { key: string; value: string; exp: number } | null = null;
async function gaToken(sa: Sa, fetchFn: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (access && access.key === sa.client_email && access.exp - now > 300) return access.value;
  const assertion = await signJwt(
    'RS256',
    sa.private_key,
    {},
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
  );
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error(`ga oauth ${res.status}`);
  const t = (await res.json()) as { access_token: string; expires_in: number };
  access = { key: sa.client_email, value: t.access_token, exp: now + t.expires_in };
  return t.access_token;
}

const cache = new Map<Days, { exp: number; body: Report }>();
/** 테스트용: 캐시·토큰 비우기 */
export const resetCache = () => {
  cache.clear();
  access = null;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth)) return reply({ error: 'unauthorized' }, 401);
  const key = serverKey(env);
  if (!key) return reply({ error: 'no key' }, 500);

  // 어드민(2단계 인증 + 역할)만
  const me = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/admin_me`, {
    method: 'POST',
    headers: { apikey: key, Authorization: auth, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!me.ok) return reply({ error: 'forbidden' }, 403);
  const a = (await me.json().catch(() => null)) as { mfa?: boolean; roles?: string[] } | null;
  if (!a?.mfa || !a.roles?.some((r) => ROLES.includes(r)))
    return reply({ error: 'forbidden' }, 403);

  const body = (await req.json().catch(() => ({}))) as { days?: unknown };
  const days = DAYS.find((d) => d === Number(body.days)) ?? 28;

  if (!env.GA_PROPERTY_ID || !env.GA_SA_KEY) return reply({ state: 'not_connected' });
  let sa: Sa;
  try {
    sa = JSON.parse(env.GA_SA_KEY) as Sa;
    if (!sa.client_email || !sa.private_key) throw new Error('sa');
  } catch {
    return reply({ state: 'not_connected' });
  }
  const property = env.GA_PROPERTY_ID.replace(/^properties\//, '').trim();
  if (!/^\d+$/.test(property)) return reply({ state: 'not_connected' });

  const t = now();
  const hit = cache.get(days);
  if (hit && hit.exp > t.getTime()) return reply(hit.body);

  try {
    const token = await gaToken(sa, fetchFn);
    const reports: GaReport[] = [];
    for (const requests of buildRequests(days, t)) {
      const res = await fetchFn(
        `https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ requests }),
        },
      );
      if (!res.ok) throw new Error(`ga ${res.status}`);
      const j = (await res.json()) as { reports?: GaReport[] };
      reports.push(...(j.reports ?? []));
    }
    const out = toReport(days, reports, t.toISOString());
    cache.set(days, { exp: t.getTime() + TTL_MS, body: out });
    return reply(out);
  } catch (e) {
    console.error('ga-report', e instanceof Error ? e.message : 'error');
    return reply({ state: 'failed' });
  }
}
