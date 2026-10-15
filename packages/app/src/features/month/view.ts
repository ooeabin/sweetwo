import type { Goal, Me, MonthlyPlan, PartnerProfile, PlanLine, Space } from '@sweetwo/api';
import {
  allocate,
  coupleBaseDay,
  coupleOf,
  currentCycle,
  dateToYm,
  daysBetween,
  goalHeld,
  inClosePeriod,
  livingLeft,
  monthsBetween,
  planSummary,
  readPlanSnapshot,
  splitShares,
  thisMonth,
  todayKst,
  upcoming,
  weddingStatus,
  type AllocGoal,
  type BaseDay,
  type PlanParts,
  type TodoState,
} from '@sweetwo/core';

// 이번 달 화면에 보일 값(docs/spec/19-this-month.md). 계산 규칙은 core, 여기서는 답과 플랜을 모아 넘기기만.

export interface MonthInput {
  me: Me;
  space: Space;
  goals: Goal[];
  plan: (MonthlyPlan & { lines: PlanLine[] }) | null;
  /** 배우자 프로필(합류 뒤) */
  partner?: PartnerProfile | null;
  /** 이번 달 변동 항목 입력 합계(W-04j, 큰 지출 제외) */
  spentVariable?: number;
  /** 이번 플랜 월말 정리를 끝냄 */
  closeDone?: boolean;
  /** 목표별 월말 정리에서 넣은 돈 누적(보유액 = 기타 보유액 + 이것, 06 5-4) */
  goalDeposits?: Record<string, number>;
  now?: Date;
}

const toAllocGoal = (g: Goal, deposits = 0): AllocGoal => ({
  id: g.id,
  template: g.template,
  name: g.name,
  kind: g.kind,
  priority: g.priority,
  target: g.target_amount,
  held: goalHeld(g.other_held, deposits),
  deadline: g.deadline ? dateToYm(g.deadline) : null,
  afterMarriage: g.after_marriage,
  paused: g.status === 'paused',
});

