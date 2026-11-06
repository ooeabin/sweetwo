import { deepStrictEqual, strictEqual } from 'node:assert';
import { addressOf, decodeWords, handle, parseMail, stripQuoted, type Env } from './handler.ts';

const TOPIC = 'arn:aws:sns:ap-northeast-2:111122223333:sweetwo-inbound-mail';
const env: Env = {
  SUPABASE_URL: 'http://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'svc',
  INBOUND_MAIL_SECRET: 's3cret',
  INBOUND_MAIL_TOPIC_ARN: TOPIC,
};
const post = (body: unknown, token = 's3cret') =>
  new Request(`http://f/inbound-mail?token=${token}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
type Log = { url: string; body: Record<string, unknown> | null }[];
function fakeFetch(log: Log, result = 'created') {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return url.includes('/rpc/') ? Response.json({ result, no: 'A-10001' }) : new Response('ok');
  }) as typeof fetch;
}
const pass = { status: 'PASS' };
const received = (
  content: string,
  receipt: Record<string, unknown> = {},
  encoding: 'UTF8' | 'BASE64' = 'UTF8',
) => ({
  Type: 'Notification',
  TopicArn: TOPIC,
  Message: JSON.stringify({
    notificationType: 'Received',
    mail: { messageId: 'ses-in-1' },
    receipt: {
      spamVerdict: pass,
      virusVerdict: pass,
      spfVerdict: pass,
      dkimVerdict: pass,
      action: { type: 'SNS', encoding },
      ...receipt,
    },
    content,
  }),
});

const simple = [
  'From: =?UTF-8?B?7LCs7Jqw?= <ChanWoo@Example.com>',
  'To: help@sweetwo.kr',
  'Subject: =?UTF-8?B?7Jew6rKwIOusuOydmA==?=',
  'Message-ID: <m1@mail.example.com>',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '=EC=B4=88=EB=8C=80 =EC=BD=94=EB=93=9C=EA=B0=80 =EC=95=88 =EB=B3=B4=EC=97=AC=EC=9A=94',
  '',
].join('\r\n');

Deno.test('토큰이 다르거나 다른 주제면 거절', async () => {
  const log: Log = [];
  strictEqual((await handle(post(received(simple), 'x'), env, fakeFetch(log))).status, 403);
  strictEqual(
    (await handle(post({ ...received(simple), TopicArn: 'arn:x' }), env, fakeFetch(log))).status,
    403,
  );
  strictEqual(log.length, 0);
});

Deno.test('구독 확인은 sns.*.amazonaws.com 주소만 엶', async () => {
  const log: Log = [];
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

Deno.test('받은 메일 → ingest_inquiry_mail(주소 소문자, 제목·본문 풀기)', async () => {
  const log: Log = [];
  const res = await handle(post(received(simple)), env, fakeFetch(log));
  deepStrictEqual(await res.json(), { result: 'created' });
  deepStrictEqual(log, [
    {
      url: 'http://db.test/rest/v1/rpc/ingest_inquiry_mail',
      body: {
        p_from: 'chanwoo@example.com',
        p_subject: '연결 문의',
        p_message_id: 'm1@mail.example.com',
        p_refs: [],
        p_body: '초대 코드가 안 보여요',
        p_attachments: 0,
      },
    },
  ]);
});

Deno.test('인코딩 BASE64도 같은 결과', async () => {
  const log: Log = [];
  const bytes = new TextEncoder().encode(simple);
  const content = btoa(String.fromCharCode(...bytes));
  await handle(post(received(content, {}, 'BASE64')), env, fakeFetch(log));
  strictEqual(log[0].body?.p_body, '초대 코드가 안 보여요');
});

Deno.test(
  '바이러스·스팸 FAIL, SPF와 DKIM 둘 다 FAIL이면 버림. SPF만 FAIL(전달)이면 받음',
  async () => {
    const fail = { status: 'FAIL' };
    for (const r of [
      { virusVerdict: fail },
      { spamVerdict: fail },
      { spfVerdict: fail, dkimVerdict: fail },
    ]) {
      const log: Log = [];
      const res = await handle(post(received(simple, r)), env, fakeFetch(log));
      deepStrictEqual(await res.json(), { result: 'dropped' });
      strictEqual(log.length, 0);
    }
    const log: Log = [];
    await handle(post(received(simple, { spfVerdict: fail })), env, fakeFetch(log));
    strictEqual(log.length, 1);
  },
);

Deno.test('앱 문의 사본(X-Sweetwo-Copy), 자동 응답, 반송은 넘기지 않음', async () => {
  const copy = simple.replace('To:', 'X-Sweetwo-Copy: A-10001\r\nTo:');
  const auto = simple.replace('To:', 'Auto-Submitted: auto-replied\r\nTo:');
  const bounce = simple.replace('ChanWoo@Example.com', 'MAILER-DAEMON@example.com');
  for (const [m, why] of [
    [copy, 'copy'],
    [auto, 'auto'],
    [bounce, 'bounce'],
  ]) {
    const log: Log = [];
    const res = await handle(post(received(m)), env, fakeFetch(log));
    deepStrictEqual(await res.json(), { result: 'skipped', reason: why });
    strictEqual(log.length, 0);
  }
});

Deno.test('multipart: text/plain(EUC-KR, base64)만, 첨부는 개수만, 이전 대화는 뺌', () => {
  // ‘네, 다시 해 볼게요’를 EUC-KR로
  const euckr = btoa(
    String.fromCharCode(
      0xb3,
      0xd7,
      0x2c,
      0x20,
      0xb4,
      0xd9,
      0xbd,
      0xc3,
      0x20,
      0xc7,
      0xd8,
      0x20,
      0xba,
      0xbc,
      0xb0,
      0xd4,
      0xbf,
      0xe4,
    ),
  );
  const raw = [
    'From: "Chanwoo" <chanwoo@example.com>',
    'Subject: Re: =?UTF-8?Q?=EC=97=B0=EA=B2=B0_=EB=AC=B8=EC=9D=98_?= [A-10001]',
    'Message-ID: <m2@mail.example.com>',
    'In-Reply-To: <ses-0001@ap-northeast-2.amazonses.com>',
    'References: <m1@mail.example.com>',
    ' <ses-0001@ap-northeast-2.amazonses.com>',
    'Content-Type: multipart/mixed; boundary="outer"',
    '',
    '--outer',
    'Content-Type: multipart/alternative; boundary=inner',
    '',
    '--inner',
    'Content-Type: text/plain; charset=euc-kr',
    'Content-Transfer-Encoding: base64',
    '',
    euckr,
    '--inner',
    'Content-Type: text/html; charset=UTF-8',
    '',
    '<p>html</p>',
    '--inner--',
    '--outer',
    'Content-Type: image/png; name="a.png"',
    'Content-Disposition: attachment; filename="a.png"',
    'Content-Transfer-Encoding: base64',
    '',
    'iVBORw0KGgo=',
    '--outer--',
    '',
  ].join('\r\n');
  const p = parseMail(raw);
  deepStrictEqual(p, {
    from: 'chanwoo@example.com',
    subject: 'Re: 연결 문의 [A-10001]',
    messageId: 'm2@mail.example.com',
    refs: ['m1@mail.example.com', 'ses-0001@ap-northeast-2.amazonses.com'],
    body: '네, 다시 해 볼게요',
    attachments: 1,
  });
});

Deno.test('text/html만 있으면 글자만, 인용(blockquote) 빼고', () => {
  const raw = [
    'From: chanwoo@example.com',
    'Subject: hi',
    'Content-Type: text/html; charset=UTF-8',
    '',
    '<div>고마워요<br>잘 됐어요</div><blockquote>이전 대화</blockquote>',
  ].join('\n');
  // parseMail은 바이트 하나가 글자 하나인 문자열을 받음(handle이 바꿔 줌)
  const p = parseMail(String.fromCharCode(...new TextEncoder().encode(raw)));
  strictEqual('body' in p && p.body, '고마워요\n잘 됐어요');
});

Deno.test('이전 대화 빼기', () => {
  strictEqual(
    stripQuoted(
      '다시 해 봤어요\n\n2026년 11월 6일 (금) 오후 3:00, sweeTwo <help@sweetwo.kr>님이 작성:\n> 초대 코드를 다시 받아 주세요',
    ),
    '다시 해 봤어요',
  );
  strictEqual(stripQuoted('네\n-----Original Message-----\nFrom: x'), '네');
  strictEqual(stripQuoted('On Fri, Nov 6 wrote:\n본문'), 'On Fri, Nov 6 wrote:\n본문');
});

Deno.test('주소와 머리글 풀기', () => {
  strictEqual(addressOf('=?UTF-8?B?7LCs7Jqw?= <A@B.kr>'), 'a@b.kr');
  strictEqual(addressOf('a@b.kr'), 'a@b.kr');
  strictEqual(addressOf('이름만'), null);
  strictEqual(decodeWords('=?UTF-8?B?7LCs?= =?UTF-8?B?7Jqw?='), '찬우');
});

Deno.test('DB 실패면 502(SNS가 다시 보냄)', async () => {
  const res = await handle(
    post(received(simple)),
    env,
    (async () => new Response('x', { status: 500 })) as typeof fetch,
  );
  strictEqual(res.status, 502);
});
