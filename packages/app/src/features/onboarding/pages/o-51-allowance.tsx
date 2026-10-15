import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { partnerJoined } from '../flow';
import { useStep } from '../step';
import { deferPart5 } from '../part5';

// O-51 내 용돈(Q3, 0원 허용, ‘잘 모르겠어요’ 없음). 미합류면 배우자 용돈도 같은 금액으로 계산.
export function O51Allowance() {
  const s = useStep('o-51');
  const me = s.state.me;
  const [v, setV] = useState<number | null | undefined>(undefined);
  if (!s.ready) return null;
  const value = v === undefined ? (me?.allowance ?? null) : v;
  const title = copy.allowance(me?.nickname ?? '');
  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      help={copy.allowanceHelp}
      onBack={s.onBack}
      later={{ label: copy.later, onClick: () => void deferPart5(s) }}
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
        placeholder={copy.allowancePlaceholder}
      />
      {!partnerJoined(s.state) && (
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.allowancePartnerSame(s.state.space?.partner_nickname ?? '')}
        </p>
      )}
    </QuestionLayout>
  );
}
