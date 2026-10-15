import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';
import { useCheckOnce } from '../check-once';

const ODD = 100_000_000;

// P-05 내 수입(O-31과 같은 Q3). 시작한 사람이 적은 추정값이 채워진 채 열림, 항상 내가 확정. 프리랜서·사업자는 가장 적게 번 달.
export function P05Income() {
  const s = useJoinStep('p-05');
  const d = s.d;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const ok = useCheckOnce();
  if (!d.ready || !d.me) return null;
  const variable = d.me.employment === 'freelance';
  const prefilled = d.me.monthly_income !== null;
  const value = v === undefined ? d.me.monthly_income : v;
  const valid = value !== null && (variable ? value >= 0 : value > 0);
  const title = variable ? copy.incomeLow : copy.income;
  const save = (amount: number) =>
    s.done(() => saveMe({ monthly_income: amount, income_variable: variable }));
  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      help={
        variable
          ? copy.incomeLowHelp
          : prefilled
            ? copy.incomeFromStarter(d.couple?.partnerName ?? '')
            : copy.incomeHelp
      }
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => value !== null && valid && ok.check(value > ODD) && void save(value)}
    >
      <AmountInput
        label={title}
        value={value}
        onChange={(x) => {
          setV(x);
          ok.reset();
        }}
        quick={quickChips.small}
        monthly
        allowZero={variable}
        zeroLink={
          d.me.employment === 'resting'
            ? { label: copy.noIncome, onClick: () => void save(0) }
            : undefined
        }
      />
      {ok.banner}
    </QuestionLayout>
  );
}
