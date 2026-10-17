import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { Navigate } from 'react-router-dom';
import { copy } from '../copy';
import { useLoanStep } from '../week/loan';
import { weekPath } from '../week/week';

// O-45 대출 남은 돈(Q3 반복 + 소유자 토글 나 / 배우자 / 같이). 넘기면 바로 저장
export function O45LoanAmount() {
  const s = useLoanStep('amount');
  if (!s.key) return <Navigate to={weekPath.loans} replace />;
  if (s.w.d.loading) return null;
  const key = s.key;
  const title = copy.weekLoanAmount(s.pick?.name ?? '');
  const amount = s.item?.amount ?? null;
  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      help={s.help}
      onBack={s.back}
      later={s.close}
      primary={{ label: copy.next, disabled: amount === null, loading: s.saving }}
      onSubmit={() => amount !== null && void s.next({})}
    >
      {s.w.toggle(key)}
      <AmountInput
        key={key}
        label={title}
        value={amount}
        onChange={(v) => s.w.setItem(key, { amount: v })}
        quick={key === 'housing_loan' ? quickChips.big : quickChips.small}
      />
    </QuestionLayout>
  );
}
