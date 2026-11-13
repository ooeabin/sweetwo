import {
  bundleKeys,
  fetchBundles,
  fetchGoalMoves,
  fetchMyMoveReasons,
  fetchSavingNotes,
  moneyInKeys,
  qk,
  savingKeys,
  subscribeBundles,
  subscribeMoneyIns,
  subscribeSavingNotes,
} from '@sweetwo/api';
import type { BundleViewResponse } from '@sweetwo/core';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// 같이 모으기와 돈 기록 데이터(20 ‘월급 탭 v2.2’ W-10·W-13·W-14·W-15·W-20, ADR 0009).
// 묶음은 서버 bundle_view가 합계만·각자 금액·퍼센트만을 잘라 보냄(앱은 그대로 그림).

/** 내 공간의 닫히지 않은 묶음(bundle_view) */
export const useBundles = () => useQuery({ queryKey: qk.bundles, queryFn: () => fetchBundles() });

/** 저금이 든 묶음(없으면 undefined) */
export const bundleOfGoal = (bundles: readonly BundleViewResponse[] | undefined, goalId: string) =>
  bundles?.find((b) => b.goals.some((g) => g.id === goalId));

/** 한 저금의 돈 움직임(goal_move_public, 사유 글 없음) */
export const useGoalMoves = (goalId: string, enabled = true) =>
  useQuery({
    queryKey: qk.goalMoves(goalId),
    queryFn: () => fetchGoalMoves(goalId),
    enabled: enabled && !!goalId,
  });

/** 내가 넣은 움직임의 사유 글(본인만, goal_move_reasons) */
export const useMoveReasons = (goalId: string, enabled = true) =>
  useQuery({
    queryKey: qk.goalMoveReasons(goalId),
    queryFn: () => fetchMyMoveReasons(goalId),
    enabled: enabled && !!goalId,
  });

/** 저금 또는 묶음 하나의 쓸 곳 메모 */
export const useSavingNotes = (o: { goalId?: string; bundleId?: string }) =>
  useQuery({
    queryKey: qk.savingNotes(o),
    queryFn: () => fetchSavingNotes(o),
    enabled: !!(o.goalId || o.bundleId),
  });

/** 바로잡기·냈어요·잔액 맞추기·묶음 뒤 다시 읽기(저금, 모은 금액, 움직임, 묶음, 메모, 체크 줄) */
export const refreshSaving = (qc: QueryClient) =>
  Promise.all(
    [...savingKeys, ['pay_check_line'], ['pay_checklist']].map((k) =>
      qc.invalidateQueries({ queryKey: [...k] }),
    ),
  );

/** 묶음을 만들거나 고친 뒤 */
export const refreshBundles = (qc: QueryClient) =>
  Promise.all([...bundleKeys, qk.splits].map((k) => qc.invalidateQueries({ queryKey: [...k] })));

/** 돈 들어왔어요 뒤 */
export const refreshMoneyIn = (qc: QueryClient) =>
  Promise.all(moneyInKeys.map((k) => qc.invalidateQueries({ queryKey: [...k] })));

/**
 * 상대가 묶음·쓸 곳 메모를 바꾸면(Realtime saving_bundle, saving_note) 바로 다시 읽음. 돈 들어왔어요(money_in)도.
 * W-10, W-13, W-14, W-15a에서 한 번
 */
export function useTogetherRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    const offs = [
      subscribeBundles(spaceId, () => void refreshBundles(qc)),
      subscribeSavingNotes(spaceId, () => void qc.invalidateQueries({ queryKey: ['saving_note'] })),
      subscribeMoneyIns(spaceId, () => void refreshMoneyIn(qc)),
    ];
    return () => offs.forEach((off) => off());
  }, [spaceId, qc]);
}
