import { deepStrictEqual, strictEqual } from 'node:assert';
import { eventsOf, handle, type Env } from './handler.ts';

const TOPIC = 'arn:aws:sns:ap-northeast-2:111122223333:sweetwo-mail-events';
const env: Env = {
  SUPABASE_URL: 'http://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'svc',
  MAIL_EVENTS_SECRET: 's3cret',
  MAIL_EVENTS_TOPIC_ARN: TOPIC,
};
const post = (body: unknown, token = 's3cret') =>
  new Request(`http://f/mail-events?token=${token}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
function fakeFetch(log: { url: string; body: unknown }[]) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(null, { status: url.includes('/rpc/') ? 204 : 200 });
  }) as typeof fetch;
}
const bounce = (type: string) => ({
  Type: 'Notification',
  TopicArn: TOPIC,
  Message: JSON.stringify({
    eventType: 'Bounce',
    bounce: { bounceType: type, bouncedRecipients: [{ emailAddress: 'a@b.kr' }] },
  }),
});

Deno.test('토큰이 다르면 거절', async () => {
  const log: { url: string; body: unknown }[] = [];
  strictEqual((await handle(post(bounce('Permanent'), 'x'), env, fakeFetch(log))).status, 403);
  strictEqual(log.length, 0);
});

Deno.test('다른 주제면 거절', async () => {
  const log: { url: string; body: unknown }[] = [];
  const res = await handle(
    post({ ...bounce('Permanent'), TopicArn: 'arn:x' }),
    env,
    fakeFetch(log),
  );
  strictEqual(res.status, 403);
});

Deno.test('영구 반송은 note_mail_event, 일시 반송은 넘기지 않음', async () => {
  const log: { url: string; body: unknown }[] = [];
  await handle(post(bounce('Permanent')), env, fakeFetch(log));
  deepStrictEqual(log, [
    {
      url: 'http://db.test/rest/v1/rpc/note_mail_event',
      body: { p_email: 'a@b.kr', p_kind: 'bounce' },
    },
  ]);
  const log2: { url: string; body: unknown }[] = [];
  await handle(post(bounce('Transient')), env, fakeFetch(log2));
  strictEqual(log2.length, 0);
});

Deno.test('구독 확인은 sns.*.amazonaws.com 주소만 엶', async () => {
  const log: { url: string; body: unknown }[] = [];
  const ok = await handle(
    post({
      Type: 'SubscriptionConfirmation',
      TopicArn: TOPIC,
      SubscribeURL: 'https://sns.ap-northeast-2.amazonaws.com/?Action=ConfirmSubscription&Token=t',
    }),
    env,
    fakeFetch(log),
  );
  strictEqual(ok.status, 200);
  strictEqual(log.length, 1);
  const bad = await handle(
    post({
      Type: 'SubscriptionConfirmation',
      TopicArn: TOPIC,
      SubscribeURL: 'https://evil.example/',
    }),
    env,
    fakeFetch(log),
  );
  strictEqual(bad.status, 400);
  strictEqual(log.length, 1);
});

Deno.test('수신 거부 신고와 알림 형식(notificationType)', () => {
  deepStrictEqual(
    eventsOf({
      notificationType: 'Complaint',
      complaint: { complainedRecipients: [{ emailAddress: 'c@d.kr' }] },
    }),
    [{ email: 'c@d.kr', kind: 'complaint' }],
  );
});
