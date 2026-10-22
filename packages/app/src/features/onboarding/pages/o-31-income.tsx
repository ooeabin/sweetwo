import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인

// O-31 월 실수령. 프리랜서·사업자는 ‘가장 적게 번 달’(0원 허용, 기준 수입). ‘쉬는 중’은 ‘지금은 수입이 없어요’ = 0원.
export function O31Income() {
  const s = useStep('o-31');
  const me = s.state.me;
  const [v, setV] = useState<number | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const variable = me?.employment === 'freelance';
  const value = v === undefined ? (me?.monthly_income ?? null) : v;
  const title = variable ? copy.incomeLow : copy.income(me?.nickname ?? '');
  const valid = value !== null && (variable ? value >= 0 : value > 0);
  const save = (amount: number) =>
    s.done(() => saveMe({ monthly_income: amount, income_variable: variable }));
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={title}
      help={variable ? copy.incomeLowHelp : copy.incomeHelp}
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
          me?.employment === 'resting'
            ? { label: copy.noIncome, onClick: () => void save(0) }
            : undefined
        }
      />
      {ok.banner}
    </QuestionLayout>
  );
}
