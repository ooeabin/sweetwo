import { changeWeddingBudget } from '@sweetwo/api';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useWedding, weddingPath } from '../wedding/data';

// G-07 2번 총예산 누르면 Q3. 저장하면 연결된 부부는 제안(예식 30일 안이면 바로 + 알림), 아니면 바로.
export function G07WeddingBudget() {
  const nav = useNavigate();
  const w = useWedding();
  const [v, setV] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (w.loading) return null;
  const value = v === undefined ? w.budget : v;
  const save = async () => {
    if (saving || value === null) return;
    setSaving(true);
    try {
      const r = await changeWeddingBudget(null, value, w.applyOn);
      await w.refresh();
      toast(r === 'proposed' ? copy.proposed(w.d.couple?.partnerName ?? '') : copy.applied);
      nav(weddingPath, { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.budgetEdit}
      onBack={() => nav(weddingPath)}
      primary={{
        label: copy.next,
        disabled: value === null || value === w.budget,
        loading: saving,
      }}
      onSubmit={() => void save()}
    >
      <AmountInput label={copy.budgetEdit} value={value} onChange={setV} />
    </QuestionLayout>
  );
}
