import {
  fetchAssets,
  fetchCareDays,
  fetchCareRecords,
  fetchGoalAssetSums,
  fetchGoalRecords,
  fetchFamily,
  fetchGoals,
  fetchIncomeEvents,
  fetchMe,
  fetchPartner,
  fetchProposals,
  fetchSpace,
  qk,
} from '@sweetwo/api';
import {
  careDatesInMonth,
  coupleBaseDay,
  careRound,
  coupleOf,
  familyCostSummary,
  familyRows,
  monthlyOut,
  roundOccurrences,
  goalHeld,
  overdueDate,
  recordDate,
  moneyDates,
  nextCareDate,
  todayKst,
  type BaseDay,
  type MoneyDate,
} from '@sweetwo/core';
import type { CareDay } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';
import { copy } from './copy';

// 캘린더 돈 날짜 재료: 두 사람 월급날, 기준일, 자산·대출 만기(서버가 공개 범위로 거른 행), 열린 제안 적용일,
// 들어오는 돈, 매년 목표 쓰는 달. 계산은 core rules/calendar
export function useCalendarData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const proposals = useQuery({ queryKey: qk.proposals, queryFn: fetchProposals });
  const income = useQuery({ queryKey: qk.incomeEvents, queryFn: fetchIncomeEvents });
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  const family = useQuery({ queryKey: qk.family, queryFn: fetchFamily });
  const records = useQuery({ queryKey: qk.careRecords, queryFn: fetchCareRecords });
  const goalRecords = useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
  const goalSums = useQuery({ queryKey: qk.goalAssetSums, queryFn: fetchGoalAssetSums });
  const loading = [
    me,
    space,
    partner,
    assets,
    goals,
    proposals,
    income,
    cares,
    family,
    records,
    goalRecords,
    goalSums,
  ].some((q) => q.isLoading);
  const sp = space.data;
  const c = me.data && sp ? coupleOf(me.data, sp, partner.data ?? null) : null;
  const base: BaseDay | null = !sp
    ? null
    : sp.base_day_last
      ? 'last'
      : (sp.base_day ?? (c ? coupleBaseDay(c) : null));

  const monthOf = (y: number, m: number) =>
    moneyDates(y, m, {
      paydays: c
        ? [
            { name: c.myName, day: c.myPayday },
            ...(c.joined ? [{ name: c.partnerName, day: c.partnerPayday }] : []),
          ]
        : [],
      baseDay: base,
      maturities: (assets.data ?? [])
        .filter((a) => a.maturity_date)
        .map((a) => ({ id: a.id, name: a.name, date: a.maturity_date ?? '' })),
      proposals: (proposals.data ?? [])
        .filter((p) => p.status === 'open' && p.apply_on)
        .map((p) => ({ id: p.id, date: p.apply_on })),
      income: (income.data ?? []).map((e) => ({
        name: e.name,
        month: e.month,
        yearly: e.yearly,
        createdOn: todayKst(new Date(e.created_at)),
      })),
      yearlyGoals: (goals.data ?? [])
        .filter((g) => g.kind === 'yearly' && g.deadline && g.status !== 'paused')
        .map((g) => ({ id: g.id, name: g.name, month: Number((g.deadline ?? '').slice(5, 7)) })),
    });
  const today = todayKst();
  const careList = cares.data ?? [];
  /** 그 달 챙길 날(날짜, 챙길 날) */
  const caresOf = (y: number, m: number) =>
    careList
      .flatMap((c) => careDatesInMonth(c, y, m).map((date) => ({ date, care: c })))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  /** 다음 날짜 순(날짜 없는 날은 뒤) */
  const upcoming = careList
    .map((c) => ({ care: c, date: nextCareDate(c, today) }))
    .filter((x): x is { care: CareDay; date: string } => x.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  // 쪽 이름: 신랑 쪽 / 신부 쪽을 두 사람 호칭으로
  const iAmBride = me.data?.side === 'bride';
  const names = {
    groom: (iAmBride ? c?.partnerName : c?.myName) ?? '',
    bride: (iAmBride ? c?.myName : c?.partnerName) ?? '',
  };
  /** 종류별 양가 예산 단가(Y-07d): 같은 종류 챙길 날 중 가장 최근에 정한 쓸 돈 */
  const unitOf = (kind: string) =>
    [...careList]
      .filter((x) => x.kind === kind && x.budget > 0)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0]?.budget ?? 0;
  const recordList = records.data ?? [];
  const recordedOf = (careId: string) => (date: string) =>
    recordList.some((r) => r.care_day_id === careId && r.occurs_on === date);
  /** 기록할 회차(‘다녀왔어요’ → Y-08) */
  const recordOn = (c: CareDay) => recordDate(c, today, recordedOf(c.id));
  /** 기록 없이 7일 지난 날(Y-01 맨 위, Y-05 ‘지남’) */
  const overdue = careList
    .map((c) => ({ care: c, date: overdueDate(c, today, recordedOf(c.id)) }))
    .filter((x): x is { care: CareDay; date: string } => x.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  /** 목표 보유액(기타 보유액 + 넣은 돈 + 연결 자산 − 쓴 돈, 06 5-4) */
  const heldOf = (goalId: string) => {
    const g = (goals.data ?? []).find((x) => x.id === goalId);
    if (!g) return 0;
    const sum = (rows: { goalId: string; amount: number }[] | undefined) =>
      (rows ?? []).filter((x) => x.goalId === goalId).reduce((t, x) => t + x.amount, 0);
    const linked = (goalSums.data ?? []).find((x) => x.goal_id === goalId)?.total ?? 0;
    return goalHeld(
      g.other_held,
      sum(goalRecords.data?.deposits) + linked - sum(goalRecords.data?.uses),
    );
  };
  const familyGoal = (goals.data ?? []).find((g) => g.template === 'family_cost') ?? null;

  // 이번 회차 양가 비용(Y-01 7번, Y-06): 결혼기념일 기준 1년, 양가 날만. 예비부부는 오늘부터 1년
  const engaged = sp?.marriage_status === 'engaged';
  const round = careRound(engaged ? null : (sp?.wedding_date ?? null), today);
  const parents = new Set(
    (family.data ?? []).filter((f) => f.relation === 'parent').map((f) => f.id),
  );
  const occ = roundOccurrences(
    careList.map((x) => ({ ...x, parent: !!x.member_id && parents.has(x.member_id) })),
    round,
  );
  const familyIds = new Set(careList.filter((x) => x.category === 'family').map((x) => x.id));
  const fcTotal = occ.reduce((t, o) => t + o.care.budget, 0);
  const fcSpent = recordList
    .filter(
      (r) => familyIds.has(r.care_day_id) && r.occurs_on >= round.start && r.occurs_on <= round.end,
    )
    .reduce((t, r) => t + r.amount, 0);
  const fcHeld = familyGoal ? heldOf(familyGoal.id) : 0;
  const fcNext = occ.find((o) => o.date >= today && !recordedOf(o.care.id)(o.date));
  const familyCost = {
    engaged,
    round,
    rows: familyRows(occ),
    total: fcTotal,
    spent: fcSpent,
    held: fcHeld,
    months: monthlyOut(occ, round, today),
    summary: familyCostSummary({
      total: fcTotal,
      spent: fcSpent,
      held: fcHeld,
      round,
      today,
      next: fcNext ? { date: fcNext.date, budget: fcNext.care.budget } : null,
    }),
    /** 열린 양가 비용 예산 제안 */
    proposal:
      (proposals.data ?? []).find((p) => p.item === 'family_budget' && p.status === 'open') ?? null,
  };
  return {
    loading,
    records: recordList,
    recordOn,
    overdue,
    heldOf,
    familyGoal,
    familyCost,
    unitOf,
    monthOf,
    caresOf,
    names,
    upcoming,
    cares: careList,
    family: family.data ?? [],
    goals: goals.data ?? [],
    couple: c,
    me: me.data ?? null,
    space: sp ?? null,
    today,
  };
}

