import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { useMonthView } from '../../month';
import { useSplitActions } from '../actions';
import { copy } from '../copy';

// W-02a 다른 금액(Q3): “얼마를 옮겼어요?”, 계획액이 기본값. 차이 “계획보다 10만 원 적어요”(미달·초과는 월말 정리에서).
// ‘확인’ = 그 몫 완료 + 실제 금액 → W-02
export function W02aOtherAmount() {
  const nav = useNavigate();
  const { lineId = '' } = useParams();
  const [params] = useSearchParams();
  const v = useMonthView();
  const { masked } = useMask();
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const act = useSplitActions(v?.partnerName ?? '');
  if (!v) return null;
  const side = params.get('side') === 'bride' ? 'bride' : 'groom';
  const row = [...v.split.mine, ...v.split.partner].find(
    (r) => r.lineId === lineId && r.side === side,
  );
  if (!row) return <Navigate to="/plan/split" replace />;
  const amount = value === undefined ? (row.doneAmount ?? row.amount) : value;
  const diff = amount === null ? 0 : amount - row.amount;

  return (
    <QuestionLayout
      title={copy.otherTitle}
      help={
        diff < 0
          ? copy.less(money(-diff, masked))
          : diff > 0
            ? copy.more(money(diff, masked))
            : undefined
      }
      onBack={() => nav('/plan/split')}
      primary={{ label: copy.confirm, disabled: amount === null, loading: saving }}
      onSubmit={async () => {
        if (amount === null || saving) return;
        setSaving(true);
        const r = await act.check(row.lineId, side, amount);
        setSaving(false);
        if (r) nav('/plan/split', { replace: true });
      }}
    >
      <AmountInput
        label={copy.otherTitle}
        value={amount}
        onChange={setValue}
        quick={quickChips.small}
        allowZero
      />
    </QuestionLayout>
  );
}
