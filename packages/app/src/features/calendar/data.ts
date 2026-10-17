import {
  fetchAssets,
  fetchCareDays,
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
  coupleOf,
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
  const loading = [me, space, partner, assets, goals, proposals, income, cares, family].some(
    (q) => q.isLoading,
  );
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
  return {
    loading,
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
