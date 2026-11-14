import {
  checkPayLine,
  fetchChecklistsEnsured,
  fetchGoalSaved,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchPartnerPlanView,
  fetchSharedAccounts,
  fetchSpace,
  fetchSplits,
  qk,
  splitKeys,
  subscribeCheckLines,
  subscribeGoals,
  subscribeSplits,
  type Goal,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import {
  amountBand,
  checklistFinish,
  daysBetween,
  finishAfter,
  pickMyChecklist,
  todayKst,
  type ChecklistFinish,
} from '@sweetwo/core';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '../../shared/analytics';

// 월급 계획·체크리스트 데이터(docs/spec/20-salary-plan.md). 키는 qk라 온보딩·홈과 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useSplits = () => useQuery({ queryKey: qk.splits, queryFn: fetchSplits });
/**
 * 같이 쓰는 통장 줄 이름(20 W-01 5d, 2026-11-13 UX B M7): 줄에는 이름을 두지 않고(split_line.name은 직접 추가 줄만)
 * shared_account_id로 분담 이름(‘데이트 통장’)을 찾음. 확인 목록 줄은 split_line_id → 월급 계획 줄 → 분담
 */
export function useAccountNames() {
  const splits = useSplits();
  const accounts = useQuery({ queryKey: qk.sharedAccounts, queryFn: fetchSharedAccounts });
  const byAccount = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const byLine = new Map<string, string>();
  for (const sp of splits.data ?? [])
    for (const l of sp.split_line) {
      const n = l.shared_account_id ? byAccount.get(l.shared_account_id) : undefined;
      if (n) byLine.set(l.id, n);
    }
  return {
    ofAccount: (id: string | null | undefined) => (id ? byAccount.get(id) : undefined),
    ofSplitLine: (id: string | null | undefined) => (id ? byLine.get(id) : undefined),
  };
}
/**
 * 상대(각자 계열)의 공개 단계대로 서버가 자른 월급 계획(partner_plan_view). W-01 파트너 탭과 같은 캐시.
 * ‘했어요만’이면 상대 저금은 이름·금액 없이 이번 달 확인 여부만(08 6장, 2026-11-13 P1 = A)
 */
export const usePartnerPlanView = (on: boolean) =>
  useQuery({
    queryKey: qk.partnerPlanView(null),
    queryFn: () => fetchPartnerPlanView(),
    enabled: on,
  });
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

/**
 * 체크 뒤 새로 읽을 것: 체크리스트, 저금 항목 모은 금액, 저금 항목(달성 되돌림·다시 달성, 2026-11-12 S6-04),
 * W-10 저금 내역(qk.goalLines, 2026-11-12 S7-03: 체크·풀기·되돌리기·다른 금액·Realtime 뒤 바로 바뀜)
 */
export const refreshChecks = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
    qc.invalidateQueries({ queryKey: ['pay_check_line'] }),
    qc.invalidateQueries({ queryKey: qk.goalSaved }),
    qc.invalidateQueries({ queryKey: qk.goals }),
  ]);

/** 지금 캐시에 있는 이번 사이클 체크리스트 중 이 줄이 든 것 */
export function listOf(qc: QueryClient, lineId: string): PayChecklist | undefined {
  for (const [, data] of qc.getQueriesData<PayChecklist[]>({ queryKey: ['pay_checklist'] }))
    for (const c of Array.isArray(data) ? data : [])
      if (c.pay_check_line?.some((l) => l.id === lineId)) return c;
  return undefined;
}

// 이 기기가 방금 쓴 줄(상대가 바꾼 줄만 2초 강조하려고, 30 동기화). 5초 뒤 잊음
const localWrites = new Map<string, number>();
export const markLocalWrite = (lineId: string) => localWrites.set(lineId, Date.now());
const wroteHere = (lineId: string) => Date.now() - (localWrites.get(lineId) ?? 0) < 5000;
// 이 기기가 방금 저장한 줄 상태(빠르게 여러 줄을 누르면 캐시를 다시 읽기 전이라, 마지막 줄 판단에 덧씌움). 10초 뒤 잊음
const localStates = new Map<string, { state: string; at: number }>();
export const markLocalState = (lineId: string, state: string) =>
  localStates.set(lineId, { state, at: Date.now() });
