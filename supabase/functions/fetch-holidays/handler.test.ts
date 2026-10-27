import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, parseHolidays, type Env } from './handler.ts';

const env: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
  HOLIDAY_CRON_SECRET: 'h-secret',
  HOLIDAY_API_KEY: 'k+ey/==',
};
const req = (s: string) =>
  new Request('https://fn/fetch-holidays', { method: 'POST', headers: { 'x-holiday-secret': s } });
const api = (items: unknown) => ({
  response: { header: { resultCode: '00' }, body: { items, totalCount: 1 } },
});

Deno.test('응답 모양: 배열, 하나(객체), 없음(빈 글), 쉬는 날만, 대체·임시', () => {
  deepStrictEqual(
    parseHolidays(
      api({
        item: [
          { locdate: 20270101, dateName: '1월1일', isHoliday: 'Y' },
          { locdate: 20270209, dateName: '대체공휴일', isHoliday: 'Y' },
          { locdate: 20270210, dateName: '어떤 날', isHoliday: 'N' },
        ],
      }),
    ),
    [
      { date: '2027-01-01', name: '1월1일', kind: 'holiday' },
      { date: '2027-02-09', name: '대체공휴일', kind: 'substitute' },
    ],
  );
  deepStrictEqual(
    parseHolidays(api({ item: { locdate: '20270603', dateName: '임시공휴일', isHoliday: 'Y' } })),
    [{ date: '2027-06-03', name: '임시공휴일', kind: 'temporary' }],
  );
  deepStrictEqual(parseHolidays(api('')), []);
});

Deno.test('비밀 값이 다르면 403, 올해·다음 해를 받아 저장(키는 주소에 인코딩)', async () => {
  const urls: string[] = [];
  let saved = '';
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input);
    urls.push(u);
    if (u.includes('save_api_holidays')) {
      saved = String(init?.body);
      return new Response('2');
    }
    const y = new URL(u).searchParams.get('solYear');
    return Response.json(
      y === '2026'
        ? api({ item: { locdate: 20261225, dateName: '기독탄신일', isHoliday: 'Y' } })
        : api({ item: { locdate: 20270101, dateName: '1월1일', isHoliday: 'Y' } }),
    );
  }) as typeof fetch;
  strictEqual((await handle(req('no'), env, f)).status, 403);
  const res = await handle(req('h-secret'), env, f, new Date('2026-10-27T00:00:00Z'));
  deepStrictEqual(await res.json(), { saved: 2, years: [2026, 2027] });
  strictEqual(new URL(urls[0] ?? '').searchParams.get('ServiceKey'), 'k+ey/==');
  deepStrictEqual(JSON.parse(saved).p_years, [2026, 2027]);
});
