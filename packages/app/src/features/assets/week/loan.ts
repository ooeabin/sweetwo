import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import type { WeekItem } from './draft';
import { pickOf, useWeek, weekPath } from './week';

export type LoanField = 'amount' | 'rate' | 'pay';
const ORDER: LoanField[] = ['amount', 'rate', 'pay'];

// 대출마다 O-45 → O-46 → O-47 공통: n번째 대출, 진행 막대, 뒤로, 넘길 때 저장. 마지막 O-47 뒤 할 일 끝(week finish)
export function useLoanStep(f: LoanField) {
  const w = useWeek('loans');
  const n = Number(useParams().n ?? '1');
  const [saving, setSaving] = useState(false);
  const key = w.draft.picks[n - 1];
  const pick = key ? pickOf('loans', key) : undefined;
  const count = w.draft.picks.length;
  const i = ORDER.indexOf(f);

  const back = () => {
    if (i > 0) w.nav(weekPath.loan(n, ORDER[i - 1] ?? 'amount'));
    else if (n > 1) w.nav(weekPath.loan(n - 1, 'pay'));
    else w.nav(weekPath.loans);
  };
  const next = async (p: Partial<WeekItem>) => {
    if (saving || !key) return;
    setSaving(true);
    try {
      await w.save(key, p);
      if (f === 'amount') w.nav(weekPath.loan(n, 'rate'));
      else if (f === 'rate') w.nav(weekPath.loan(n, 'pay'));
      else if (n < count) w.nav(weekPath.loan(n + 1, 'amount'));
      else {
        await w.finish();
        toast(copy.weekLoansDone);
        w.nav('/', { replace: true });
      }
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return {
    w,
    key,
    pick,
    item: key ? w.itemOf(key) : undefined,
    saving,
    steps: { total: 1 + 3 * count, now: 1 + 3 * (n - 1) + i },
    help: copy.weekCount(pick?.name ?? '', n, count),
    back,
    next,
    close: { label: copy.weekClose, onClick: w.close },
  };
}
