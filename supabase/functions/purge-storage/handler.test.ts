import { deepStrictEqual, strictEqual } from 'node:assert';
import { handle, type Env } from './handler.ts';

type Log = { url: string; method: string; body: string };
const env: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
  PURGE_CRON_SECRET: 'purge-secret',
};
const req = (secret: string) =>
  new Request('https://fn/purge-storage', {
    method: 'POST',
    headers: { 'x-purge-secret': secret },
  });

function fake(log: Log[], failAvatars = false, moves: unknown[] = []) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') });
    if (url.endsWith('/rpc/claim_storage_move')) return Response.json(moves);
    if (url.endsWith('/rpc/claim_storage_purge'))
      return Response.json([
        { id: 1, bucket: 'photos', path: 'g/a.jpg' },
        { id: 2, bucket: 'photos', path: 'r/b.jpg' },
        { id: 3, bucket: 'avatars', path: 's/u.jpg' },
      ]);
    if (url.endsWith('/storage/v1/object/avatars') && failAvatars)
      return new Response('x', { status: 500 });
    if (url.includes('/storage/v1/object/')) return Response.json([]);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
}

Deno.test('비밀 값이 다르면 403', async () => {
  const log: Log[] = [];
  strictEqual((await handle(req('nope'), env, fake(log))).status, 403);
  strictEqual(log.length, 0);
});

Deno.test('버킷마다 지우고, 지운 것만 끝냄', async () => {
  const log: Log[] = [];
  const res = await handle(req('purge-secret'), env, fake(log, true));
  deepStrictEqual(await res.json(), { claimed: 3, removed: 2, moved: 0 });
  const photos = log.find((l) => l.url.endsWith('/object/photos'));
  strictEqual(photos?.method, 'DELETE');
  deepStrictEqual(JSON.parse(photos?.body ?? '{}'), { prefixes: ['g/a.jpg', 'r/b.jpg'] });
  const done = log.find((l) => l.url.endsWith('/rpc/done_storage_purge'));
  deepStrictEqual(JSON.parse(done?.body ?? '{}'), { p_ids: [1, 2] });
});

Deno.test('공간이 바뀐 프로필 사진: 옮길 곳을 비우고 복사한 뒤 done_storage_move(S11-03)', async () => {
  const log: Log[] = [];
  const move = { id: 7, bucket: 'avatars', from_path: 'old/u.jpg', to_path: 'new/u.jpg' };
  const res = await handle(req('purge-secret'), env, fake(log, false, [move]));
  deepStrictEqual(await res.json(), { claimed: 3, removed: 3, moved: 1 });
  const i = log.findIndex((l) => l.url.endsWith('/storage/v1/object/copy'));
  deepStrictEqual(JSON.parse(log[i]?.body ?? '{}'), {
    bucketId: 'avatars',
    sourceKey: 'old/u.jpg',
    destinationKey: 'new/u.jpg',
  });
  deepStrictEqual(JSON.parse(log[i - 1]?.body ?? '{}'), { prefixes: ['new/u.jpg'] });
  const done = log.find((l) => l.url.endsWith('/rpc/done_storage_move'));
  deepStrictEqual(JSON.parse(done?.body ?? '{}'), { p_ids: [7] });
});
