import { quickChips } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { useAddStep } from '../add/step';

type Pick = 'new' | 'none';

// G-03d 이미 모아둔 돈(O-25와 같음). 가진 자산에서 고르기는 우리 자산(F-01)을 만든 뒤에 열림(자산이 없으면 숨김).
// 새로 입력한 돈은 지금은 기타 보유액으로 저장(자산으로 저장은 우리 자산과 함께).
export function G03dGoalHeld() {
  const s = useAddStep('held');
  const saved = s.draft.held;
  const [pick, setPick] = useState<Pick | null>(
    typeof saved === 'number' || saved === 'new' ? 'new' : saved === 'none' ? 'none' : null,
  );
  const [amount, setAmount] = useState<number | null>(typeof saved === 'number' ? saved : null);
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.heldTitle}
      onBack={s.onBack}
      primary={
        pick === 'new' ? { label: copy.next, disabled: amount === null || amount <= 0 } : undefined
      }
      onSubmit={() => pick === 'new' && amount && s.next({ held: amount })}
    >
      <ChoiceCards<Pick>
        label={copy.heldTitle}
        value={pick}
        onChange={setPick}
        onPick={(v) => v === 'none' && s.next({ held: 'none' })}
        options={[
          { value: 'new', label: copy.heldNew },
          { value: 'none', label: copy.heldNone },
        ]}
      />
      {pick === 'new' && (
        <AmountInput
          label={copy.heldAmount}
          value={amount}
          onChange={setAmount}
          quick={quickChips.small}
          embedded
        />
      )}
    </QuestionLayout>
  );
}
