import { completeJoin } from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import { AmountInput, DayChips, QuestionLayout, SectionHeader } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인
type Day = number | 'last';

// P-05 내 월급(O-31과 같음): 금액 + 매달 달라요 + 월급날. 시작한 사람이 아직 온보딩 중이면 이 화면 저장 = 합류 완료(홈 대기).
export function P05Salary() {
  const s = useJoinStep('p-05');
  const d = s.d;
  const me = d.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [asked, setAsked] = useState(false);
  if (!d.ready || !me) return null;
  const value = amount === undefined ? (me.monthly_income ?? null) : amount;
  const isVariable = variable ?? me.income_variable ?? false;
  const savedDay: Day | null = me.payday_last ? 'last' : (me.payday ?? null);
  const payday = day === undefined ? savedDay : day;
  const valid = value !== null && value > 0 && payday !== null;
  const odd = value !== null && value > ODD;

  const save = (income: number, dd: Day | null) =>
    s.done(async () => {
      await saveMe({
        monthly_income: income,
        income_variable: income > 0 && isVariable,
        payday: typeof dd === 'number' ? dd : null,
        payday_last: dd === 'last',
      });
      if (s.last) await completeJoin();
    });
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => {
        if (!valid) return;
        if (odd && !asked) return setAsked(true);
        void save(value, payday);
      }}
    >
      <AmountInput
        label={copy.salary}
        value={value}
        onChange={(x) => {
          setAmount(x);
          setAsked(false);
        }}
        quick={quickChips.small.slice(1)}
        monthly
        embedded
        zeroLink={{ label: copy.noSalary, onClick: () => void save(0, null) }}
      />
      {asked && (
        <p className="hg-help" role="status">
          {copy.checkValue}
        </p>
      )}
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
      <SectionHeader title={copy.payday} />
      <DayChips label={copy.payday} value={payday} onChange={setDay} lastLabel={copy.paydayLast} />
    </QuestionLayout>
  );
}
