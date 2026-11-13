import { HomeTaskStateSchema } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 홈 할 일 띠 닫기·끝냄(19 ‘할 일 띠 순서 v2.2’, home_task_state, 서버 dismiss_home_task). 본인 것만 읽음.
// 키: split_suggest(8번 ‘이미 정했어요’), auto_pick(9번 고름), reconcile:YYYY-MM-DD(12번) 등 core pickTopTask 키

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 닫거나 끝낸 띠 키 목록(core pickTopTask closedKeys) */
export async function fetchHomeTasks(): Promise<string[]> {
  const { data, error } = await supabase().from('home_task_state').select('*');
  fail(error);
  return (data ?? []).map((r) => HomeTaskStateSchema.parse(r).task_key);
}

/** 띠 닫기(‘이미 정했어요’ 등) 또는 끝냄 기록. 키는 영문 소문자·숫자·_:.- 2~60자 */
export async function dismissHomeTask(key: string, state: 'dismissed' | 'done' = 'dismissed') {
  const { error } = await supabase().rpc('dismiss_home_task', { p_key: key, p_state: state });
  fail(error);
}
