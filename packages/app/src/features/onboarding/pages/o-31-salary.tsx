import { quickChips } from '@sweetwo/core';
import { AmountInput, DayChips, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인
type Day = number | 'last';

// O-31 월급(금액 + 월급날, 17 온보딩 ②). ‘매달 금액이 달라요’면 가장 적게 들어온 달 기준.
// ‘지금은 월급이 없어요’ = 금액 0, 월급날 없음 → O-50은 저금 줄 0원.
export function O31Salary() {
  const s = useStep('o-31');
  const me = s.state.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const value = amount === undefined ? (me?.monthly_income ?? null) : amount;
  const isVariable = variable ?? me?.income_variable ?? false;
  const savedDay: Day | null = me?.payday_last ? 'last' : (me?.payday ?? null);
  const payday = day === undefined ? savedDay : day;
  const valid = value !== null && value > 0 && payday !== null;

  const save = (income: number, d: Day | null) =>
    s.done(() =>
      saveMe({
        monthly_income: income,
        income_variable: income > 0 && isVariable,
        payday: typeof d === 'number' ? d : null,
        payday_last: d === 'last',
      }),
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => valid && ok.check(value > ODD) && void save(value, payday)}
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
        zeroLink={{ label: copy.noSalary, onClick: () => void save(0, null) }}
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
      <DayChips label={copy.payday} value={payday} onChange={setDay} lastLabel={copy.paydayLast} />
    </QuestionLayout>
  );
}
