import {
  fetchAssets,
  fetchCareDays,
  fetchCareRecords,
  fetchGoals,
  fetchHolidays,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  type CareDay,
} from '@sweetwo/api';
import {
  addDays,
  careDatesInMonth,
  coupleOf,
  moneyDates,
  nextCareDate,
  overdueDate,
  recordDate,
  todayKst,
  type BaseDay,
  type MoneyDate,
} from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { copy } from './copy';

// 캘린더 재료(24, 재기획): 챙길 날과 기록, 공휴일, 돈 일정(월급날, 월말 확인 띠, 목표 기한·쓰는 달, 자산·대출 만기).
// 돈 일정 계산은 core rules/calendar `moneyDates`.
export function useCalendarData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  const records = useQuery({ queryKey: qk.careRecords, queryFn: fetchCareRecords });
  const holidays = useQuery({
    queryKey: qk.holidays,
    queryFn: fetchHolidays,
    staleTime: 24 * 3_600_000,
  });
  const loading = [me, space, partner, assets, goals, cares, records, holidays].some(
    (q) => q.isLoading,
  );
  const sp = space.data;
  const c = me.data && sp ? coupleOf(me.data, sp, partner.data ?? null) : null;
  const joint = sp?.salary_mode === 'joint';
  // 월급날: 각자 = 사람마다(배우자는 합류했을 때), 합쳐서 = 체크리스트를 만드는 날 하나
  const paydays: { name: string; day: BaseDay | null }[] = !c
    ? []
    : joint
      ? [{ name: '', day: sp?.joint_cycle_day ?? c.myPayday }]
      : [
          { name: c.myName, day: c.myPayday },
          ...(c.joined ? [{ name: c.partnerName, day: c.partnerPayday }] : []),
        ];
  const reviewDay: BaseDay | null = !c ? null : joint ? (sp?.joint_cycle_day ?? null) : c.myPayday;

  const holidayList = holidays.data ?? [];
  const holidaySet = new Set(holidayList.map((h) => h.date));
  /** 그 날 공휴일 */
  const holidayOf = (date: string) => holidayList.find((h) => h.date === date) ?? null;
  // 목표: 진행 중(진행·지연)만. 달성·보류·사용 완료는 기한을 표시하지 않음
  const openGoals = (goals.data ?? []).filter(
    (g) => g.status === 'active' || g.status === 'delayed',
  );
  const monthOf = (y: number, m: number) =>
    moneyDates(y, m, {
      holidays: holidaySet,
      shift: sp?.holiday_shift ?? true,
      paydays,
      reviewDay,
      maturities: (assets.data ?? [])
        .filter((a) => a.maturity_date)
        .map((a) => ({ id: a.id, name: a.name, date: a.maturity_date ?? '' })),
      goalDeadlines: openGoals
        .filter((g) => g.kind === 'once' && g.deadline)
        .map((g) => ({ id: g.id, name: g.name, date: g.deadline ?? '' })),
      yearlyGoals: openGoals
        .filter((g) => g.kind === 'yearly' && g.deadline)
        .map((g) => ({ id: g.id, name: g.name, month: Number((g.deadline ?? '').slice(5, 7)) })),
    });
  const today = todayKst();
  const careList = cares.data ?? [];
  /** 그 달 챙길 날(날짜, 챙길 날) */
  const caresOf = (y: number, m: number) =>
    careList
      .flatMap((x) => careDatesInMonth(x, y, m).map((date) => ({ date, care: x })))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  /** 다음 날짜 순(날짜 없는 날, 지난 한 번인 날은 뺌) */
  const upcoming = careList
    .map((x) => ({ care: x, date: nextCareDate(x, today) }))
    .filter((x): x is { care: CareDay; date: string } => x.date !== null && x.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const recordList = records.data ?? [];
  const recordedOf = (careId: string) => (date: string) =>
    recordList.some((r) => r.care_day_id === careId && r.occurs_on === date);
  /** 기록할 회차(‘다녀왔어요’ → Y-08) */
  const recordOn = (x: CareDay) => recordDate(x, today, recordedOf(x.id));
  /** 기록 없이 7일 지난 날(Y-01 맨 위, Y-05 ‘지남’) */
  const overdue = careList
    .map((x) => ({ care: x, date: overdueDate(x, today, recordedOf(x.id)) }))
    .filter((x): x is { care: CareDay; date: string } => x.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    loading,
    holidayOf,
    records: recordList,
    recordOn,
    overdue,
    monthOf,
    caresOf,
    upcoming,
    cares: careList,
    goals: openGoals,
    couple: c,
    me: me.data ?? null,
    space: sp ?? null,
    today,
  };
}

/** 돈 일정 한 줄: 라벨, 갈 곳 이름, 경로(24 ‘캘린더 범위’ 표) */
export function moneyLine(d: MoneyDate) {
  const label =
    d.kind === 'payday'
      ? copy.money.payday(d.name)
      : d.kind === 'review'
        ? copy.money.review
        : d.kind === 'deadline'
          ? copy.money.deadline(d.name)
          : d.kind === 'goal'
            ? copy.money.goal(d.name)
            : copy.money.maturity(d.name);
  const to =
    d.kind === 'payday'
      ? '/salary'
      : d.kind === 'review'
        ? '/salary/review'
        : d.kind === 'maturity'
          ? `/assets/${d.ref ?? ''}`
          : `/goals/${d.ref ?? ''}`;
  return { label, go: copy.go[d.kind], to };
}

/** 월말 확인 띠가 보는 월급(띠 끝 다음 날 = 다음 월급날, 보는 체크리스트는 그 전 달 월급) */
export const reviewMonth = (bandEnd: string) => {
  const m = Number(addDays(bandEnd, 1).slice(5, 7));
  return m === 1 ? 12 : m - 1;
};
