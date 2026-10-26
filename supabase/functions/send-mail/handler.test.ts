import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, serverKey, type Env } from './handler.ts';

const env: Env = {
  SUPABASE_URL: 'http://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'svc',
  MAIL_CRON_SECRET: 's3cret',
};
const row = {
  id: 'm1',
  to_email: 'a@b.kr',
  subject: '제목',
  body_text: '본문',
  body_html: '<p>본문</p>',
};

function fakeFetch(log: { url: string; body: unknown }[], ses?: (body: string) => Response) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    log.push({ url, body });
    if (url.endsWith('/rpc/claim_mail')) return Response.json([row]);
    if (url.endsWith('/rpc/finish_mail')) return new Response(null, { status: 204 });
    if (url.startsWith('https://email.') && ses) return ses(String(init?.body));
    return new Response('no', { status: 500 });
  }) as typeof fetch;
}

Deno.test('비밀 값이 다르면 거절', async () => {
  const log: { url: string; body: unknown }[] = [];
  const res = await handle(
    new Request('http://f', { headers: { 'x-mail-secret': 'x' } }),
    env,
    fakeFetch(log),
  );
  strictEqual(res.status, 403);
  strictEqual(log.length, 0);
});

Deno.test('log 드라이버: 보내지 않고 보낸 것으로 표시', async () => {
  const log: { url: string; body: unknown }[] = [];
  const res = await handle(
    new Request('http://f', { headers: { 'x-mail-secret': 's3cret' } }),
    env,
    fakeFetch(log),
  );
  deepStrictEqual(await res.json(), { claimed: 1, sent: 1 });
  deepStrictEqual(log[1].body, { p_id: 'm1', p_message_id: 'log-m1' });
});

Deno.test('ses 드라이버: SendEmail 본문, 실패하면 오류 기록', async () => {
  const sesEnv: Env = {
    ...env,
    MAIL_DRIVER: 'ses',
    MAIL_FROM: 'sweeTwo <noti@sweetwo.kr>',
    AWS_ACCESS_KEY_ID: 'AKID',
    AWS_SECRET_ACCESS_KEY: 'secret',
  };
  let sentBody: Record<string, unknown> = {};
  const ok = fakeFetch([], (b) => {
    sentBody = JSON.parse(b);
    return Response.json({ MessageId: 'ses-1' });
  });
  const log: { url: string; body: unknown }[] = [];
  const res = await handle(
    new Request('http://f', { headers: { 'x-mail-secret': 's3cret' } }),
    sesEnv,
    (async (i: string | URL | Request, init?: RequestInit) => {
      log.push({ url: String(i), body: null });
      return ok(i, init);
    }) as typeof fetch,
  );
  deepStrictEqual(await res.json(), { claimed: 1, sent: 1 });
  strictEqual(log[1].url, 'https://email.ap-northeast-2.amazonaws.com/v2/email/outbound-emails');
  deepStrictEqual(sentBody.Destination, { ToAddresses: ['a@b.kr'] });
  strictEqual(
    (sentBody.Content as { Simple: { Subject: { Data: string } } }).Simple.Subject.Data,
    '제목',
  );

  const failLog: { url: string; body: unknown }[] = [];
  const bad = fakeFetch(
    failLog,
    () =>
      new Response('{"message":"no"}', {
        status: 400,
        headers: { 'x-amzn-errortype': 'MessageRejected' },
      }),
  );
  const r2 = await handle(
    new Request('http://f', { headers: { 'x-mail-secret': 's3cret' } }),
    sesEnv,
    bad,
  );
  deepStrictEqual(await r2.json(), { claimed: 1, sent: 0 });
  const fin = failLog.find((x) => x.url.endsWith('/rpc/finish_mail'))?.body as { p_error: string };
  strictEqual(fin.p_error.startsWith('ses 400 MessageRejected'), true);
});

Deno.test('서버 키: 새 비밀 키(JSON default) 먼저, 없으면 옛 키', () => {
  strictEqual(
    serverKey({
      SUPABASE_URL: 'x',
      SUPABASE_SECRET_KEYS: '{"default":"sb_secret_a"}',
      SUPABASE_SERVICE_ROLE_KEY: 'old',
    }),
    'sb_secret_a',
  );
  strictEqual(serverKey({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'old' }), 'old');
  strictEqual(serverKey({ SUPABASE_URL: 'x' }), null);
});
