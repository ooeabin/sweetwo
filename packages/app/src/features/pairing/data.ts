import {
  fetchGoals,
  fetchJoinContext,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  updateMe,
  updateSpace,
} from '@sweetwo/api';
import { coupleOf } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { onSessionReset } from '../../shared/session-reset';
import { useGoalSaved, useSplits } from '../salary';

/**
 * P-04 ‘월급은 대부분 {시작한 사람}님에게 보내요’(18 v2.2): 합류를 마치기 전에는 공간 구성원이 아니라 요청을 못 보내서
 * 기기에 기억해 두고 합류를 마친 순간 request_mode_change(p04_send). chosen = 골랐음, requested = 보냄(P-11까지 관리하지 않는 쪽 흐름)
 */
type JoinSend = 'chosen' | 'requested' | null;
const SEND_KEY = 'sweetwo.joinSend';
const readSend = (): JoinSend => {
  try {
    const v = localStorage.getItem(SEND_KEY);
    return v === 'chosen' || v === 'requested' ? v : null;
  } catch {
    return null;
  }
};
export const useJoinSend = create<{ send: JoinSend; setSend: (v: JoinSend) => void }>((set) => ({
  send: readSend(),
  setSend: (v) => {
    try {
      if (v) localStorage.setItem(SEND_KEY, v);
      else localStorage.removeItem(SEND_KEY);
    } catch {
      /* 기억 못 하면 이 실행 안에서만 */
    }
    set({ send: v });
  },
}));
onSessionReset(() => useJoinSend.setState({ send: null }));

/**
 * 합류 흐름 데이터(18). 2026-11-11 D1: 합류를 마치기 전에는 공간 구성원이 아니라 공간 데이터를 직접 못 읽음.
 * 필요한 것(시작한 사람 호칭, 관리 방식, 월급 계획이 있는지, 대신 입력한 내 명의 항목, 합쳐서면 공동 월급 계획)은 join_context로만.
 */
export function useJoinData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const ctx = useQuery({ queryKey: qk.joinContext, queryFn: fetchJoinContext, retry: 1 });
  const ready = !me.isLoading && !ctx.isLoading;
  const c = ctx.data ?? null;
  const send = useJoinSend((x) => x.send);
  const joint = c?.salary_mode === 'joint';
  return {
    ready,
    me: me.data ?? null,
    ctx: c,
    /** 합류 중이 아님(시작한 사람이 초대를 취소했거나 잡아 둔 24시간이 지남) */
    ended: ready && !ctx.isError && !c,
    error: ctx.isError,
    /** 시작한 사람 호칭(없으면 빈 글자, 문구가 ‘파트너’로 바꿈) */
    starterName: c?.starter_nickname ?? '',
    salaryMode: c?.salary_mode ?? ('separate' as const),
    /**
     * 시작한 사람이 아직 온보딩 중(월급 계획이 없음) + 같이 계열: P-03 → P-05 → P-05b → 홈 대기(‘알려 주기’).
     * 각자 계열은 기다리지 않고 내 월급 계획을 만듦(18 v2.2). 형태를 아직 안 골랐으면 각자 계열로 봄
     */
    waiting: !!c && joint && !c.has_plan,
    /** 시작한 사람이 형태를 골랐는지(P-04 형태 이름 확인을 보여 줄지) */
    styleChosen: c?.shared_living != null,
    /** 형태 이름 코드(08 2장) */
    style: c?.style ?? (joint ? ('together' as const) : ('separate' as const)),
    /** P-04 ‘보내요’를 고름(합류를 마치면 요청) */
    send,
    /**
     * 한 사람 관리형에서 관리하지 않는 쪽(P-05c 용돈, ‘보내기’ + ‘용돈’ 자동 줄): 같이 계열 + 시작한 사람이 관리,
     * 또는 각자 계열에서 P-04 ‘보내요’를 고름
     */
    nonManager: (joint && c?.manager === 'starter') || (!joint && !!send),
    /** 대기 뒤 이어서(P-04 → 홈) */
    resumed: me.data?.onboarding_step === 'P-WAIT',
    refetch: async () => {
      const [m, x] = await Promise.all([me.refetch(), ctx.refetch()]);
      if (x.isError) throw x.error;
      return { me: m.data ?? null, ctx: x.data ?? null };
    },
  };
}
export type JoinData = ReturnType<typeof useJoinData>;

/** 예전에 P-06에서 멈춘 사람만(이미 공간 구성원): 공간 데이터를 그대로 읽음 */
export function useMemberJoinData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const splits = useSplits();
  const saved = useGoalSaved();
  const ready = [me, space, partner, goals, splits, saved].every((q) => !q.isLoading);
  const couple = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    ready,
    me: me.data ?? null,
    space: space.data ?? null,
    partner: partner.data ?? null,
    goals: goals.data ?? [],
    saved: saved.data,
    splits: splits.data ?? [],
    couple,
  };
}

export const saveMe = updateMe;
export const saveSpace = updateSpace;
