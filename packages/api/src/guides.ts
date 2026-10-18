import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 가이드 체크리스트 완료(25 S-02). 부부 공유.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type ChecklistDone = Tables<'checklist_done'>;

export async function fetchChecklistDone(): Promise<ChecklistDone[]> {
  const { data, error } = await supabase().from('checklist_done').select('*');
  fail(error);
  return data ?? [];
}

export async function setChecklistDone(key: string, done: boolean) {
  const { error } = await supabase().rpc('set_checklist_done', { p_key: key, p_done: done });
  fail(error);
}
