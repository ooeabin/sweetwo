import { bands, quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { monthIncome } from '../flow';
import { useStep } from '../step';

// O-36 합계(같이 내는 고정지출, Q3 + ‘잘 모르겠어요’ 구간 = 생활비 구간, 중간값 ‘추정’).
// 합계 + 생활비 + 대출 상환 > 월 수입이면 한 번 확인.
export function O36tFixedTotal() {
  const s = useStep('o-36t');
  const sp = s.state.space;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = v === undefined ? (sp?.fixed_total ?? null) : v;
  const odd = (amount: number) =>
    amount + (sp?.living_budget ?? 0) + (sp?.loan_repayment ?? 0) > monthIncome(s.state);
  const save = (amount: number, estimated: boolean) =>
    s.done(() => saveSpace({ fixed_total: amount, fixed_total_estimated: estimated }));
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.fixedTotal}
      help={copy.fixedTotalHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
      onSubmit={() => value && ok.check(odd(value)) && void save(value, false)}
    >
      <AmountInput
        label={copy.fixedTotal}
        value={value}
        onChange={(x) => {
          setV(x);
          ok.reset();
        }}
        quick={quickChips.small}
        monthly
        bands={bands.livingCost}
        unsureLabel={copy.unsure}
        onBand={(b) => void save(b.value, true)}
      />
      {ok.banner}
    </QuestionLayout>
  );
}
