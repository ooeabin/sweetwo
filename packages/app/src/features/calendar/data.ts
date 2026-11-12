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
  subscribeCares,
  updateCareDay,
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
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { track } from '../../shared/analytics';
import { quietly } from '../../shared/toast';
import { copy } from './copy';

/**
 * 상대가 경조사를 넣거나 고치거나 기록하면(Realtime care_day·care_record, 2026-11-12 QA 9구간 S9-03) 바로 다시 읽음.
 * 캘린더 화면(useCalendarData)에서 한 번
 */
export function useCareRealtime(spaceId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    return subscribeCares(spaceId, () => {
      for (const k of [qk.careDays, qk.careRecords, qk.carePhotos])
        void qc.invalidateQueries({ queryKey: k });
    });
  }, [spaceId, qc]);
}

// 캘린더 재료(24, 재기획): 경조사와 기록, 공휴일, 금융 일정(월급날, 월급 전 확인 띠, 저금 항목 기한, 자산·대출 만기).
// 금융 일정 계산은 core rules/calendar `moneyDates`.
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
  const all = [me, space, partner, assets, goals, cares, records, holidays];
  const loading = all.some((q) => q.isLoading);
  // 못 불러옴(13 공통 상태 7번, 2026-11-12 QA 9구간 S9-02): 빈 상태·목록으로 튕기기 대신 오류 카드 + ‘다시 시도’
  const failed = all.some((q) => q.isError);
  const retry = () => all.forEach((q) => void q.refetch());
  useCareRealtime(space.data?.id);
  const sp = space.data;
  const c = me.data && sp ? coupleOf(me.data, sp, partner.data ?? null) : null;
  const joint = sp?.salary_mode === 'joint';
  // 월급날: 각자 = 사람마다(파트너는 합류했을 때), 합쳐서 = 체크리스트를 만드는 날 하나
  const paydays: { name: string; day: BaseDay | null; who?: string }[] = !c
    ? []
    : joint
      ? [{ name: '', day: sp?.joint_cycle_day ?? c.myPayday }]
      : [
          { name: c.myName, day: c.myPayday },
          // 파트너 월급날은 그 사람 탭으로(W-02 ?who=, 2026-11-12 S9-10)
          ...(c.joined
            ? [
                {
                  name: c.partnerName,
                  day: c.partnerPayday,
                  ...(partner.data?.id ? { who: partner.data.id } : {}),
                },
              ]
            : []),
        ];
  const reviewDay: BaseDay | null = !c ? null : joint ? (sp?.joint_cycle_day ?? null) : c.myPayday;

  const holidayList = holidays.data ?? [];
  const holidaySet = new Set(holidayList.map((h) => h.date));
  /** 그 날 공휴일 */
  const holidayOf = (date: string) => holidayList.find((h) => h.date === date) ?? null;
  // 저금 항목 기한(ADR 0007): 목표 금액과 기한이 있고 모으는 중인 것만. 달성·그만 모음은 표시하지 않음
  const openGoals = (goals.data ?? []).filter(
    (g) =>
      !g.deleted_at &&
      !g.closed_at &&
      g.status !== 'achieved' &&
      g.target_amount !== null &&
      !!g.deadline,
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
      goalDeadlines: openGoals.map((g) => ({ id: g.id, name: g.name, date: g.deadline ?? '' })),
      yearlyGoals: [],
    });
  const today = todayKst();
  const careList = cares.data ?? [];
  /** 그 달 경조사(날짜, 경조사) */
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
    failed,
    retry,
    holidayOf,
    holidays: holidaySet,
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

/** 금융 일정 한 줄: 라벨, 갈 곳 이름, 경로(24 ‘캘린더 범위’ 표) */
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
      ? d.who
        ? `/salary?who=${encodeURIComponent(d.who)}`
        : '/salary'
      : d.kind === 'review'
        ? '/salary/review'
        : d.kind === 'maturity'
          ? `/assets/${d.ref ?? ''}`
          : `/salary/items/${d.ref ?? ''}`;
  return { label, go: copy.go[d.kind], to };
}

/**
 * 분석 event_recorded의 종류(32 4-5, 2026-11-12 S9-05): 이름 칩 kind → 생일 / 명절·어버이날 / 결혼기념일 / 행사 / 그 밖 [확인 필요]
 */
export function careEventType(kind: string) {
  if (kind === 'birthday') return 'birthday' as const;
  if (kind === 'seollal' || kind === 'chuseok' || kind === 'parents_day') return 'holiday' as const;
  if (kind === 'anniversary') return 'anniversary' as const;
  if (kind === 'event') return 'family_event' as const;
  return 'etc' as const;
}
/** 쓴 돈과 금액 메모 비교(금액 메모가 없으면 null) */
export const vsBudget = (amount: number, budget: number) =>
  budget <= 0 ? null : amount < budget ? 'under' : amount === budget ? 'on' : 'over';

/** 월급 전 확인 띠가 보는 월급(띠 끝 다음 날 = 다음 월급날, 보는 체크리스트는 그 전 달 월급) */
export const reviewMonth = (bandEnd: string) => {
  const m = Number(addDays(bandEnd, 1).slice(5, 7));
  return m === 1 ? 12 : m - 1;
};

/**
 * 경조사 고치기 Toast ‘되돌리기’(13 공통 상태 14번, 6초, 2026-11-12 QA 9구간 S9-04): 고치기 전 값으로 다시 저장 + change_reverted.
 * Y-05 준비 상황·미리 알림·메모·금액 메모, Y-07 수정(이름·날짜)
 */
export function careUndo(qc: QueryClient, id: string, prev: Parameters<typeof updateCareDay>[1]) {
  const at = Date.now();
  return {
    label: copy.undo,
    onClick: () => {
      track('change_reverted', {
        item_type: 'care_day',
        entry: 'toast',
        reverted_whose: 'self',
        hours_since_change: Math.floor((Date.now() - at) / 3_600_000),
      });
      quietly(updateCareDay(id, prev).then(() => qc.invalidateQueries({ queryKey: qk.careDays })));
    },
  };
}

/** 같이 쓰는 경조사를 고침(32 4-6 shared_item_changed care_day): 상대 알림이 가는 동작(추가, 메모)만, 연결된 커플만 */
export const trackCareShared = (linked: boolean) => {
  if (linked) track('shared_item_changed', { item_type: 'care_day', linked: true });
};
