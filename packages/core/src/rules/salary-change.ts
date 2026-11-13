import { z } from 'zod';
import { daysBetween } from '../date';
import { MAX_WON, type Won } from '../money';
import { baseDateIn, type BaseDay } from '../onboarding/cycle';

// 날짜를 정한 월급 변경(docs/spec/07 5장, 25 S-11c, G12).
// 서버 salary_change_day·apply_salary_changes·schedule_salary_change(마이그레이션 20261202090000_v22_manage_share 계약 5)와 같은 결과.
// effective_from·until_month는 그 달 1일. 적용일 = 그 달의 그 사람 사이클 시작일(날짜 없음은 1일).

export interface SalaryChangeRow {
  id: string;
  amount: Won;
  effective_from: string;
  until_month: string | null;
  revert_amount: Won | null;
  applied_at: string | null;
  reverted_at: string | null;
  cancelled_at: string | null;
}

/** 그 사람의 그 달 사이클 시작일(서버 salary_change_day). 월급날이 없으면(날짜 없음, 월급 없음) 그 달 1일 */
export function salaryChangeDay(month: string, payday: BaseDay | null): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (payday === null) return `${month.slice(0, 7)}-01`;
  return baseDateIn(y, m, payday === 'last' || payday >= 31 ? 'last' : payday);
}

const nextMonth = (month: string) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};

/** 적용일 */
export const salaryChangeApplyDay = (
  c: Pick<SalaryChangeRow, 'effective_from'>,
  payday: BaseDay | null,
) => salaryChangeDay(c.effective_from, payday);

/** 되돌리는 날(until_month 다음 달 사이클 시작일). until이 없으면 null */
export const salaryChangeRevertDay = (
  c: Pick<SalaryChangeRow, 'until_month'>,
  payday: BaseDay | null,
) => (c.until_month ? salaryChangeDay(nextMonth(c.until_month), payday) : null);

/** 저장하면 바로 적용되나(이번 사이클이면 즉시, 07 5장): 적용일 ≤ 오늘 */
export const salaryChangeImmediate = (
  c: Pick<SalaryChangeRow, 'effective_from'>,
  payday: BaseDay | null,
  today: string,
) => salaryChangeApplyDay(c, payday) <= today;

export type SalaryChangeState = 'scheduled' | 'applied' | 'reverted' | 'cancelled';
export const salaryChangeState = (c: SalaryChangeRow): SalaryChangeState =>
  c.cancelled_at
    ? 'cancelled'
    : c.reverted_at
      ? 'reverted'
      : c.applied_at
        ? 'applied'
        : 'scheduled';

/** 월급이 바뀐 달 띠(H-06 6번): 적용된 사이클 첫 7일, W-01을 열면(done) 사라짐 */
export function salaryChangedTaskOpen(o: {
  appliedDay: string | null;
  today: string;
  done: boolean;
}) {
  if (!o.appliedDay || o.done) return false;
  const d = daysBetween(o.appliedDay, o.today);
  return d >= 0 && d < 7;
}

/**
 * S-11c 입력(서버 schedule_salary_change 검사와 같음): 금액 0~999억, 시작 달은 이번 달부터,
 * 끝 달(선택)은 시작 달 이상. 달은 'YYYY-MM'
 */
export const salaryChangeInput = (thisMonth: string) =>
  z
    .object({
      amount: z.number().int().min(0).max(MAX_WON),
      from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      until: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .nullable(),
    })
    .refine((v) => v.from >= thisMonth.slice(0, 7), { path: ['from'] })
    .refine((v) => v.until === null || v.until >= v.from, { path: ['until'] });
export type SalaryChangeInput = z.infer<ReturnType<typeof salaryChangeInput>>;

/** 분석 salary_change_scheduled.months_ahead: 이번 달부터 시작 달까지 개월 */
export const salaryChangeMonthsAhead = (thisMonth: string, from: string) =>
  (Number(from.slice(0, 4)) - Number(thisMonth.slice(0, 4))) * 12 +
  Number(from.slice(5, 7)) -
  Number(thisMonth.slice(5, 7));
