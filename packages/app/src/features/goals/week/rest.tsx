import { restGoalScreens, type RestGoalScreen } from '@sweetwo/core';
import { Navigate } from 'react-router-dom';
import { useGoalsData } from '../data';

// 첫 주 5일째 ‘나머지 목표·상여금·다른 수입’(16 O-22~25 → 17 O-34~35b) 경로.
// 화면을 끝낼 때마다 /goals/week/next로 가면 서버 값으로 남은 화면을 다시 세서 첫 화면을 연다. 없으면 상여금(O-34)
export const restPath = {
  order: '/goals/week',
  next: '/goals/week/next',
  q: (id: string, i: number) => `/goals/week/${id}/q/${i}`,
  deadline: (id: string) => `/goals/week/${id}/deadline`,
  held: (id: string) => `/goals/week/${id}/held`,
  income: '/assets/week/bonus',
};
export const pathOf = (x: RestGoalScreen | undefined) =>
  !x
    ? restPath.income
    : x.screen === 'q'
      ? restPath.q(x.goalId, x.index)
      : x.screen === 'deadline'
        ? restPath.deadline(x.goalId)
        : restPath.held(x.goalId);

export function useRest() {
  const d = useGoalsData();
  const separate =
    d.space?.marriage_status === 'engaged' && d.space?.prep_money_mode === 'separate';
  const list = restGoalScreens(d.goals, separate);
  return { d, list, total: list.length };
}

/** 남은 첫 화면으로 */
export function RestGoalNext() {
  const { d, list } = useRest();
  if (d.loading) return null;
  return <Navigate to={pathOf(list[0])} replace />;
}
