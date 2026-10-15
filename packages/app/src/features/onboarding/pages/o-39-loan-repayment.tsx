import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { monthIncome } from '../flow';
import { useStep } from '../step';

// O-39 대출 월 상환 합계(Q3 + ‘없어요’ = 0원, ‘잘 모르겠어요’ 없음). 고정지출에 포함.
// 지출 합계 > 수입이면 한 번 확인.
export function O39LoanRepayment() {
  const s = useStep('o-39');
  const sp = s.state.space;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = v === undefined ? (sp?.loan_repayment ?? null) : v;
  const odd = (amount: number) =>
    (sp?.fixed_total ?? 0) + (sp?.living_budget ?? 0) + amount > monthIncome(s.state);
  const save = (amount: number) => s.done(() => saveSpace({ loan_repayment: amount }));
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.loan}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
      onSubmit={() => value && ok.check(odd(value)) && void save(value)}
    >
      <AmountInput
        label={copy.loan}
        value={value}
        onChange={(x) => {
          setV(x);
          ok.reset();
        }}
        quick={quickChips.small}
        monthly
        zeroLink={{ label: copy.none, onClick: () => void save(0) }}
      />
      {ok.banner}
    </QuestionLayout>
  );
}
