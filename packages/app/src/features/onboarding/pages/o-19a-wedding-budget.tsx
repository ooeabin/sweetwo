import { bands, quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip, useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

// O-19a 결혼 준비 총예산(Q3). 0보다 크면 다음. 10억 이상이면 한 번 확인.
export function O19aWeddingBudget() {
  const s = useStep('o-19a');
  const sp = s.state.space;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const [est, setEst] = useState<boolean | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = v === undefined ? (sp?.wedding_budget ?? null) : v;
  const estimated = est ?? sp?.wedding_budget_estimated ?? false;
  const save = (amount: number, e: boolean) =>
    s.done(() => saveSpace({ wedding_budget: amount, wedding_budget_estimated: e }));
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.weddingBudget}
      help={copy.weddingBudgetHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
      onSubmit={() => value && ok.check(value >= 1_000_000_000) && void save(value, estimated)}
    >
      <GoalChip name={copy.weddingGoalChip} index={1} total={3} />
      <AmountInput
        label={copy.weddingBudget}
        value={value}
        onChange={(x) => {
          setV(x);
          setEst(false);
          ok.reset();
        }}
        quick={quickChips.big}
        bands={bands.weddingBudget}
        unsureLabel={copy.unsure}
        onBand={(b) => void save(b.value, true)}
      />
      {ok.banner}
    </QuestionLayout>
  );
}
