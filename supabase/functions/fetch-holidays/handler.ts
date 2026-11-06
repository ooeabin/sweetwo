// 공휴일 받기(29 기술·운영 ‘공휴일’). DB kick_holidays()가 매주 월 03:00(KST) pg_net으로 부름.
// 1) x-holiday-secret이 함수 비밀 값 HOLIDAY_CRON_SECRET과 같은지 2) 한국천문연구원 특일 정보(getRestDeInfo)로 올해·다음 해
// 3) save_api_holidays(어드민이 넣은 날은 안 덮음, 빠진 API 날은 지움). 키는 함수 비밀 값 HOLIDAY_API_KEY(공공데이터포털 일반 인증키, 디코딩)
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export interface Env extends Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  HOLIDAY_CRON_SECRET?: string;
  HOLIDAY_API_KEY?: string;
}

const API = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

export interface Holiday {
  date: string;
  name: string;
  kind: 'holiday' | 'substitute' | 'temporary';
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/** 응답 → 공휴일(쉬는 날만). item은 0개면 빈 글, 1개면 객체, 여러 개면 배열 */
export function parseHolidays(json: unknown): Holiday[] {
  const body = (json as { response?: { header?: { resultCode?: string }; body?: unknown } })
    ?.response;
  if (body?.header?.resultCode && body.header.resultCode !== '00')
    throw new Error('api ' + body.header.resultCode);
  const items = (body?.body as { items?: { item?: unknown } | string } | undefined)?.items;
  const raw = typeof items === 'object' && items ? items.item : undefined;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as {
    locdate?: number | string;
    dateName?: string;
    isHoliday?: string;
  }[];
  return list
    .filter((i) => i.isHoliday === 'Y' && i.locdate && i.dateName)
    .map((i) => {
      const d = String(i.locdate);
      const name = String(i.dateName).trim();
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        name,
        kind: name.includes('대체')
          ? 'substitute'
          : name.includes('임시')
            ? 'temporary'
            : 'holiday',
      };
    });
}

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
  now = new Date(),
) {
  const secret = req.headers.get('x-holiday-secret') ?? '';
  if (!env.HOLIDAY_CRON_SECRET || !same(secret, env.HOLIDAY_CRON_SECRET))
    return new Response('forbidden', { status: 403 });
  const key = serverKey(env);
  if (!key || !env.HOLIDAY_API_KEY) return new Response('no key', { status: 500 });
  const year = Number(new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 4));
  const years = [year, year + 1];
  const rows: Holiday[] = [];
  const got: number[] = [];
  for (const y of years) {
    const q = new URLSearchParams({
      ServiceKey: env.HOLIDAY_API_KEY,
      solYear: String(y),
      numOfRows: '100',
      _type: 'json',
    });
    const res = await fetchFn(`${API}?${q}`);
    if (!res.ok) continue;
    try {
      const list = parseHolidays(await res.json());
      if (list.length) {
        rows.push(...list);
        got.push(y);
      }
    } catch {
      /* 그 해는 건너뜀(다음 주에 다시) */
    }
  }
  if (!rows.length) return Response.json({ saved: 0, years: [] });
  const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/save_api_holidays`, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_rows: rows, p_years: got }),
  });
  if (!r.ok) return new Response('save failed', { status: 502 });
  return Response.json({ saved: Number(await r.text()), years: got });
}