/** 캐시의 줄 + 이 기기가 방금 저장한 상태 */
export const withLocal = <T extends { id: string; state: string }>(lines: readonly T[]): T[] =>
  lines.map((l) => {
    const x = localStates.get(l.id);
    return x && Date.now() - x.at < 10_000 ? { ...l, state: x.state } : l;
  });

/** 체크리스트가 다 끝남(checklist_completed, 32 4-4): 끝내기 전 캐시 기준 */
export function trackCompleted(
  list: PayChecklist,
  lines: { id: string; state: string }[],
  meId: string | null | undefined,
) {
  const created = list.created_at ?? `${list.cycle_start}T00:00:00+09:00`;
  track('checklist_completed', {
    hours_since_generated: Math.max(
      0,
      Math.floor((Date.now() - new Date(created).getTime()) / 3_600_000),
    ),
    checked_by_partner_count: list.pay_check_line.filter(
      (l) =>
        l.checked_by &&
        l.checked_by !== meId &&
        lines.some((x) => x.id === l.id && x.state !== 'wait'),
    ).length,
  });
}

export type CheckEntry = 'w02' | 'w05' | 'w10';
export type CheckResult = {
  r: 'ok' | 'already_checked' | 'closed';
  /** 이번 체크로 확인이 끝났으면(마지막 손 줄, 2026-11-13 자동 줄은 셈하지 않음) 그 끝남과 사이클 시작일 */
  finish: { kind: ChecklistFinish; start: string } | null;
};

/**
 * 줄 체크·풀기·못 함(서버 check_pay_line). 끝난 뒤 체크리스트·모은 금액·저금 항목을 다시 읽음.
 * 분석: checklist_line_checked / _unchecked / _skipped, 마지막 줄이면 checklist_completed(32 4-4, 2026-11-12 S6-02)
 */
export function useCheck(entry: CheckEntry = 'w02') {
  const qc = useQueryClient();
  return async (
    line: PayCheckLine,
    state: 'checked' | 'wait' | 'skipped',
    actual?: number,
    via: 'checkbox' | 'toast' = 'checkbox',
  ): Promise<CheckResult> => {
    const list = listOf(qc, line.id);
    const meId = qc.getQueryData<{ id: string }>(qk.me)?.id;
    markLocalWrite(line.id);
    const r = await checkPayLine(line.id, state, actual);
    let finish: CheckResult['finish'] = null;
    if (r === 'ok') {
      const to = state === 'checked' && actual === 0 ? 'skipped' : state;
      const today = todayKst();
      // 늦은 확인(07 4장, 32 0-4 pay_line_late_checked): 지난 사이클 줄을 체크
      if (list && list.cycle_end < today && to === 'checked')
        track('pay_line_late_checked', {
          kind: line.kind,
          days_late: daysBetween(list.cycle_end, today),
        });
      // 자동 줄을 사람이 바꿈(32 0-4 auto_line_changed): 건너뜀 또는 다른 금액
      if (line.auto && (to === 'skipped' || (to === 'checked' && actual !== undefined)))
        track('auto_line_changed', { to: to === 'skipped' ? 'skipped' : 'other_amount' });
      if (to === 'checked') {
        const sent = actual ?? line.planned;
        track('checklist_line_checked', {
          line_kind: line.kind,
          result: sent === line.planned ? 'as_planned' : 'different',
          diff_band: sent === line.planned ? null : amountBand(Math.abs(sent - line.planned)),
          checked_by: list && list.owner_user_id === null ? 'joint' : 'self',
          entry,
          days_from_payday: list ? daysBetween(list.cycle_start, todayKst()) : null,
        });
      } else if (to === 'skipped') track('checklist_line_skipped', { line_kind: line.kind });
      else if (line.state === 'checked')
        track('checklist_line_unchecked', {
          line_kind: line.kind,
          minutes_since_checked: line.checked_at
            ? Math.max(0, Math.floor((Date.now() - new Date(line.checked_at).getTime()) / 60_000))
            : null,
          entry: via,
        });
      if (list && !line.auto) {
        // 확인 끝은 손 줄만(07 7장, 2026-11-13): 자동 줄은 나가는 날 앱이 확인
        const before = withLocal(list.pay_check_line).filter((l) => !l.auto);
        const kind = finishAfter(before, line.id, state, actual);
        if (kind) {
          finish = { kind, start: list.cycle_start };
          track('payday_confirmed', {
            method: entry === 'w05' ? 'w05' : 'line_by_line',
            manual_lines: before.length,
            late: list.cycle_end < today,
          });
          trackCompleted(
            list,
            before.map((l) => (l.id === line.id ? { ...l, state: to } : l)),
            meId,
          );
        }
      }
      markLocalState(line.id, to);
    }
    await refreshChecks(qc);
    return { r, finish };
  };
}

