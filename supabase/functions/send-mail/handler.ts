// 메일 보내기(14 알림 ‘메일’). DB kick_mail()이 1분마다(보낼 메일이 있을 때만) pg_net으로 부름.
// 1) x-mail-secret이 함수 비밀 값 MAIL_CRON_SECRET과 같은지 2) claim_mail로 꺼냄 3) SES(또는 log)로 보냄 4) finish_mail
// MAIL_DRIVER: 'ses'면 보냄, 그 밖('log', 없음)은 보내지 않고 보낸 것으로 표시(로컬·스테이징 기본).
import { sendSes, type SesConfig } from '../_shared/ses.ts';

export interface Env {
  SUPABASE_URL: string;
  /** 새 비밀 키(JSON {"default": "sb_secret_…"}). 없으면 옛 service role 키 */
  SUPABASE_SECRET_KEYS?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  MAIL_CRON_SECRET?: string;
  MAIL_DRIVER?: string;
  MAIL_FROM?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  SES_CONFIGURATION_SET?: string;
}

interface Row {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/** 함수 기본 환경 변수에서 서버 키(공식 문서: SUPABASE_SECRET_KEYS는 JSON, 이름 'default') */
export function serverKey(env: Env): string | null {
  try {
    const keys = env.SUPABASE_SECRET_KEYS
      ? (JSON.parse(env.SUPABASE_SECRET_KEYS) as Record<string, string>)
      : {};
    if (keys.default) return keys.default;
  } catch {
    /* 형식이 다르면 옛 키로 */
  }
  return env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const secret = req.headers.get('x-mail-secret') ?? '';
  if (!env.MAIL_CRON_SECRET || !same(secret, env.MAIL_CRON_SECRET))
    return new Response('forbidden', { status: 403 });
  const key = serverKey(env);
  if (!key) return new Response('no key', { status: 500 });
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const res = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        // 새 비밀 키(sb_secret_)는 apikey로만, 옛 service role 키(JWT)는 Authorization도
        ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    const t = await res.text();
    return t ? (JSON.parse(t) as unknown) : null;
  };
  const rows = ((await rpc('claim_mail', { p_limit: 20 })) ?? []) as Row[];
  const ses: SesConfig | null =
    env.MAIL_DRIVER === 'ses' && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.MAIL_FROM
      ? {
          region: env.AWS_REGION ?? 'ap-northeast-2',
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          from: env.MAIL_FROM,
          configurationSet: env.SES_CONFIGURATION_SET,
        }
      : null;
  let sent = 0;
  for (const r of rows) {
    try {
      const id = ses
        ? await sendSes(
            ses,
            { to: r.to_email, subject: r.subject, text: r.body_text, html: r.body_html },
            fetchFn,
          )
        : `log-${r.id}`;
      if (!ses) console.log(`[send-mail] log ${r.id} ${r.subject}`);
      await rpc('finish_mail', { p_id: r.id, p_message_id: id });
      sent++;
    } catch (e) {
      await rpc('finish_mail', { p_id: r.id, p_error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ claimed: rows.length, sent });
}
