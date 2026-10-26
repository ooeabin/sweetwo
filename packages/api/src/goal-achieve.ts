import { AuthCallError } from './auth';
import { supabase } from './client';

// 목표 달성(22 G-05): 달성 표시와 축하 한 번, 축하 문장 재료, 사용 기록, 남은 돈 다른 목표로.
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

/** 배우자가 먼저 기록함 */
export class GoalUsedError extends Error {
  constructor() {
    super('already_used');
  }
}

/** 사용 기록(G-05): 쓴 돈만큼 꺼내 쓰기 + 사용 완료. 남은 돈(모은 돈 − 쓴 돈)을 돌려줌 */
export async function finishGoalUse(goalId: string, spent: number): Promise<number> {
  const { data, error } = await supabase().rpc('finish_goal_use', { p_goal: goalId, p_spent: spent });
  if (error?.message?.includes('goal_used')) throw new GoalUsedError();
  fail(error);
  return typeof data === 'number' ? data : 0;
}

/** 남은 돈을 다른 목표(비상금 포함)로 모두 옮김. 옮긴 금액 */
export async function moveGoalSaved(goalId: string, to: string): Promise<number> {
  const { data, error } = await supabase().rpc('move_goal_saved', { p_goal: goalId, p_to: to });
  fail(error);
  return typeof data === 'number' ? data : 0;
}
