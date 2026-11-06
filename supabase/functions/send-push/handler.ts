// 모바일 푸시 보내기(14 ‘센터와 푸시·메일’). DB kick_push()가 1분마다(보낼 알림이 있을 때만) pg_net으로 부름.
// 1) x-push-secret이 함수 비밀 값 PUSH_CRON_SECRET과 같은지 2) claim_push로 꺼냄(알림 × 기기)
// 3) iOS는 APNs, Android는 FCM 4) 더는 받을 수 없는 토큰은 drop_push_tokens
// PUSH_DRIVER: 'send'면 보냄, 그 밖('log', 없음)은 보내지 않고 로그만(로컬·스테이징 기본, 메일 MAIL_DRIVER와 같음).
import {
  sendApns,
  sendFcm,
  type ApnsConfig,
  type FcmConfig,
  type PushResult,
} from '../_shared/push.ts';
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export interface Env extends Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  PUSH_CRON_SECRET?: string;
  PUSH_DRIVER?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  /** .p8 키 PEM(줄바꿈은 \n 그대로 넣어도 됨) */
  APNS_PRIVATE_KEY?: string;
  APNS_TOPIC?: string;
  /** 'sandbox'면 개발용 APNs(Xcode에서 바로 설치한 앱) */
  APNS_ENV?: string;
  /** Firebase 서비스 계정 JSON(project_id, client_email, private_key) */
  FCM_SERVICE_ACCOUNT?: string;
}

interface Row {
  notification_id: string;
  title: string;
  body: string | null;
  target: string;
  platform: 'ios' | 'android';
  token: string;
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export function configs(env: Env): { apns: ApnsConfig | null; fcm: FcmConfig | null } {
  const apns =
    env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY
      ? {
          keyId: env.APNS_KEY_ID,
          teamId: env.APNS_TEAM_ID,
          privateKey: env.APNS_PRIVATE_KEY,
          topic: env.APNS_TOPIC ?? 'kr.sweetwo.app',
          sandbox: env.APNS_ENV === 'sandbox',
        }
      : null;
  let fcm: FcmConfig | null = null;
  try {
    const sa = env.FCM_SERVICE_ACCOUNT
      ? (JSON.parse(env.FCM_SERVICE_ACCOUNT) as Record<string, string>)
      : null;
    if (sa?.project_id && sa.client_email && sa.private_key)
      fcm = { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  } catch {
    fcm = null;
  }
  return { apns, fcm };
}

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const secret = req.headers.get('x-push-secret') ?? '';
  if (!env.PUSH_CRON_SECRET || !same(secret, env.PUSH_CRON_SECRET))
    return new Response('forbidden', { status: 403 });
  const key = serverKey(env);
  if (!key) return new Response('no key', { status: 500 });
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const res = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    const t = await res.text();
    return t ? (JSON.parse(t) as unknown) : null;
  };
  const rows = ((await rpc('claim_push', { p_limit: 100 })) ?? []) as Row[];
  const send = env.PUSH_DRIVER === 'send';
  const { apns, fcm } = configs(env);
  const gone: string[] = [];
  let sent = 0;
  for (const r of rows) {
    const p = {
      token: r.token,
      title: r.title,
      body: r.body,
      target: r.target,
      id: r.notification_id,
    };
    let result: PushResult = 'ok';
    try {
      if (!send) console.log(`[send-push] log ${r.platform} ${r.notification_id} ${r.title}`);
      else if (r.platform === 'ios' && apns) result = await sendApns(apns, p, fetchFn);
      else if (r.platform === 'android' && fcm) result = await sendFcm(fcm, p, fetchFn);
      else result = 'error';
    } catch {
      result = 'error';
    }
    if (result === 'gone') gone.push(r.token);
    if (result === 'ok') sent++;
  }
  if (gone.length) await rpc('drop_push_tokens', { p_tokens: gone });
  return Response.json({ claimed: rows.length, sent, dropped: gone.length });
}