export function monthView({
  me,
  space: sp,
  goals,
  plan,
  partner = null,
  spentVariable = 0,
  closeDone = false,
  goalDeposits = {},
  now = new Date(),
}: MonthInput) {
  const today = todayKst(now);
  const joined = sp.couple_state === 'connected';
  const solo = sp.couple_state === 'solo';
  const engaged = sp.marriage_status === 'engaged';
  const separate = engaged && sp.prep_money_mode === 'separate';
  // 월급 나누기는 합류했고 통장 역할을 나눈 부부만(각자 관리 예비부부는 결혼 자금 모으기)
  const hasSplit = joined && sp.account_mode === 'roles' && !separate;

  const c = coupleOf(me, sp, partner);
  const myPayday = c.myPayday;
  const base: BaseDay | null = sp.base_day_last ? 'last' : (sp.base_day ?? coupleBaseDay(c));
  const computed = base === null ? null : currentCycle(base, now);
  const cycle = plan
    ? {
        start: plan.cycle_start,
        end: plan.cycle_end,
        labelMonth: plan.label_month.slice(0, 7),
        days: daysBetween(plan.cycle_start, plan.cycle_end) + 1,
      }
    : computed;
  const month = cycle ? Number(cycle.labelMonth.slice(5, 7)) : Number(today.slice(5, 7));
  const mergedClose = plan?.merged_close ?? computed?.short ?? false;
  const closing = !!cycle && !mergedClose && !closeDone && inClosePeriod(today, cycle.end);

  const sum = planSummary({
    myIncome: c.myIncome,
    partnerIncome: c.partnerIncome,
    partnerUnknown: c.partnerUnknown,
    myAllowance: c.myAllowance,
    partnerAllowance: c.partnerAllowance,
    fixedTotal: sp.fixed_total,
    loanRepayment: sp.loan_repayment,
    livingBudget: sp.living_budget,
    mySharePct: sp.split_mode === 'custom' ? c.myRatio : 50,
  });
  const alloc = allocate(
    sum.saveable,
    goals.map((g) => toAllocGoal(g, goalDeposits[g.id] ?? 0)),
    now,
  );

  // 월급 플랜 카드(H-03): 플랜을 만들 때 값. 없으면 지금 답으로 계산한 한 달 값
  const snap = readPlanSnapshot(plan?.snapshot);
  const parts: PlanParts = snap.parts ?? {
    living: sum.sharedLiving,
    goalFund: alloc.goals,
    emergency: alloc.emergency,
  };
  // 첫 플랜(남은 기간)은 용돈도 같은 비율로
  const daysAtStart =
    plan && cycle && plan.is_partial
      ? daysBetween(todayKst(new Date(plan.created_at)), plan.cycle_end) + 1
      : null;
  const allowance =
    daysAtStart && cycle
      ? Math.round((sum.allowances * daysAtStart) / cycle.days / 10_000) * 10_000
      : sum.allowances;

  const pendingSplit = (plan?.lines ?? []).filter(
    (l) => l.target === 'account' && l.state === 'pending' && l.amount > 0,
  );
  const living = livingLeft(sp.living_budget ?? 0, spentVariable);

  const events = upcoming({
    today,
    paydays: [
      { who: c.myName, day: myPayday },
      ...(c.joined ? [{ who: c.partnerName, day: c.partnerPayday }] : []),
    ],
    cycleEnd: separate ? null : (cycle?.end ?? null),
    mergedClose,
    weddingDate: engaged ? sp.wedding_date : null,
  });

  // 목표(H-05) 상위 3개. 각자 관리 예비부부는 목표 카드 없음
  const goalLines = alloc.lines.slice(0, 3).map((l) => {
    const g = l.goal;
    const delayed =
      l.goal.kind !== 'monthly' &&
      l.need !== null &&
      !!g.deadline &&
      (l.expected === null || l.expected > g.deadline);
    return {
      id: g.id,
      name: g.name,
      template: g.template,
      held: g.held,
      target: g.target,
      pct: g.target ? (g.held * 100) / g.target : 0,
      delayed,
    };
  });

  // 예비부부(H-P1, H-P3, H-P4)
  const wedding = alloc.lines.find((l) => l.goal.template === 'wedding');
  const weddingNeed = wedding?.need ?? 0;
  const wStatus = weddingStatus({
    budget: sp.wedding_budget ?? 0,
    support: sp.family_support ?? 0,
    saved: sp.wedding_saved ?? 0,
    monthlyPlan: weddingNeed,
    monthsLeft: wedding?.goal.deadline ? monthsBetween(thisMonth(now), wedding.goal.deadline) : 0,
  });
  const weddingLine = (plan?.lines ?? []).find((l) => l.account_role === 'wedding');
  const groom = me.side !== 'bride';
  const mode =
    sp.split_deferred || (c.partnerUnknown && sp.split_mode === 'income')
      ? 'half'
      : (sp.split_mode ?? 'half');
  const gather = weddingLine
    ? {
        me: (groom ? weddingLine.amount_groom : weddingLine.amount_bride) ?? 0,
        partner: (groom ? weddingLine.amount_bride : weddingLine.amount_groom) ?? 0,
      }
    : splitShares({
        total: weddingNeed,
        mode,
        myRatio: c.myRatio,
        myIncome: c.myIncome ?? 0,
        partnerIncome: c.partnerIncome ?? 0,
      });

  // 할 일(H-04) 조건
  const estimates =
    [
      c.partnerEstimated,
      sp.fixed_total_estimated,
      sp.living_budget_estimated,
      sp.wedding_budget_estimated,
      sp.wedding_date_estimated,
      sp.family_support_estimated,
    ].filter(Boolean).length +
    goals.filter((g) => g.amount_estimated || g.deadline_estimated).length;
  const todoState: TodoState = {
    startedOn: me.onboarding_done_at ? todayKst(new Date(me.onboarding_done_at)) : today,
    joined,
    solo,
    separate,
    engaged,
    weddingDateUnknown: engaged && !sp.wedding_date,
    noLoan: sp.loan_repayment === 0,
    noSaving: !separate && sum.saveable <= 0,
    estimates,
    splitDeferred: sp.split_deferred,
  };

  return {
    today,
    month,
    planId: plan?.id ?? null,
    todoState,
    partnerName: c.partnerName,
    starter: c.starter,
    cycle,
    closing,
    closeDays: cycle ? daysBetween(today, cycle.end) + 1 : null,
    joined,
    solo,
    engaged,
    separate,
    hasSplit,
    temp: plan?.is_temp ?? (!joined && !solo),
    parts,
    allowance,
    pendingSplit: {
      count: pendingSplit.length,
      amount: pendingSplit.reduce((t, l) => t + l.amount, 0),
    },
    living,
    events,
    goals: separate ? [] : goalLines,
    weddingDday: engaged && sp.wedding_date ? daysBetween(today, sp.wedding_date) : null,
    weddingDate: sp.wedding_date,
    weddingMonth: sp.wedding_month,
    wedding: {
      budget: sp.wedding_budget ?? 0,
      support: sp.family_support ?? 0,
      saved: sp.wedding_saved ?? 0,
      ...wStatus,
      // 양가 지원 + 모아둔 돈 ≥ 총예산이면 모으기 카드 숨김
      gatherHidden: (sp.family_support ?? 0) + (sp.wedding_saved ?? 0) >= (sp.wedding_budget ?? 0),
      gather,
    },
  };
}
export type MonthView = ReturnType<typeof monthView>;
