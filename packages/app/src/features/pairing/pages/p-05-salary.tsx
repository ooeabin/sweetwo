import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { useCheckOnce } from '../check-once';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인

// P-05 내 월급(O-31과 같음): 금액 + 매달 달라요. 월급날은 P-05b(2026-11-03, 온보딩처럼 화면을 나눔). 월급이 없으면 P-05b 없이 합류 완료.
export function P05Salary() {
  const s = useJoinStep('p-05');
  const d = s.d;
  const me = d.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  // 큰 값 한 번 확인은 O-31과 같은 확인 띠(2026-11-11 S3-25, 작은 회색 글 대신)
  const once = useCheckOnce();
  if (!d.ready || !me)
    return <QuestionSkeleton title={copy.salary} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const value = amount === undefined ? (me.monthly_income ?? null) : amount;
  const isVariable = variable ?? me.income_variable ?? false;
  const valid = value !== null && value > 0;
  const odd = value !== null && value > ODD;

  const save = (income: number) =>
    s.done(
      () =>
        saveMe(
          income > 0
            ? { monthly_income: income, income_variable: isVariable }
            : { monthly_income: 0, income_variable: false, payday: null, payday_last: false },
        ),
      income > 0 ? undefined : null,
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => {
        if (!valid) return;
        if (!once.check(odd)) return;
        void save(value);
      }}
    >
      <AmountInput
        label={copy.salary}
        value={value}
        onChange={(x) => {
          setAmount(x);
          once.reset();
        }}
        quick={quickChips.small.slice(1)}
        monthly
        embedded
        zeroLink={{ label: copy.noSalary, onClick: () => void save(0) }}
        extra={
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
        }
      />
      {once.banner}
    </QuestionLayout>
  );
}
