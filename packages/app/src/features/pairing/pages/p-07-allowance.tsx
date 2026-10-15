import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

// P-07 내 용돈(Q3, 0원 허용). 초기값 = 시작한 사람 용돈과 같은 금액.
// 초기값과 다를 때 시작한 사람에게 제안으로 보내는 건 제안 기능과 함께(지금은 바로 저장).
export function P07Allowance() {
  const s = useJoinStep('p-07');
  const d = s.d;
  const [v, setV] = useState<number | null | undefined>(undefined);
  if (!d.ready || !d.me) return null;
  const initial = d.me.allowance ?? d.partner?.allowance ?? null;
  const value = v === undefined ? initial : v;
  const title = copy.allowance(d.me.nickname ?? '');
  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: value === null, loading: s.saving }}
      onSubmit={() => value !== null && void s.done(() => saveMe({ allowance: value }))}
    >
      <AmountInput
        label={title}
        value={value}
        onChange={setV}
        quick={quickChips.small}
        monthly
        allowZero
      />
    </QuestionLayout>
  );
}
