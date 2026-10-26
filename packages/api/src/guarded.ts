import type { Tables, TablesUpdate } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 열 때 값이 그대로일 때만 고치기(30 동기화 2장 ‘같은 필드만 규칙’). 다른 칸끼리는 서로 영향 없음.
// 바뀌어 있으면 지금 행을 돌려줌 → 화면이 core conflictDecision으로 고르기·덮기를 정함.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

type Guarded = 'goal' | 'asset';
export type GuardedResult<T extends Guarded> = { ok: true } | { ok: false; current: Tables<T> };

// 테이블마다 타입이 달라 쿼리 빌더는 이 모양으로만 씀(열 이름은 base 키, 값은 그 열의 값)
type Res = { data: unknown[] | null; error: { message?: string } | null };
interface Filter extends PromiseLike<Res> {
  eq: (k: string, v: unknown) => Filter;
  is: (k: string, v: null) => Filter;
  select: (c: string) => Filter;
}
interface From {
  update: (p: unknown) => Filter;
  select: (c: string) => Filter;
}

export async function updateIfUnchanged<T extends Guarded>(
  table: T,
  id: string,
  patch: TablesUpdate<T>,
  base: Partial<Tables<T>>,
): Promise<GuardedResult<T>> {
  const from = () => supabase().from(table) as unknown as From;
  let q = from().update(patch).eq('id', id);
  for (const [k, v] of Object.entries(base)) q = v === null ? q.is(k, null) : q.eq(k, v);
  const { data, error } = await q.select('id');
  fail(error);
  if (data?.length) return { ok: true };
  const cur = await from().select('*').eq('id', id);
  fail(cur.error);
  const row = cur.data?.[0];
  if (!row) throw new AuthCallError('unknown');
  return { ok: false, current: row as Tables<T> };
}
