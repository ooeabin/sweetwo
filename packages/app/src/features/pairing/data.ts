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
import { useGoalSaved, useSplits } from '../salary';

/**
 * 합류 흐름 데이터(18). 2026-11-11 D1: 합류를 마치기 전에는 공간 구성원이 아니라 공간 데이터를 직접 못 읽음.
 * 필요한 것(시작한 사람 호칭, 관리 방식, 월급 계획이 있는지, 대신 입력한 내 명의 항목, 합쳐서면 공동 월급 계획)은 join_context로만.
 */
export function useJoinData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const ctx = useQuery({ queryKey: qk.joinContext, queryFn: fetchJoinContext, retry: 1 });
  const ready = !me.isLoading && !ctx.isLoading;
  const c = ctx.data ?? null;
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
    /** 시작한 사람이 아직 온보딩 중(월급 계획이 없음): P-03 → P-05 → P-05b → 홈 대기 */
    waiting: !!c && !c.has_plan,
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
