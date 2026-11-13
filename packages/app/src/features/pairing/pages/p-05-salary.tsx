import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { usePlanShareNote } from '../../../shared/plan-share-note';
import { useCheckOnce } from '../check-once';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

const ODD = 100_000_000; // 1억 원 초과면 한 번 확인

// P-05 내 월급(O-31과 같음): 금액 + 매달 달라요. 월급날은 P-05b(2026-11-03, 온보딩처럼 화면을 나눔).
// 2026-11-13 v2.2: 주 버튼 위 공개 고지 한 줄(O-31과 같음). 각자 계열은 금액 칸 아래 ‘월급 없이 합류할게요’ → 월급 계획 없이
// 합류 완료(P-05b·P-05c 없이 P-10). 같이 계열은 ‘지금은 월급이 없어요’(0원으로 합류).
export function P05Salary() {
  const s = useJoinStep('p-05');
  const d = s.d;
  const me = d.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  // 큰 값 한 번 확인은 O-31과 같은 확인 띠(2026-11-11 S3-25, 작은 회색 글 대신)
  const once = useCheckOnce();
  const joint = d.salaryMode === 'joint' || d.nonManager;
  const share = usePlanShareNote({
    joint,
    userId: me?.id ?? '',
    share: me?.plan_share ?? 'saving_only',
    screenId: 'P-05',
  });
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
      // 각자 계열 ‘월급 없이 합류할게요’: 월급 계획 없음, 확인 목록 없음(저금·묶음·돈 들어왔어요는 씀)
      { noPlan: income === 0 && !joint },
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      note={share.note}
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
        zeroLink={{ label: joint ? copy.noSalary : copy.noSalaryJoin, onClick: () => void save(0) }}
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
      {share.sheet}
    </QuestionLayout>
  );
}
