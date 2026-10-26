import {
  checkPayLine,
  fetchCurrentChecklists,
  fetchGoalCheckedSums,
  fetchGoalSaved,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  fetchSplits,
  qk,
  startChecklist,
  type Goal,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// 월급 분배표·체크리스트 데이터(docs/spec/20-salary-plan.md). 키는 qk라 온보딩·홈과 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useSplits = () => useQuery({ queryKey: qk.splits, queryFn: fetchSplits });
export const useGoalCheckedSums = () =>
  useQuery({ queryKey: qk.goalCheckedSums, queryFn: fetchGoalCheckedSums });
/** 목표별 모은 돈(이미 모은 돈 + 체크한 저금 + 넣기 − 빼기 − 꺼내 쓰기) */
export const useGoalSaved = () => useQuery({ queryKey: qk.goalSaved, queryFn: fetchGoalSaved });

/**
 * 지금 사이클 체크리스트들(각자 = 사람마다, 합쳐서 = 하나). 기준일이 지나 처음 열면
 * 분배표마다 이번 사이클 체크리스트를 만들고(서버가 같은 사이클이면 그대로) 읽는다(07 3장).
 */
export function useChecklists() {
  const today = todayKst();
  return useQuery({
    queryKey: qk.checklists(today),
    queryFn: async () => {
      const splits = await fetchSplits();
      await Promise.all(
        splits.map((s) => startChecklist(s.owner_user_id ?? undefined).catch(() => null)),
      );
      return fetchCurrentChecklists(today);
    },
  });
}

/** 줄 상태: 체크 안 한 줄이 남았는지(남는 돈 줄은 없음) */
export const waiting = (c: PayChecklist) => c.pay_check_line.filter((l) => l.state === 'wait');
export const doneCount = (c: PayChecklist) =>
  c.pay_check_line.filter((l) => l.state !== 'wait').length;

/** 체크 뒤 새로 읽을 것: 체크리스트, 목표 모은 돈 */
export function useCheck() {
  const qc = useQueryClient();
  return async (line: PayCheckLine, state: 'checked' | 'wait' | 'skipped', actual?: number) => {
    const r = await checkPayLine(line.id, state, actual);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goalCheckedSums }),
      qc.invalidateQueries({ queryKey: qk.goalSaved }),
    ]);
    return r;
  };
}

/** 모은 돈(서버 goal_saved_sums, 아직 못 읽었으면 이미 모은 돈) */
export const savedOf = (g: Goal, saved: Record<string, number> | undefined) =>
  saved?.[g.id] ?? g.other_held;

/** 내 체크리스트: 각자면 내 것, 합쳐서면 공동 */
export const myChecklist = (list: PayChecklist[] | undefined, meId: string | undefined) =>
  list?.find((c) => c.owner_user_id === meId) ?? list?.find((c) => c.owner_user_id === null);
