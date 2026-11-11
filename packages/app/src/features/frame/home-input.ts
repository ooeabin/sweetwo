import {
  fetchAssets,
  fetchCareDays,
  fetchChecklistsEnsured,
  fetchGoals,
  fetchMyUnlink,
  fetchUnlink,
  qk,
} from '@sweetwo/api';
import { todayKst, type HomeCare, type HomeInput } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMe, useSpace } from './data';

// 2026-11-11 홈 띠 닫기(✕)를 없애며 쓰지 않게 된 기기 저장 키(닫은 할 일, 초대 닫은 날). 남은 값은 한 번 지움
const OLD_KEYS = ['sweetwo:home:todo-closed', 'sweetwo:home:invite-closed'];
const dropOldKeys = () => {
  try {
    for (const k of OLD_KEYS) localStorage.removeItem(k);
  } catch {
    /* 저장소를 못 쓰면 그대로(읽지 않으니 상관없음) */
  }
};

// 홈(H-06 할 일 띠, H-08 캘린더 타일)이 쓰는 core homeTodo·homeUpcoming 재료. 키는 다른 화면과 같은 qk.
// 재료(체크리스트, 저금, 경조사, 자산, 해제 기록)가 다 온 뒤에만 input을 만듦(2026-11-11 QA 4구간 S4-13):
// 일부만 온 채로 계산하면 할 일 띠가 초대 → 만기처럼 잠깐 바뀌어 보임. 실패한 재료는 빈 값으로 셈
export function useHomeInput() {
  const today = todayKst();
  const me = useMe();
  const space = useSpace();
  const lists = useQuery({
    queryKey: qk.checklists(today),
    queryFn: () => fetchChecklistsEnsured(today),
    enabled: !!me.data?.onboarding_done_at,
  });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const state = space.data?.couple_state;
  const unlink = useQuery({
    queryKey: qk.unlink,
    queryFn: fetchUnlink,
    enabled: state === 'unlink_pending',
  });
  const solo = state === 'solo';
  const myUnlink = useQuery({ queryKey: qk.myUnlink, queryFn: fetchMyUnlink, enabled: solo });
  useEffect(dropOldKeys, []);

  // 켜진 쿼리가 아직 처음 받는 중이면 기다림(꺼진 쿼리·실패한 쿼리는 기다리지 않음)
  const waiting = [lists, goals, cares, assets, unlink, myUnlink].some((q) => q.isLoading);
  const input: HomeInput | null =
    me.data && space.data && goals.data && !waiting
      ? {
          today,
          meId: me.data.id,
          joint: space.data.salary_mode === 'joint',
          coupleState: space.data.couple_state,
          checklists: (lists.data ?? []).map((c) => ({
            owner_user_id: c.owner_user_id,
            label: c.label,
            cycle_start: c.cycle_start,
            cycle_end: c.cycle_end,
            lines: c.pay_check_line,
          })),
          goals: goals.data,
          cares: (cares.data ?? []).map((c): HomeCare => ({
            id: c.id,
            name: c.name,
            date_rule: c.date_rule as HomeCare['date_rule'],
            month: c.month,
            day: c.day,
            leap: c.leap,
            once_on: c.once_on,
          })),
          assets: assets.data ?? [],
          unlinkRequestedBy:
            state === 'unlink_pending' ? (unlink.data?.requested_by ?? null) : null,
          reconnectFrom:
            solo && myUnlink.data?.reconnect_by && !myUnlink.data.reconnect_answer
              ? myUnlink.data.reconnect_by
              : null,
          // 첫 주 할 일 ‘첫 저금 추가’(19 H-06 4b): 온보딩을 마친 날(KST)
          onboardedOn: me.data.onboarding_done_at
            ? todayKst(new Date(me.data.onboarding_done_at))
            : null,
        }
      : null;
  return {
    input,
    /** 연결 해제 대기(19 홈 상태 3번 띠): 확정 날짜, 내가 요청했는지 */
    unlink:
      state === 'unlink_pending' && unlink.data
        ? { deadline: unlink.data.deadline, mine: unlink.data.requested_by === me.data?.id }
        : null,
  };
}
export type HomeInputState = ReturnType<typeof useHomeInput>;
