import type { Database, Tables, TablesUpdate } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 온보딩 파트 0~2 서버 호출. 저장은 화면을 넘길 때마다(docs/spec/12-question-pattern.md ‘자동 저장’).
export type Me = Pick<
  Tables<'app_user'>,
  | 'id'
  | 'provider'
  | 'nickname'
  | 'side'
  | 'birth_year'
  | 'employment'
  | 'space_id'
  | 'onboarding_step'
  | 'onboarding_done_at'
>;
export type Space = Tables<'couple_space'>;
export type Goal = Tables<'goal'>;
export type GoalInsert = Database['public']['Tables']['goal']['Insert'];

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export async function fetchMe(): Promise<Me | null> {
  const { data, error } = await supabase()
    .from('app_user')
    .select(
      'id, provider, nickname, side, birth_year, employment, space_id, onboarding_step, onboarding_done_at',
    )
    .maybeSingle();
  fail(error);
  return data;
}

export async function updateMe(
  patch: Pick<
    TablesUpdate<'app_user'>,
    'nickname' | 'side' | 'birth_year' | 'employment' | 'onboarding_step' | 'onboarding_done_at'
  >,
) {
  const me = await fetchMe();
  if (!me) throw new AuthCallError('unknown');
  const { error } = await supabase().from('app_user').update(patch).eq('id', me.id);
  fail(error);
}

/** 내 공간 id(없으면 만듦) */
export async function ensureSpace(): Promise<string> {
  const { data, error } = await supabase().rpc('ensure_my_space');
  fail(error);
  return data as string;
}

export async function fetchSpace(): Promise<Space | null> {
  const { data, error } = await supabase().from('couple_space').select('*').maybeSingle();
  fail(error);
  return data;
}

type SpacePatch = Omit<
  TablesUpdate<'couple_space'>,
  | 'id'
  | 'couple_state'
  | 'created_at'
  | 'created_by'
  | 'updated_at'
  | 'updated_by'
  | 'version'
  | 'deleted_at'
  | 'deleted_by'
>;
export async function updateSpace(patch: SpacePatch) {
  const id = await ensureSpace();
  const { error } = await supabase().from('couple_space').update(patch).eq('id', id);
  fail(error);
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase()
    .from('goal')
    .select('*')
    .is('deleted_at', null)
    .order('priority');
  fail(error);
  return data ?? [];
}

export async function insertGoals(rows: Omit<GoalInsert, 'space_id'>[]) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('goal')
    .insert(rows.map((r) => ({ ...r, space_id })));
  fail(error);
}

export async function updateGoal(id: string, patch: TablesUpdate<'goal'>) {
  const { error } = await supabase().from('goal').update(patch).eq('id', id);
  fail(error);
}

/** 휴지통으로(영구 삭제는 30일 뒤 예약 작업) */
export async function trashGoals(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase()
    .from('goal')
    .update({ deleted_at: new Date().toISOString() }) // 지운 사람은 DB 트리거가 기록
    .in('id', ids);
  fail(error);
}

/** O-07: 쓸 수 있는 초대 코드(없으면 새로) */
export async function createInvite(): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await supabase().rpc('create_invite');
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new AuthCallError('unknown');
  return { code: row.code, expiresAt: row.expires_at };
}

/** O-13 만 18세 미만: 계정 즉시 삭제 */
export async function deleteMinorAccount(birthYear: number) {
  const { error } = await supabase().rpc('delete_minor_account', { p_birth_year: birthYear });
  fail(error);
}
