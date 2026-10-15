import { fetchGoalRecords, fetchGoals, fetchMe, fetchPartner, fetchSpace, qk } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';
import { goalsView } from './view';

// 목표 화면 데이터. 키는 다른 기능과 같은 qk.
export function useGoalsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const records = useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
  const all = [me, space, partner, goals, records];
  const loading = all.some((q) => q.isLoading);
  const failed = all.some((q) => q.isError);
  const view =
    me.data && space.data && goals.data && records.data
      ? goalsView({
          me: me.data,
          space: space.data,
          partner: partner.data ?? null,
          goals: goals.data,
          records: records.data,
        })
      : null;
  return { loading, failed, view, retry: () => all.forEach((q) => void q.refetch()) };
}