/** 묶음 ‘모두 보냈어요’처럼 여러 줄을 체크한 뒤 체크리스트가 이번에 끝났는지 */
export function finishOfMany(list: PayChecklist | undefined, ids: string[]) {
  if (!list) return null;
  // 이번에 체크한 줄은 ‘전’에는 체크 안 한 줄, 다른 줄은 이 기기가 방금 저장한 상태를 덧씌움
  const before = withLocal(list.pay_check_line)
    .filter((l) => !l.auto)
    .map((l) => (ids.includes(l.id) ? { ...l, state: 'wait' } : l));
  if (checklistFinish(before)) return null;
  const lines = before.map((l) => (ids.includes(l.id) ? { ...l, state: 'checked' } : l));
  const kind = checklistFinish(lines);
  return kind ? { kind, start: list.cycle_start, lines } : null;
}

/**
 * 상대가 방금 바꾼 줄(Realtime으로 다시 읽은 뒤 상태가 바뀌었고 이 기기가 쓰지 않은 줄): 2초 강조(30 동기화, 2026-11-12 S6-06)
 */
export function useChangedLines(lines: readonly PayCheckLine[] | undefined) {
  const prev = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const sig = (lines ?? []).map((l) => `${l.id}:${l.state}:${l.actual ?? ''}`).join('|');
  useEffect(() => {
    const now = new Map((lines ?? []).map((l) => [l.id, `${l.state}:${l.actual ?? ''}`]));
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const ids = [...now]
      .filter(([id, v]) => before.has(id) && before.get(id) !== v && !wroteHere(id))
      .map(([id]) => id);
    if (!ids.length) return;
    setChanged(new Set(ids));
    const t = setTimeout(() => setChanged(new Set()), 2000);
    return () => clearTimeout(t);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return changed;
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
 * 홈 큰 상자(H-03), 월급 탭(W-02), 월급 전 확인(W-05, 2026-11-12 S6-06)에서 한 번(2026-11-11 QA 4구간 S4-02).
 * 저금 항목도 다시 읽어 달성 되돌림·다시 달성이 같은 화면에서 보임(S6-04)
 */
export function useCheckRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeCheckLines(spaceId, () => void refreshChecks(qc));
  }, [spaceId, qc]);
}

/**
 * 상대가 저금을 고치거나 지우면(Realtime goal, 2026-11-12 QA 7구간 S7-02) 저금 항목, 모은 금액, 저금 내역을 바로 다시 읽음.
 * 월급 탭, W-10, W-13에서 한 번
 */
export function useGoalRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeGoals(spaceId, () => {
      for (const k of [qk.goals, qk.goalSaved, ['pay_check_line', 'goal']])
        void qc.invalidateQueries({ queryKey: k });
    });
  }, [spaceId, qc]);
}

/** 저금 화면(W-10, W-13) Realtime: 저금 항목, 체크리스트 줄, 월급 계획(매달 금액) */
export function useSavingRealtime(spaceId: string | null | undefined) {
  useGoalRealtime(spaceId);
  useCheckRealtime(spaceId);
  useSplitRealtime(spaceId);
}
