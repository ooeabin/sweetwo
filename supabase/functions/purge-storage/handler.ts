// 사진 파일 지우기(31 보안·개인정보 ‘지우기’). DB kick_purge()가 10분마다(지울 것이 있을 때만) pg_net으로 부름.
// 1) x-purge-secret이 함수 비밀 값 PURGE_CRON_SECRET과 같은지 2) claim_storage_purge로 꺼냄(하루 넘게 붙지 않은 파일 포함)
// 3) 버킷마다 Storage API로 지움 4) 지운 것만 done_storage_purge(실패하면 다음에 다시, 5번까지)
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export interface Env extends Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  PURGE_CRON_SECRET?: string;
}

interface Row {
  id: number;
  bucket: 'photos' | 'avatars';
  path: string;
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const secret = req.headers.get('x-purge-secret') ?? '';
  if (!env.PURGE_CRON_SECRET || !same(secret, env.PURGE_CRON_SECRET))
    return new Response('forbidden', { status: 403 });
  const key = serverKey(env);
  if (!key) return new Response('no key', { status: 500 });
  const headers = {
    apikey: key,
    ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
    'Content-Type': 'application/json',
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const res = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    const t = await res.text();
    return t ? (JSON.parse(t) as unknown) : null;
  };
  const rows = ((await rpc('claim_storage_purge', { p_limit: 200 })) ?? []) as Row[];
  const done: number[] = [];
  for (const bucket of ['photos', 'avatars'] as const) {
    const mine = rows.filter((r) => r.bucket === bucket);
    if (!mine.length) continue;
    try {
      const res = await fetchFn(`${env.SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: mine.map((r) => r.path) }),
      });
      // 이미 없는 파일도 성공(목록에 안 나옴)으로 봄
      if (res.ok) done.push(...mine.map((r) => r.id));
    } catch {
      /* 다음에 다시 */
    }
  }
  if (done.length) await rpc('done_storage_purge', { p_ids: done });
  return Response.json({ claimed: rows.length, removed: done.length });
}
