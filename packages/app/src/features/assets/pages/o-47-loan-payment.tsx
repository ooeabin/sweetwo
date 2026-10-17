import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { Navigate } from 'react-router-dom';
import { copy } from '../copy';
import { useLoanStep } from '../week/loan';
import { weekPath } from '../week/week';

// O-47 대출 월 상환(Q3). 마지막 대출이면 월 상환액 합계가 O-39 대출 상환 합계를 대신하고 안 나눈 돈을 다시 셈
export function O47LoanPayment() {
  const s = useLoanStep('pay');
  if (!s.key) return <Navigate to={weekPath.loans} replace />;
  if (s.w.d.loading) return null;
  const key = s.key;
  const pay = s.item?.payment ?? null;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.weekPayment}
      help={s.help}
      onBack={s.back}
      later={s.close}
      primary={{ label: copy.next, disabled: pay === null, loading: s.saving }}
      onSubmit={() => pay !== null && void s.next({})}
    >
      <AmountInput
        key={key}
        label={copy.weekPayment}
        value={pay}
        onChange={(v) => s.w.setItem(key, { payment: v })}
        quick={quickChips.small}
        monthly
        allowZero
      />
    </QuestionLayout>
  );
}