/** 돈 날짜 한 줄: 라벨, 갈 곳 이름, 경로 */
export function moneyLine(d: MoneyDate) {
  const label =
    d.kind === 'payday'
      ? copy.money.payday(d.name)
      : d.kind === 'close'
        ? copy.money.close
        : d.kind === 'maturity'
          ? copy.money.maturity(d.name)
          : d.kind === 'proposal'
            ? copy.money.proposal
            : d.kind === 'income'
              ? copy.money.income(d.name)
              : copy.money.goal(d.name);
  const to =
    d.kind === 'payday'
      ? '/plan'
      : d.kind === 'close'
        ? '/'
        : d.kind === 'maturity'
          ? `/assets/${d.ref ?? ''}`
          : d.kind === 'proposal'
            ? `/proposals/${d.ref ?? ''}`
            : d.kind === 'income'
              ? '/plan/income'
              : `/goals/${d.ref ?? ''}`;
  return { label, go: copy.go[d.kind], to };
}

/** 구분 이름표(6번): 찬우 쪽 / 예빈 쪽 / 양가 / 우리 둘 */
export function sideLabel(
  c: Pick<CareDay, 'category' | 'side'>,
  names: { groom: string; bride: string },
) {
  if (c.category === 'couple') return copy.couple;
  if (!c.side) return copy.both;
  return copy.side(c.side === 'groom' ? names.groom : names.bride);
}
/** 챙길 사람 문장 */
export function carerLabel(c: Pick<CareDay, 'carer'>, names: { groom: string; bride: string }) {
  return c.carer === 'together'
    ? copy.together
    : copy.carer(c.carer === 'groom' ? names.groom : names.bride);
}
/** 달력 막대 색: 양가 family, 우리 둘 together */
export const markOf = (c: Pick<CareDay, 'category'>) =>
  c.category === 'couple' ? ('together' as const) : ('family' as const);
