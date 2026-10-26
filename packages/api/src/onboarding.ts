import type { Database, Tables, TablesUpdate } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 온보딩 서버 호출. 저장은 화면을 넘길 때마다(docs/spec/12-question-pattern.md ‘자동 저장’).
export type Me = Pick<
  Tables<'app_user'>,
  | 'id'
  | 'provider'
  | 'nickname'
  | 'side'
  | 'birth_year'
  | 'birth_month'
  | 'birth_day'
  | 'employment'
  | 'space_id'
  | 'onboarding_step'
  | 'onboarding_done_at'
  | 'monthly_income'
  | 'income_variable'
  | 'payday'
  | 'payday_last'
  | 'allowance'
  | 'card_main'
  | 'other_income'
  | 'notify_email'
  | 'noti_prefs'
  | 'quiet_start'
  | 'quiet_end'
  | 'default_visibility'
  | 'analytics_off'
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
      'id, provider, nickname, side, birth_year, birth_month, birth_day, employment, space_id, onboarding_step, onboarding_done_at, monthly_income, income_variable, payday, payday_last, allowance, card_main, other_income, notify_email, noti_prefs, quiet_start, quiet_end, default_visibility, analytics_off',
    )
    .maybeSingle();
  fail(error);
  return data;
}

export async function updateMe(
  patch: Pick<
    TablesUpdate<'app_user'>,
    | 'nickname'
    | 'side'
    | 'birth_year'
    | 'birth_month'
    | 'birth_day'
    | 'employment'
    | 'onboarding_step'
    | 'onboarding_done_at'
    | 'monthly_income'
    | 'income_variable'
    | 'payday'
    | 'payday_last'
    | 'allowance'
    | 'card_main'
    | 'notify_email'
    | 'noti_prefs'
    | 'quiet_start'
    | 'quiet_end'
    | 'default_visibility'
    | 'analytics_off'
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

/** 목표 하나 추가하고 id(가진 자산 연결용) */
export async function insertGoal(row: Omit<GoalInsert, 'space_id'>): Promise<string> {
  const space_id = await ensureSpace();
  const { data, error } = await supabase()
    .from('goal')
    .insert({ ...row, space_id })
    .select('id')
    .single();
  fail(error);
  return data?.id ?? '';
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

/** O-13, P-04 만 18세 미만(생년월일 'YYYY-MM-DD'): 계정 즉시 삭제 */
export async function deleteUnderageAccount(birthDate: string) {
  const { error } = await supabase().rpc('delete_underage_account', { p_birth_date: birthDate });
  fail(error);
}

/** 배우자 생일(월, 일). 없으면 null. 캘린더 서프라이즈 생일 미리 채움 */
export async function fetchPartnerBirthday(): Promise<{ month: number; day: number } | null> {
  const { data, error } = await supabase().rpc('partner_birthday');
  fail(error);
  return Array.isArray(data) ? (data[0] ?? null) : null;
}

/** O-13 만 18세 미만: 계정 즉시 삭제 */
export async function deleteMinorAccount(birthYear: number) {
  const { error } = await supabase().rpc('delete_minor_account', { p_birth_year: birthYear });
  fail(error);
}

// 고정지출 항목(O-36)
export type FixedExpense = Tables<'fixed_expense'>;
export async function fetchFixedExpenses(): Promise<FixedExpense[]> {
  const { data, error } = await supabase()
    .from('fixed_expense')
    .select('*')
    .is('deleted_at', null)
    .order('sort');
  fail(error);
  return data ?? [];
}
export async function insertFixedExpenses(
  rows: Pick<FixedExpense, 'group_key' | 'name' | 'burden' | 'sort'>[],
) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('fixed_expense')
    .insert(rows.map((r) => ({ ...r, space_id })));
  fail(error);
}
/** O-37 항목별 금액 */
export async function updateFixedExpense(id: string, patch: Pick<FixedExpense, 'monthly_amount'>) {
  const { error } = await supabase().from('fixed_expense').update(patch).eq('id', id);
  fail(error);
}
export async function trashFixedExpenses(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase()
    .from('fixed_expense')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  fail(error);
}

// 통장(O-63)
export type Account = Tables<'account'>;
export type AccountRole = Account['role'];
export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase()
    .from('account')
    .select('*')
    .is('deleted_at', null)
    .order('sort');
  fail(error);
  return data ?? [];
}
type AccountPatch = Pick<Account, 'role' | 'name' | 'is_existing' | 'start_balance' | 'sort'>;
/** 역할마다 하나: 있으면 고치고 없으면 추가 */
export async function saveAccounts(rows: AccountPatch[], existing: Account[]) {
  const space_id = await ensureSpace();
  for (const r of rows) {
    const cur = existing.find((a) => a.role === r.role);
    const { error } = cur
      ? await supabase().from('account').update(r).eq('id', cur.id)
      : await supabase()
          .from('account')
          .insert({ ...r, space_id });
    fail(error);
  }
}
export async function trashAccounts(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase()
    .from('account')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  fail(error);
}

// 배우자 프로필(같은 공간 다른 사람). 없으면 null
export type PartnerProfile = {
  id: string;
  nickname: string | null;
  side: 'groom' | 'bride' | null;
  employment: Me['employment'];
  monthly_income: number | null;
  income_variable: boolean;
  payday: number | null;
  payday_last: boolean;
  allowance: number | null;
  /** 다른 수입 월 합계(O-35b) */
  other_income: number;
};
export async function fetchPartner(): Promise<PartnerProfile | null> {
  const { data, error } = await supabase().rpc('partner_profile');
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  return (row as PartnerProfile | undefined) ?? null;
}

