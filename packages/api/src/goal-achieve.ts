import { AuthCallError } from './auth';
import { supabase } from './client';

// 저금 항목 목표 금액 달성(20 W-12): 달성 표시와 축하 한 번, 축하 문장 재료.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 달성 표시. true = 이 사람이 축하 화면을 처음 봄 */
export async function achieveGoal(goalId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('achieve_goal', { p_goal: goalId });
  fail(error);
  return data === true;
}

/** 축하 문장 재료: 모은 달 수, 둘이 함께 넣은 달 수 */
export async function fetchGoalStory(
  goalId: string,
): Promise<{ months: number; together: number }> {
  const { data, error } = await supabase().rpc('goal_story', { p_goal: goalId });
  fail(error);
  const r = data?.[0];
  return { months: r?.months ?? 0, together: r?.together ?? 0 };
}
