import { bands, quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { monthIncome } from '../flow';
import { useStep } from '../step';

// O-38 생활비 예산 초깃값(Q3 + ‘잘 모르겠어요’ 구간, 중간값 ‘추정’). 항목별 실제는 첫 월말 정리 W-04j에서.
export function O38LivingBudget() {
  const s = useStep('o-38');
  const sp = s.state.space;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = v === undefined ? (sp?.living_budget ?? null) : v;
  const odd = (amount: number) =>
    (sp?.fixed_total ?? 0) + amount + (sp?.loan_repayment ?? 0) > monthIncome(s.state);
  const save = (amount: number, estimated: boolean) =>
    s.done(() => saveSpace({ living_budget: amount, living_budget_estimated: estimated }));
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.living}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
      onSubmit={() => value && ok.check(odd(value)) && void save(value, false)}
    >
      <AmountInput
        label={copy.living}
        value={value}
        onChange={(x) => {
          setV(x);
          ok.reset();
        }}
        quick={quickChips.small}
        monthly
        bands={bands.livingCost}
        unsureLabel={copy.unsureLater}
        onBand={(b) => void save(b.value, true)}
      />
      {ok.banner}
    </QuestionLayout>
  );
}
