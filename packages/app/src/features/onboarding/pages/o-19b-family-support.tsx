import { quickChips } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type A = keyof typeof copy.familySupportChoices;

// O-19b 양가 지원(Q1 → Q3). 네 → 금액(양가 합계), 아니요 → 0원, 아직 몰라요·금액 모름 → 0원 ‘추정’
// (할 일 ‘양가 지원 금액 알려주기’는 할 일 단계에서)
export function O19bFamilySupport() {
  const s = useStep('o-19b');
  const sp = s.state.space;
  const [answer, setAnswer] = useState<A | null | undefined>(undefined);
  const [v, setV] = useState<number | null | undefined>(undefined);
  if (!s.ready) return null;
  const a = answer === undefined ? ((sp?.family_support_answer as A | null) ?? null) : answer;
  const value =
    v === undefined ? (sp?.family_support_answer === 'yes' ? sp.family_support : null) : v;
  const save = (ans: A, amount: number, estimated: boolean) =>
    s.done(() =>
      saveSpace({
        family_support_answer: ans,
        family_support: amount,
        family_support_estimated: estimated,
      }),
    );

  if (a === 'yes') {
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.familySupportAmount}
        onBack={() => setAnswer(null)}
        primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
        onSubmit={() => value && void save('yes', value, false)}
      >
        <GoalChip name={copy.weddingGoalChip} index={2} total={3} />
        <AmountInput
          label={copy.familySupportAmount}
          value={value}
          onChange={setV}
          quick={quickChips.small}
          zeroLink={{ label: copy.amountUnknown, onClick: () => void save('yes', 0, true) }}
        />
      </QuestionLayout>
    );
  }
  return (
    <QuestionLayout steps={s.steps} title={copy.familySupport} onBack={s.onBack}>
      <GoalChip name={copy.weddingGoalChip} index={2} total={3} />
      <ChoiceCards<A>
        label={copy.familySupport}
        value={a}
        onChange={setAnswer}
        onPick={(x) => {
          if (x === 'no') void save('no', 0, false);
          if (x === 'unknown') void save('unknown', 0, true);
        }}
        options={(Object.keys(copy.familySupportChoices) as A[]).map((k) => ({
          value: k,
          label: copy.familySupportChoices[k],
        }))}
      />
    </QuestionLayout>
  );
}
