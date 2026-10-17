import { fetchCareDays, fetchFamily, fetchGoals, fetchSpace, qk, updateGoal } from '@sweetwo/api';
import { careRound, roundOccurrences, todayKst } from '@sweetwo/core';
import type { QueryClient } from '@tanstack/react-query';
import { recalcPendingShares } from '../proposals';

// ‘양가 비용’ 목표 금액 = 이번 회차 양가 날 쓸 돈 합계(06 10장 ‘자동, 챙길 날에서만 수정’).
// 챙길 날을 넣거나 쓸 돈을 고친 뒤 부름. 회차 날짜(음력 포함)는 core에서 계산하므로 서버 트리거 대신 화면이 맞춤.
// 금액이 바뀌면 안 나눈 몫도 다시 계산.
export async function syncFamilyGoal(qc: QueryClient) {
  const [cares, family, space, goals] = await Promise.all([
    fetchCareDays(),
    fetchFamily(),
    fetchSpace(),
    fetchGoals(),
  ]);
  const goal = goals.find((g) => g.template === 'family_cost');
  if (!goal || !space || space.marriage_status === 'engaged') return;
  const parents = new Set(family.filter((f) => f.relation === 'parent').map((f) => f.id));
  const round = careRound(space.wedding_date ?? null, todayKst());
  const total = roundOccurrences(
    cares.map((c) => ({ ...c, parent: !!c.member_id && parents.has(c.member_id) })),
    round,
  ).reduce((t, o) => t + o.care.budget, 0);
  if (total === goal.target_amount) return;
  await updateGoal(goal.id, { target_amount: total });
  await recalcPendingShares();
  await Promise.all([qk.goals, ['monthly_plan']].map((k) => qc.invalidateQueries({ queryKey: k })));
}
