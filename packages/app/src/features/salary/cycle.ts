import { fetchHolidays, qk, type SalarySplit, type SplitLine } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';
import {
  businessDayOnOrBefore,
  firstChecklistStart,
  salaryChangeAppliedDay,
  salaryChangeRevertDay,
  type BaseDay,
  type SalaryChangeRowResponse,
} from '@sweetwo/core';
import { copy } from './copy';
import { useSpace } from './data';

// v2.2 확인 루프 화면 값(07 1·3·5장, 20 ‘월급 탭 v2.2’). 계산은 core(pay-confirm, salary-change)만 부른다.

type Person = { payday: number | null; payday_last: boolean; payday_none?: boolean };
type SpaceLike = { salary_mode: string; joint_cycle_day: number | null };

/** 내 확인 목록 기준일(07 1장): 합쳐서 = 공간 기준일(31 = 말일), 각자 = 내 월급날. 날짜 없음·월급날 없음이면 null */
export function baseDayOf(me: Person, space: SpaceLike): BaseDay | null {
  if (space.salary_mode === 'joint' && space.joint_cycle_day !== null)
    return space.joint_cycle_day >= 31 ? 'last' : space.joint_cycle_day;
  if (me.payday_none) return null;
  if (me.payday_last) return 'last';
  return me.payday ?? null;
}

/** 첫 확인 목록이 생기는 날(소급 없음, 07 3-1): 월급 계획을 만든 날 뒤 처음 오는 기준일 */
export const firstPaydayOf = (
  split: SalarySplit | undefined,
  base: BaseDay | null,
  today: string,
) => (split ? firstChecklistStart(split.checklist_from ?? today, base) : null);

/**
 * 월급이 바뀐 날(띠 6번, 07 5장): 내 월급 변경 중 가장 최근에 적용되거나 되돌린 것의 그날(‘이번 달부터’를 월급날 전에
 * 바로 적용했으면 적용한 날).
 * 띠 키는 core `salary_changed:{날}`(W-01을 열면 done)
 */
export function salaryChangedDay(
  changes: readonly SalaryChangeRowResponse[] | undefined,
  meId: string,
  base: BaseDay | null,
): string | null {
  const days = (changes ?? [])
    .filter((c) => c.user_id === meId && !c.cancelled_at)
    .flatMap((c) => [
      salaryChangeAppliedDay(c, base),
      c.reverted_at ? salaryChangeRevertDay(c, base) : null,
    ])
    .filter((d): d is string => !!d)
    .sort();
  return days[days.length - 1] ?? null;
}

/** 나가는 날 글자(“26일”, 말일, 월급날). auto_day null = 월급날 */
export const autoDayText = (autoDay: number | null) =>
  autoDay === null ? copy.autoPayday : autoDay >= 31 ? copy.paydayLast : copy.payday(autoDay);

/**
 * W-01 영수증 자동 알약 “자동 26일” / “자동 월급날”(20 W-01 5c). 월급날이 없는 사람(날짜 없음)은 나가는 날 기본이 1일이라
 * ‘월급날’ 대신 “자동 1일”(06 3-1, 2026-11-13 UX B)
 */
export const receiptAutoPill = (
  l: Pick<SplitLine, 'auto_pay' | 'auto_day'>,
  base: BaseDay | null = null,
  paydayNone = false,
) =>
  l.auto_pay
    ? copy.autoPill(
        l.auto_day === null && (paydayNone || base === null)
          ? copy.payday(1)
          : autoDayText(l.auto_day),
      )
    : undefined;

/** ‘다음 날’ 칩(20 W-01 7a): 월급날 다음 날(말일이면 1일). 월급날이 없으면 null */
export const nextDayOf = (base: BaseDay | null): number | null =>
  base === null ? null : base === 'last' || base >= 31 ? 1 : base + 1;

/** W-01d 목록에 나오는 줄(20 W-01d 2번): 저금, 고정지출, 같이 쓰는 통장 */
export const autoPickable = (l: Pick<SplitLine, 'kind'>) =>
  l.kind === 'saving' || l.kind === 'fixed' || l.kind === 'shared_account';

/** 확인 목록 이름(07 1장 “10월 25일 월급”): 사이클 시작일 */
export const cycleName = (start: string) => copy.cycleOf(start);

/**
 * 보여 줄 월급날(07 1장): 앞당기기(couple_space.holiday_shift)가 켜져 있으면 주말·공휴일이면 직전 영업일, 끄면 사이클 첫날 그대로.
 * W-02 제목·기간, 다 끝난 달 한 줄, 홈 H-11이 같은 날을 씀(2026-11-13 UX B M2, 제목과 기간이 다르던 것)
 */
export function useShownPayday(): (cycleStart: string) => string {
  const space = useSpace();
  const holidays = useQuery({ queryKey: qk.holidays, queryFn: fetchHolidays });
  const shift = space.data?.holiday_shift !== false;
  const set = new Set((holidays.data ?? []).map((h) => h.date));
  return (d: string) => (shift ? businessDayOnOrBefore(d, set) : d);
}
