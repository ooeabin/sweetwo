import type { MonthCloseFull } from '@sweetwo/api';
import { formatManWon } from '@sweetwo/core';
import type { MonthSummaryProps } from '@sweetwo/ui';
import { copy } from './copy';
import type { CloseData } from './data';

/** 월 정산 요약 값(06 7장). W-04g 맨 위와 F-01 17번이 같은 값을 쓴다 */
export function closeSummaryProps(
  c: MonthCloseFull,
  d: CloseData,
  month: number,
): MonthSummaryProps {
  const me = d.me?.nickname ?? '';
  const mine = copy.allowanceNote(me, formatManWon(d.myAllowance));
  return {
    monthLabel: copy.summary(month),
    income: c.income ?? 0,
    fixed: (d.space?.fixed_total ?? 0) + (d.space?.loan_repayment ?? 0),
    variable: c.spends.reduce((t, x) => t + x.amount, 0),
    allowance: d.allowance,
    allowanceNote:
      d.basisNote === 'mine' || d.solo
        ? mine
        : `${mine}, ${copy.allowanceNote(d.partnerName, formatManWon(d.partnerAllowance))}`,
    bigExpense: c.bigs.reduce((t, x) => t + x.amount, 0),
    bigExpenseNote: c.bigs.map((b) => b.name).join(', ') || undefined,
    saved: c.deposits.reduce((t, x) => t + x.amount, 0),
    note:
      d.basisNote === 'estimated'
        ? copy.partnerEstimated(d.partnerName)
        : d.basisNote === 'mine'
          ? copy.myMoneyOnly(d.partnerName, me)
          : undefined,
  };
}
