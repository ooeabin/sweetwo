import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveRecommendedSplit } from '../auto-split';
import { saveMe } from '../data';
import { useStep } from '../step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인

// O-31 월급 금액(17 온보딩 ②) → O-32 월급날. ‘매달 금액이 달라요’면 가장 적게 들어온 달 기준.
// ‘지금은 월급이 없어요’ = 금액 0, 월급날 없음 → 0원 분배표를 만들고 바로 홈(ADR 0005).
export function O31Salary() {
  const s = useStep('o-31');
  const me = s.state.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = amount === undefined ? (me?.monthly_income ?? null) : amount;
  const isVariable = variable ?? me?.income_variable ?? false;
  const valid = value !== null && value > 0;

  const save = (income: number) =>
    s.done(() => saveMe({ monthly_income: income, income_variable: isVariable }));
  // 월급이 없으면 월급날도 없음: 0원 분배표를 만들고 온보딩 끝
  const noSalary = () =>
    s.finish(async () => {
      await saveMe({ monthly_income: 0, income_variable: false, payday: null, payday_last: false });
      await saveRecommendedSplit();
    });
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => valid && ok.check(value > ODD) && void save(value)}
    >
      <AmountInput
        label={copy.salary}
        value={value}
        onChange={(x) => {
          setAmount(x);
          ok.reset();
        }}
        quick={quickChips.small.slice(1)}
        monthly
        embedded
        zeroLink={{ label: copy.noSalary, onClick: () => void noSalary() }}
      />
      {ok.banner}
      <button
        type="button"
        role="checkbox"
        aria-checked={isVariable}
        className="hg-consent__check"
        onClick={() => setVariable(!isVariable)}
      >
        <span className={isVariable ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
        <span className="hg-consent__label">{copy.salaryVariable}</span>
      </button>
    </QuestionLayout>
  );
}
