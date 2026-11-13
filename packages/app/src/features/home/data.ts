import {
  bundleKeys,
  fetchBundles,
  fetchGoalMoves,
  fetchGoals,
  fetchHomeTasks,
  fetchMe,
  fetchMoneyInPeriod,
  fetchOpenRankRequest,
  fetchOpenModeRequest,
  fetchPartner,
  fetchPastChecklists,
  fetchSalaryChanges,
  fetchSavingNotes,
  fetchSharedAccounts,
  fetchSpace,
  fetchUpcomingNotes,
  moneyInKeys,
  qk,
  savingKeys,
  splitAccountKeys,
  subscribeBundles,
  subscribeModeRequests,
  subscribeRankRequests,
  rankKeys,
  subscribeMoneyIns,
  subscribeSalaryChanges,
  subscribeSavingNotes,
  subscribeSharedAccounts,
  manageKeys,
  salaryChangeKeys,
} from '@sweetwo/api';
import { useQueries, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

// 홈 데이터(19 ‘홈 v2.2’). 키는 qk라 다른 기능과 캐시를 같이 쓴다. Realtime은 api 구독 → 같은 키 무효화.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });

/** 같이 모으기 묶음(bundle_view: 합계만·각자 금액·퍼센트만을 서버가 잘라 보냄). 합쳐서 엔진이면 없음 */
export const useBundles = (on: boolean) =>
  useQuery({ queryKey: qk.bundles, queryFn: () => fetchBundles(), enabled: on });

/** 닫거나 끝낸 띠 키(home_task_state) */
export const useHomeTasks = () => useQuery({ queryKey: qk.homeTasks, queryFn: fetchHomeTasks });

/** 날짜 없는 사람의 기간(money_in_period, H-13) */
export const useMoneyInPeriod = (today: string, on: boolean) =>
  useQuery({
    queryKey: qk.moneyInPeriod(today),
    queryFn: () => fetchMoneyInPeriod(today),
    enabled: on,
  });

/** 열린 관리 형태 요청(띠 3번) */
export const useModeRequest = (on: boolean) =>
  useQuery({ queryKey: qk.modeRequests, queryFn: fetchOpenModeRequest, enabled: on });

/** 분담(띠 4번 받은 제안, 8번 정한 분담이 있나) */
export const useSharedAccounts = (on: boolean) =>
  useQuery({ queryKey: qk.sharedAccounts, queryFn: fetchSharedAccounts, enabled: on });

/** 열린 순위 같이 보기 요청(띠 5번) */
export const useRankRequest = (on: boolean) =>
  useQuery({ queryKey: qk.rankRequest, queryFn: fetchOpenRankRequest, enabled: on });

/** 날짜를 정한 월급 변경(띠 6번) */
export const useSalaryChanges = () =>
  useQuery({ queryKey: qk.salaryChanges, queryFn: fetchSalaryChanges });

/** 다가오는 쓸 곳 메모(띠 14번, H-08 캘린더 타일): 오늘부터 7일 */
export const useUpcomingNotes = (from: string, to: string) =>
  useQuery({ queryKey: qk.upcomingNotes(from, to), queryFn: () => fetchUpcomingNotes(from, to) });

/** 대표 저금(또는 묶음)의 쓸 곳 메모(H-12) */
export const useHeroNotes = (o: { goalId?: string; bundleId?: string } | null) =>
  useQuery({
    queryKey: qk.savingNotes(o ?? {}),
    queryFn: () => fetchSavingNotes(o ?? {}),
    enabled: !!o,
  });

/** 내 지난 사이클 확인 목록(늦은 확인, H-11). owner null = 공동 */
export const usePreviousChecklist = (owner: string | null | undefined, before: string | null) =>
  useQuery({
    queryKey: qk.pastChecklists(owner ?? null, before ?? ''),
    queryFn: () => fetchPastChecklists(owner ?? null, before ?? ''),
    enabled: owner !== undefined && !!before,
    select: (rows) => rows[0] ?? null,
  });

/** 대표 저금들의 돈 움직임(H-10 ‘이번 달 +’: 돈 들어왔어요·자동 넣기) */
export function useHeroMoves(goalIds: string[]) {
  return useQueries({
    queries: goalIds.map((id) => ({
      queryKey: qk.goalMoves(id),
      queryFn: () => fetchGoalMoves(id),
    })),
    combine: (rs) => ({
      ready: rs.every((r) => !r.isLoading),
      moves: rs.flatMap((r) => r.data ?? []),
    }),
  });
}

/**
 * 홈 Realtime(19 ‘갱신’): 묶음, 돈 들어왔어요, 쓸 곳 메모, 분담, 관리 형태 요청, 월급 변경이 바뀌면 같은 키를 다시 읽음.
 * 확인 목록·월급 계획·저금은 salary의 useCheckRealtime·useSplitRealtime·useGoalRealtime
 */
export function useHomeRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    const again = (keys: readonly QueryKey[]) => () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [...k] });
    };
    const offs = [
      subscribeBundles(spaceId, again(bundleKeys)),
      subscribeMoneyIns(spaceId, again(moneyInKeys)),
      subscribeSavingNotes(spaceId, again(savingKeys)),
      subscribeSharedAccounts(spaceId, again(splitAccountKeys)),
      subscribeModeRequests(spaceId, again(manageKeys)),
      subscribeSalaryChanges(spaceId, again(salaryChangeKeys)),
      subscribeRankRequests(spaceId, again(rankKeys)),
    ];
    return () => offs.forEach((off) => off());
  }, [spaceId, qc]);
}
