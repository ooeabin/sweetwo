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
import { useState } from 'react';
import { useMe, useSpace } from './data';

const INVITE_KEY = 'sweetwo:home:invite-closed'; // 초대 할 일 닫은 날(7일 동안 안 보임)
const TODO_KEY = 'sweetwo:home:todo-closed'; // 닫은 만기·챙길 날 할 일(항목 + 날짜)

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 저장소를 못 쓰면 이번 실행에서만 닫음 */
  }
};
const readList = (): string[] => {
  try {
    const v: unknown = JSON.parse(read(TODO_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// 홈(H-05·H-06)과 트레이 위젯이 같이 쓰는 core homeTodo·upcoming·salaryState 재료. 키는 다른 화면과 같은 qk.
/** on = false면 읽지 않음(트레이 위젯이 없는 웹·모바일) */
export function useHomeInput(on = true) {
  const today = todayKst();
  const me = useMe();
  const space = useSpace();
  const lists = useQuery({
    queryKey: qk.checklists(today),
    queryFn: () => fetchChecklistsEnsured(today),
    enabled: on && !!me.data?.onboarding_done_at,
  });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals, enabled: on });
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays, enabled: on });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets, enabled: on });
  const state = space.data?.couple_state;
  const unlink = useQuery({
    queryKey: qk.unlink,
    queryFn: fetchUnlink,
    enabled: on && state === 'unlink_pending',
  });
  const solo = state === 'solo';
  const myUnlink = useQuery({ queryKey: qk.myUnlink, queryFn: fetchMyUnlink, enabled: on && solo });
  const [inviteClosedOn, setInvite] = useState(() => read(INVITE_KEY));
  const [closed, setClosed] = useState(readList);

  const input: HomeInput | null =
    on && me.data && space.data && goals.data && !lists.isLoading
      ? {
          today,
          meId: me.data.id,
          joint: space.data.salary_mode === 'joint',
          coupleState: space.data.couple_state,
          checklists: (lists.data ?? []).map((c) => ({
            owner_user_id: c.owner_user_id,
            label: c.label,
            cycle_end: c.cycle_end,
            lines: c.pay_check_line,
          })),
          goals: goals.data,
          cares: (cares.data ?? []).map(
            (c): HomeCare => ({
              id: c.id,
              name: c.name,
              date_rule: c.date_rule as HomeCare['date_rule'],
              month: c.month,
              day: c.day,
              leap: c.leap,
              once_on: c.once_on,
            }),
          ),
          assets: assets.data ?? [],
          unlinkRequestedBy: state === 'unlink_pending' ? (unlink.data?.requested_by ?? null) : null,
          reconnectFrom:
            solo && myUnlink.data?.reconnect_by && !myUnlink.data.reconnect_answer
              ? myUnlink.data.reconnect_by
              : null,
          inviteClosedOn,
          closed,
        }
      : null;
  return {
    input,
    /** 만기·챙길 날 할 일 닫기(그 항목·날짜만) */
    closeTodo: (key: string) => {
      const next = [...closed.slice(-30), key];
      write(TODO_KEY, JSON.stringify(next));
      setClosed(next);
    },
    /** 초대 할 일 닫기(7일) */
    closeInvite: () => {
      write(INVITE_KEY, today);
      setInvite(today);
    },
  };
}
export type HomeInputState = ReturnType<typeof useHomeInput>;
