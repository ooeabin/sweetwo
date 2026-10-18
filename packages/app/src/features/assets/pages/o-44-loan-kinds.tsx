import { updateSpace } from '@sweetwo/api';
import { QUICK_LOANS } from '@sweetwo/core';
import { Chip, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useWeek, weekPath } from '../week/week';

const NONE = 'none';

// O-44 대출 종류(Q2 그룹 칩, 첫 주 3일째 ‘대출 정리하기’): 고른 대출마다 O-45 → O-46 → O-47.
// ‘없어요’(단독) → 할 일 끝. O-39 대출 상환 합계가 있었으면 한 번 확인하고 0으로(안 나눈 돈 다시 셈).
export function O44LoanKinds() {
  const w = useWeek('loans');
  const { masked } = useMask();
  const [picks, setPicks] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  if (w.d.loading) return null;
  const cur = picks ?? w.draft.picks;
  const none = cur.includes(NONE);
  const loan = w.d.space?.loan_repayment ?? 0;
  const flip = (k: string) =>
    setPicks(
      k === NONE
        ? none
          ? []
          : [NONE]
        : cur.includes(k)
          ? cur.filter((x) => x !== k)
          : [...cur.filter((x) => x !== NONE), k],
    );

  const submit = async () => {
    if (saving) return;
    if (!none) {
      w.setPicks(QUICK_LOANS.map((q) => q.key).filter((k) => cur.includes(k)));
      w.nav(weekPath.loan(1, 'amount'));
      return;
    }
    setSaving(true);
    try {
      w.setPicks([]);
      if (loan > 0) {
        await updateSpace({ loan_repayment: 0 });
        await recalcPendingShares();
      }
      await w.finish();
      toast(copy.weekLoansDone);
      w.exit();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={{ total: none ? 1 : 1 + 3 * Math.max(cur.length, 1), now: 0 }}
      title={copy.weekLoans}
      onBack={w.close}
      later={{ label: copy.weekClose, onClick: w.close }}
      primary={{ label: copy.next, disabled: !cur.length, loading: saving }}
      onSubmit={() => void submit()}
    >
      <div
        role="group"
        aria-label={copy.weekLoans}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}
      >
        {[
          ...QUICK_LOANS.map((q) => ({ key: q.key, name: q.name })),
          { key: NONE, name: copy.weekNoLoan },
        ].map((q) => (
          <Chip
            key={q.key}
            selected={cur.includes(q.key)}
            onClick={() => flip(q.key)}
            style={{ justifyContent: 'center' }}
          >
            {q.name}
          </Chip>
        ))}
      </div>
      {none && loan > 0 && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{copy.weekNoLoanCheck(money(loan, masked))}</span>
        </p>
      )}
    </QuestionLayout>
  );
}
