import type { Goal, GoalRecordRow, Me, PartnerProfile, Space } from '@sweetwo/api';
import {
  allocate,
  coupleOf,
  dateToYm,
  goalHeld,
  goalMonths,
  goalPace,
  goalStatus,
  nextOccurrence,
  paceChip,
  planSummary,
  templateByKey,
  type AllocGoal,
  type GoalMonth,
  type GoalStatus,
  type YearMonth,
} from '@sweetwo/core';

// 목표 화면 값(G-01, G-02). 계산 규칙은 core(06 4·5장), 여기서는 모아 넘기기만.

export interface GoalLine {
  id: string;
  name: string;
  template: string;
  kind: 'once' | 'yearly' | 'monthly';
  illustration: string | null;
  /** 직접 만든 목표(회색 기본 그림) */
  custom: boolean;
  status: GoalStatus | null;
  afterMarriage: boolean;
  target: number | null;
  held: number;
  otherHeld: number;
  deposits: number;
  /** 연결 자산(원금 기준) */
  linked: number;
  /** G-05에서 썼다고 기록한 돈(사용 완료 카드) */
  spent: number;
  pct: number;
  pace: number | null;
  chip: ReturnType<typeof paceChip>;
  alloc: number;
  need: number | null;
  deadline: YearMonth | null;
  expected: YearMonth | null;
  /** 매년 목표 다음 사용 달 */
  nextUse: YearMonth | null;
  /** 담당한 사람 번호(1 = 시작한 사람, 2 = 합류한 사람) */
  owners: (1 | 2)[];
  createdAt: string;
  months: GoalMonth[];
}

const FOLDED: (GoalStatus | null)[] = ['paused', 'achieved', 'used'];

export function goalsView(i: {
  me: Me;
  space: Space;
  partner: PartnerProfile | null;
  goals: Goal[];
  records: { plans: GoalRecordRow[]; deposits: GoalRecordRow[]; uses?: GoalRecordRow[] };
  /** 목표별 연결 자산 합계(서버, 비공개 제외) */
  linked?: { goal_id: string; total: number }[];
  now?: Date;
}) {
  const now = i.now ?? new Date();
  const sp = i.space;
  const c = coupleOf(i.me, sp, i.partner);
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
  const linkedOf = (id: string) => i.linked?.find((x) => x.goal_id === id)?.total ?? 0;
  const deposited = (id: string) =>
    i.records.deposits.filter((d) => d.goalId === id).reduce((t, d) => t + d.amount, 0);
  // 목표 사용(챙길 날 기록 등)은 그 목표 보유액에서만 뺌(06 6장)
  const usedOf = (id: string) =>
    (i.records.uses ?? []).filter((d) => d.goalId === id).reduce((t, d) => t + d.amount, 0);
  const allocGoals: AllocGoal[] = i.goals.map((g) => ({
    id: g.id,
    template: g.template,
    name: g.name,
    kind: g.kind,
    priority: g.priority,
    target: g.target_amount,
    held: goalHeld(g.other_held, deposited(g.id) + linkedOf(g.id) - usedOf(g.id)),
    deadline: g.deadline ? dateToYm(g.deadline) : null,
    afterMarriage: g.after_marriage,
    paused: g.status === 'paused',
  }));
  const alloc = allocate(sum.saveable, allocGoals, now);

  // 담당: 같이 = 둘, 나 = 만든 사람, 배우자 = 다른 사람. 번호는 시작한 사람 1
  const starterId = c.starter ? i.me.id : (i.partner?.id ?? null);
  const noOf = (uid: string | null): 1 | 2 => (uid && uid === starterId ? 1 : 2);
  const ownersOf = (g: Goal): (1 | 2)[] => {
    if (g.owner === 'together' || !c.joined) return c.joined ? [1, 2] : [1];
    const creator = noOf(g.created_by);
    return [g.owner === 'me' ? creator : creator === 1 ? 2 : 1];
  };

  // 순서: 배분 순서(비상금 맨 위), 배분에서 빠진 목표(보류, 결혼 후 목표)는 뒤에
  const order = [
    ...alloc.lines.map((l) => l.goal.id),
    ...allocGoals
      .filter((g) => !alloc.lines.some((l) => l.goal.id === g.id))
      .sort((a, b) => a.priority - b.priority)
      .map((g) => g.id),
  ];
  const lines: GoalLine[] = order.map((id) => {
    const g = i.goals.find((x) => x.id === id) as Goal;
    const a = allocGoals.find((x) => x.id === id) as AllocGoal;
    const l = alloc.lines.find((x) => x.goal.id === id);
    const months = goalMonths(id, i.records.plans, i.records.deposits);
    const expected = l?.expected ?? null;
    const status = goalStatus(g.status, { expected, goal: a }, months);
    const pct = a.target ? (a.held * 100) / a.target : 0;
    const pace = g.kind === 'once' ? goalPace(g.created_at, a.deadline, now) : null;
    const t = templateByKey(g.template);
    return {
      id,
      name: g.name,
      template: g.template,
      kind: g.kind,
      illustration: t?.illustration ?? null,
      custom: !t || t.key === 'custom',
      status,
      afterMarriage: g.after_marriage,
      target: a.target,
      held: a.held,
      otherHeld: g.other_held,
      deposits: deposited(id),
      linked: linkedOf(id),
      spent: (i.records.uses ?? [])
        .filter((u) => u.goalId === id && u.source === 'achieved')
        .reduce((t, u) => t + u.amount, 0),
      pct,
      pace,
      chip:
        status === 'active' || status === 'delayed'
          ? paceChip({ pct, pace, expected, deadline: a.deadline })
          : null,
      alloc: l?.alloc ?? 0,
      need: l?.need ?? null,
      deadline: a.deadline,
      expected,
      nextUse:
        g.kind === 'yearly' && a.deadline
          ? nextOccurrence(Number(a.deadline.slice(5, 7)), now)
          : null,
      owners: ownersOf(g),
      createdAt: g.created_at,
      months,
    };
  });

  const open = lines.filter((l) => !FOLDED.includes(l.status));
  return {
    couple: c,
    alloc,
    sum,
    saveable: Math.max(sum.saveable, 0),
    /** 진행 중·지연 목표의 월 배분 합 */
    monthly: open
      .filter((l) => l.status === 'active' || l.status === 'delayed' || l.status === null)
      .reduce((t, l) => t + l.alloc, 0),
    shortfall: alloc.short ? alloc.shortfall : 0,
    open,
    folded: lines.filter((l) => FOLDED.includes(l.status)),
    lines,
  };
}
export type GoalsView = ReturnType<typeof goalsView>;
