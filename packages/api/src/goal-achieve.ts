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

export type GoalPaidFrom = 'goal_fund' | 'living' | 'personal';
export interface GoalUseResult {
  /** 넣은 나누기 줄 금액(생활비로 냈을 때) */
  line: number;
  /** 옮긴 남은 돈 */
  rest: number;
  restGoal: string | null;
  /** 남은 돈 옮김 기록(‘다른 목표로’에 씀) */
  use: string | null;
}

/** 사용 기록: 썼어요(낸 곳) / 다른 자산으로 옮겼어요. held = 화면이 본 보유액 */
export async function recordGoalUse(p: {
  goalId: string;
  kind: 'spent' | 'moved';
  amount: number;
  paidFrom: GoalPaidFrom;
  assetId: string | null;
  held: number;
}): Promise<GoalUseResult> {
  const { data, error } = await supabase().rpc('use_goal', {
    p_goal: p.goalId,
    p_kind: p.kind,
    p_amount: p.amount,
    p_paid_from: p.paidFrom,
    p_held: p.held,
    ...(p.assetId ? { p_asset: p.assetId } : {}),
  });
  if (error?.message?.includes('already_used')) throw new GoalUsedError();
  fail(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    line: Number(r.line ?? 0),
    rest: Number(r.rest ?? 0),
    restGoal: typeof r.rest_goal === 'string' ? r.rest_goal : null,
    use: typeof r.use === 'string' ? r.use : null,
  };
}

/** 남은 돈을 다른 목표로 */
export async function moveGoalRest(useId: string, goalId: string) {
  const { error } = await supabase().rpc('move_goal_rest', { p_use: useId, p_goal: goalId });
  fail(error);
}
