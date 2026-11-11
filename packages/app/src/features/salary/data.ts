import {
  checkPayLine,
  fetchChecklistsEnsured,
  fetchGoalSaved,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  fetchSplits,
  qk,
  splitKeys,
  subscribeCheckLines,
  subscribeSplits,
  type Goal,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import { pickMyChecklist, todayKst } from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

// 월급 계획·체크리스트 데이터(docs/spec/20-salary-plan.md). 키는 qk라 온보딩·홈과 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useSplits = () => useQuery({ queryKey: qk.splits, queryFn: fetchSplits });
/** 저금 항목별 모은 금액(체크한 저금 합, 06 4장) */
export const useGoalSaved = () => useQuery({ queryKey: qk.goalSaved, queryFn: fetchGoalSaved });

/**
 * 지금 사이클 체크리스트들(각자 = 사람마다, 합쳐서 = 하나). 기준일이 지나 처음 열면
 * 월급 계획마다 이번 사이클 체크리스트를 만들고(서버가 같은 사이클이면 그대로) 읽는다(07 3장).
 */
export function useChecklists() {
  const today = todayKst();
  return useQuery({
    queryKey: qk.checklists(today),
    queryFn: () => fetchChecklistsEnsured(today),
  });
}

/** 줄 상태: 체크 안 한 줄이 남았는지(여유 자금 줄은 없음) */
export const waiting = (c: PayChecklist) => c.pay_check_line.filter((l) => l.state === 'wait');
export const doneCount = (c: PayChecklist) =>
  c.pay_check_line.filter((l) => l.state !== 'wait').length;

/** 체크 뒤 새로 읽을 것: 체크리스트, 저금 항목 모은 금액 */
export function useCheck() {
  const qc = useQueryClient();
  return async (line: PayCheckLine, state: 'checked' | 'wait' | 'skipped', actual?: number) => {
    const r = await checkPayLine(line.id, state, actual);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goalSaved }),
    ]);
    return r;
  };
}

/** 모은 금액(서버 goal_saved_sums, 아직 못 읽었으면 0) */
export const savedOf = (g: Goal, saved: Record<string, number> | undefined) => saved?.[g.id] ?? 0;

/** 내 체크리스트: 내 것 → 공동(core pickMyChecklist, 홈 H-03·H-06과 같은 함수, 2026-11-11 S4-12) */
export const myChecklist = (list: PayChecklist[] | undefined, meId: string | undefined) =>
  pickMyChecklist(list, meId);

/** 월급 계획이 바뀐 뒤 다시 읽기(W-01 줄 RPC, Realtime 신호): 월급 계획, 체크리스트, 저금 항목, 모은 금액 */
export function useSplitRefresh() {
  const qc = useQueryClient();
  return useCallback(
    () => Promise.all(splitKeys.map((k) => qc.invalidateQueries({ queryKey: [...k] }))),
    [qc],
  );
}

/**
 * W-01 줄 쓰기(2026-11-09): 서버 RPC 뒤 splitKeys를 다시 읽음. 실패는 그대로 던짐(화면이 Toast)
 */
export function useSplitWrite() {
  const refresh = useSplitRefresh();
  return useCallback(
    async <T>(job: () => Promise<T>): Promise<T> => {
      try {
        return await job();
      } finally {
        await refresh().catch(() => undefined);
      }
    },
    [refresh],
  );
}

/** 상대가 월급 계획을 바꾸면(Realtime salary_split) 바로 다시 읽음. 월급 탭과 홈(P-WAIT 대기 포함)에서 한 번 */
export function useSplitRealtime(spaceId: string | null | undefined) {
  const refresh = useSplitRefresh();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeSplits(spaceId, () => void refresh());
  }, [spaceId, refresh]);
}

/**
 * 상대가 체크하면(Realtime pay_check_line, 합쳐서 모드 공동 체크리스트) 체크리스트와 모은 금액을 바로 다시 읽음.
 * 홈 큰 상자(H-03)와 월급 탭(W-02)에서 한 번(2026-11-11 QA 4구간 S4-02)
 */
export function useCheckRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeCheckLines(spaceId, () => {
      void qc.invalidateQueries({ queryKey: ['pay_checklist'] });
      void qc.invalidateQueries({ queryKey: qk.goalSaved });
    });
  }, [spaceId, qc]);
}
