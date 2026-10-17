import type { Tables, TablesInsert, TablesUpdate } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace } from './onboarding';

// 캘린더 가족·챙길 날(24 Y-01~Y-05). 같은 공간이면 같이 보고 고침, 지우기는 휴지통
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type FamilyMember = Tables<'family_member'>;
export type CareDay = Tables<'care_day'>;

export async function fetchFamily(): Promise<FamilyMember[]> {
  const { data, error } = await supabase()
    .from('family_member')
    .select('*')
    .is('deleted_at', null)
    .order('sort');
  fail(error);
  return data ?? [];
}
export async function fetchCareDays(): Promise<CareDay[]> {
  const { data, error } = await supabase().from('care_day').select('*').is('deleted_at', null);
  fail(error);
  return data ?? [];
}

/** 가족 여러 명 추가, 만든 id를 넣은 순서대로 */
export async function insertFamily(
  rows: Omit<TablesInsert<'family_member'>, 'space_id'>[],
): Promise<string[]> {
  if (!rows.length) return [];
  const space_id = await ensureSpace();
  const { data, error } = await supabase()
    .from('family_member')
    .insert(rows.map((r) => ({ ...r, space_id })))
    .select('id');
  fail(error);
  return (data ?? []).map((r) => r.id);
}
export async function insertCareDays(rows: Omit<TablesInsert<'care_day'>, 'space_id'>[]) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('care_day')
    .insert(rows.map((r) => ({ ...r, space_id })));
  fail(error);
}
export async function updateCareDay(id: string, patch: TablesUpdate<'care_day'>) {
  const { error } = await supabase().from('care_day').update(patch).eq('id', id);
  fail(error);
}
export async function updateFamily(id: string, patch: TablesUpdate<'family_member'>) {
  const { error } = await supabase().from('family_member').update(patch).eq('id', id);
  fail(error);
}
