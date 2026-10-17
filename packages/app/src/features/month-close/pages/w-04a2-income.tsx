import { answerActualIncome } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { AmountInput, Button, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, useCloseData } from '../data';

// W-04a2 실제 수입(docs/spec/21-month-close.md, 06 7장): 변동 수입 당사자만. Q3, 기본값 없음, 0원 허용.
// 기준보다 적으면 차액을 다음 사이클 ‘비상금 → 공동 생활비’ 줄로 보충(즉시 적용 + 상대 알림, 서버),
// 많으면 추가 소득 나누기(W-07) 안내. 배우자가 정리할 때 1문항 카드, 기준일 전날까지 답이 없으면 기준 수입은 다음 단계.
export function W04a2Income() {
  const nav = useNavigate();
  const d = useCloseData();
  const [value, setValue] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (!d.me?.income_variable || !d.close) return <Navigate to={closePath('w-04j')} replace />;
  const closeId = d.close.id;
  const next = () => nav(closePath('w-04j'));

  const save = async () => {
    if (saving || value === null) return;
    setSaving(true);
    try {
      const diff = await answerActualIncome(closeId, value);
      await d.refreshClose();
      setSaving(false);
      if (diff > 0) return setOver(diff);
      if (diff < 0) toast(copy.incomeShortToast(readWon(-diff)));
      next();
    } catch {
      setSaving(false);
      toast(copy.saveFailed);
    }
  };

  if (over !== null)
    return (
      <QuestionLayout
        title={copy.incomeOverTitle(readWon(over))}
        help={copy.incomeOverHelp}
        primary={{ label: copy.next }}
        onSubmit={next}
      >
        <Button variant="secondary" onClick={() => nav('/plan/income/new')}>
          {copy.incomeOverGo}
        </Button>
      </QuestionLayout>
    );

  return (
    <QuestionLayout
      title={copy.actualTitle}
      onBack={() => nav(closePath('w-04a'))}
      primary={{ label: copy.next, disabled: value === null, loading: saving }}
      onSubmit={() => void save()}
    >
      <AmountInput label={copy.actualTitle} value={value} onChange={setValue} allowZero />
    </QuestionLayout>
  );
}
