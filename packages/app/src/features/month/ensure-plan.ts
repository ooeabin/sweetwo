import {
  createCyclePlan,
  fetchIncomePeriods,
  fetchLastPlanEnd,
  qk,
  type FirstPlanLine,
} from '@sweetwo/api';
import {
  coupleOf,
  currentCycle,
  periodIncome,
  spaceBaseDay,
  splitLines,
  todayKst,
  type PlanParts,
  type SplitMode,
} from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { calc } from '../onboarding';
import { useCurrentPlan, useGoals, useMe, usePartner, useSpace } from './data';

// 다음 사이클 월급 플랜(07 월 사이클 2·3장): 기준일이 지났는데 오늘이 든 플랜이 없으면, 그 시점 값으로 계산해 만듦.
// 계산은 온보딩 결과(O-66)와 같은 core 규칙(플랜 요약 → 목표 배분 → 통장별 금액 → 분담). 첫 사이클(O-66) 전에는 만들지 않음.
// 서버 create_cycle_plan이 같은 사이클은 한 번만 만들고, 해제 대기 중이면 지난 플랜을 연장함.

const roleOf = (key: keyof PlanParts, separate: boolean) =>
  key === 'living'
    ? 'living'
    : key === 'emergency'
      ? 'emergency'
      : separate
        ? 'wedding'
        : 'goal_fund';

export function useEnsurePlan() {
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const plan = useCurrentPlan();
  const last = useQuery({ queryKey: qk.lastPlanEnd, queryFn: fetchLastPlanEnd });
  const periods = useQuery({ queryKey: qk.incomePeriods, queryFn: fetchIncomePeriods });
  const tried = useRef<string | null>(null);

  useEffect(() => {
    const sp = space.data;
    const m = me.data;
    if (
      !sp ||
      !m ||
      !goals.data ||
      plan.isLoading ||
      plan.data ||
      last.isLoading ||
      periods.isLoading
    )
      return;
    if (!last.data || !m.onboarding_done_at) return; // 첫 플랜 전
    const c0 = coupleOf(m, sp, partner.data ?? null);
    const base = spaceBaseDay(sp, c0);
    if (base === null) return;
    const cycle = currentCycle(base);
    // 기간 수입 변경(F-05f): 그 달이 든 기간이 있으면 그 수입으로 계산(보충 줄은 서버가 넣음)
    const ps = periods.data ?? [];
    const myIncome = periodIncome(m.id, c0.myIncome, ps, cycle.labelMonth);
    const partnerIncome = partner.data
      ? periodIncome(partner.data.id, c0.partnerIncome, ps, cycle.labelMonth)
      : c0.partnerIncome;
    const c = { ...c0, myIncome, partnerIncome };
    if (last.data >= cycle.start || tried.current === cycle.start) return;
    tried.current = cycle.start;

    const separate = sp.marriage_status === 'engaged' && sp.prep_money_mode === 'separate';
    const unknown = c.solo || c.partnerUnknown;
    let mode: SplitMode = sp.split_mode ?? 'half';
    if (sp.split_deferred || (unknown && mode === 'income')) mode = 'half';
    const r = calc({
      plan: {
        myIncome: c.myIncome,
        partnerIncome: c.solo ? null : c.partnerIncome,
        partnerUnknown: unknown,
        myAllowance: c.myAllowance,
        partnerAllowance: c.partnerAllowance,
        fixedTotal: sp.fixed_total,
        loanRepayment: sp.loan_repayment,
        livingBudget: sp.living_budget,
        mySharePct: c.solo ? 100 : c.myRatio,
      },
      goals: goals.data,
      employments: [m.employment, partner.data?.employment],
      separate,
      split: {
        mode,
        myRatio: c.myRatio,
        myIncome: c.myIncome ?? 0,
        partnerIncome: c.partnerIncome ?? 0,
      },
    });
    // 통장 방식은 다음 플랜부터(S-10a): 바뀔 값으로 줄을 만듦
    const roles = (sp.account_mode_next ?? sp.account_mode) === 'roles';
    const groom = m.side !== 'bride';
    const accountLines: FirstPlanLine[] =
      separate || (roles && c.joined)
        ? splitLines(r.parts, {
            mode,
            myIncome: c.myIncome ?? 0,
            partnerIncome: c.partnerIncome ?? 0,
            myRatio: c.myRatio,
          })
            .filter((l) => l.amount > 0)
            .map((l) => ({
              target: 'account',
              account_role: roleOf(l.key, separate),
              amount: l.amount,
              amount_groom: groom ? l.me : l.partner,
              amount_bride: groom ? l.partner : l.me,
            }))
        : [];
    const goalLines: FirstPlanLine[] = r.alloc.lines
      .filter((l) => l.alloc > 0)
      .map((l) => ({ target: 'goal', goal_id: l.goal.id, amount: l.alloc }));
    const estimated =
      !c.solo &&
      (!c.joined ||
        sp.partner_income_estimated ||
        sp.fixed_total_estimated ||
        sp.living_budget_estimated ||
        sp.wedding_budget_estimated ||
        sp.wedding_date_estimated);
    void createCyclePlan({
      labelMonth: `${cycle.labelMonth}-01`,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      isTemp: estimated,
      snapshot: {
        baseDay: base,
        parts: { ...r.parts },
        income: r.plan.income,
        saveable: r.plan.saveable,
        basis: r.plan.basis,
      },
      lines: [...accountLines, ...goalLines],
    })
      .then(() =>
        Promise.all(
          [qk.currentPlan(todayKst()), qk.lastPlanEnd, qk.space].map((k) =>
            qc.invalidateQueries({ queryKey: k }),
          ),
        ),
      )
      .catch(() => {
        tried.current = null; // 다음에 다시
      });
  }, [
    space.data,
    me.data,
    partner.data,
    goals.data,
    plan.data,
    plan.isLoading,
    last.data,
    last.isLoading,
    periods.data,
    periods.isLoading,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
}
