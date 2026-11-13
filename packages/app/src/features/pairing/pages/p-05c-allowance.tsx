import { round10k } from '@sweetwo/core';
import { AmountInput, Icon, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

// P-05c 용돈(관리하지 않는 쪽만, 18 v2.2, P-05b 다음. v2 P-04a 번호는 쓰지 않음):
// “용돈은 얼마로 할까요?” / 보조 “나머지는 {관리하는 사람}님에게 보내요” + 주 버튼 위 회색
// “{관리하는 사람}님도 용돈을 고칠 수 있어요. 고치면 알려 드려요”(G9). 처음 값 월급 × 10%(1만 원 단위), 0 ≤ 용돈 ≤ 월급.
// 저장 = 내 정보(allowance)에 남기고 합류 완료: ‘용돈’ 자동 줄 + 서버가 ‘보내기’(월급 − 용돈) 자동 줄, 나가는 날 = 월급날 → P-10
export function P05cAllowance() {
  const s = useJoinStep('p-05c');
  const d = s.d;
  const me = d.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  if (!d.ready || !me)
    return (
      <QuestionSkeleton title={copy.allowanceTitle} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  const income = me.monthly_income ?? 0;
  const value = amount === undefined ? (me.allowance ?? round10k(income / 10)) : amount;
  const over = value !== null && value > income;
  const valid = value !== null && value >= 0 && !over;
  const manager = d.starterName;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.allowanceTitle}
      help={copy.allowanceHelp(manager)}
      onBack={s.onBack}
      note={copy.allowanceNote(manager)}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      onSubmit={() => valid && void s.done(() => saveMe({ allowance: value }))}
    >
      <AmountInput
        label={copy.allowanceTitle}
        value={value}
        onChange={setAmount}
        monthly
        embedded
        allowZero
      />
      {over && (
        <div className="hg-banner hg-banner--check" role="alert">
          <Icon name="circle-alert" />
          <span>{copy.allowanceOver}</span>
        </div>
      )}
    </QuestionLayout>
  );
}
