// 메일 반송·수신 거부 받기(14 ‘알림 메일 반송’). SES 구성 세트 이벤트(Bounce, Complaint) → SNS 주제 → 이 함수(HTTPS 구독).
// 1) 주소의 ?token=이 함수 비밀 값 MAIL_EVENTS_SECRET과 같은지 2) TopicArn이 MAIL_EVENTS_TOPIC_ARN과 같은지
// 3) 구독 확인은 SubscribeURL(sns.<지역>.amazonaws.com만)을 열어 확인 4) 영구 반송·수신 거부만 note_mail_event로 넘김.
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export interface Env extends Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  MAIL_EVENTS_SECRET?: string;
  MAIL_EVENTS_TOPIC_ARN?: string;
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

interface SnsMessage {
  Type?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
}
interface Recipient {
  emailAddress?: string;
}
interface SesEvent {
  eventType?: string;
  notificationType?: string;
  bounce?: { bounceType?: string; bouncedRecipients?: Recipient[] };
  complaint?: { complainedRecipients?: Recipient[] };
}

/** SES 이벤트에서 (주소, 종류) 목록. 일시 반송(Transient 등)은 빼고 영구 반송만 */
export function eventsOf(e: SesEvent): { email: string; kind: 'bounce' | 'complaint' }[] {
  const type = e.eventType ?? e.notificationType;
  const list = (r?: Recipient[]) =>
    (r ?? []).map((x) => x.emailAddress ?? '').filter((x) => x.includes('@'));
  if (type === 'Bounce' && e.bounce?.bounceType === 'Permanent')
    return list(e.bounce.bouncedRecipients).map((email) => ({ email, kind: 'bounce' as const }));
  if (type === 'Complaint')
    return list(e.complaint?.complainedRecipients).map((email) => ({
      email,
      kind: 'complaint' as const,
    }));
  return [];
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!env.MAIL_EVENTS_SECRET || !same(token, env.MAIL_EVENTS_SECRET))
    return new Response('forbidden', { status: 403 });
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  let msg: SnsMessage;
  try {
    msg = (await req.json()) as SnsMessage;
  } catch {
    return new Response('bad', { status: 400 });
  }
  if (!env.MAIL_EVENTS_TOPIC_ARN || msg.TopicArn !== env.MAIL_EVENTS_TOPIC_ARN)
    return new Response('topic', { status: 403 });

  if (msg.Type === 'SubscriptionConfirmation') {
    let u: URL;
    try {
      u = new URL(msg.SubscribeURL ?? '');
    } catch {
      return new Response('bad', { status: 400 });
    }
    if (u.protocol !== 'https:' || !SNS_HOST.test(u.hostname))
      return new Response('bad', { status: 400 });
    const res = await fetchFn(u.toString());
    return new Response(res.ok ? 'confirmed' : 'failed', { status: res.ok ? 200 : 502 });
  }
  if (msg.Type !== 'Notification') return new Response('ignored');

  let e: SesEvent;
  try {
    e = JSON.parse(msg.Message ?? '') as SesEvent;
  } catch {
    return new Response('bad', { status: 400 });
  }
  const key = serverKey(env);
  if (!key) return new Response('no key', { status: 500 });
  const events = eventsOf(e);
  for (const x of events) {
    const res = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/note_mail_event`, {
      method: 'POST',
      headers: {
        apikey: key,
        ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: x.email, p_kind: x.kind }),
    });
    if (!res.ok) return new Response('db', { status: 502 });
  }
  return Response.json({ noted: events.length });
}
