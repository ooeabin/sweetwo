import { updateAsset } from '@sweetwo/api';
import { AmountCell, QuestionLayout } from '@sweetwo/ui';
import { useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

// W-04e 투자 평가액(꼼꼼 모드, 투자 자산이 있을 때): 항목별 금액(지난 값 채움), 바꾼 것만 저장.
// ‘그대로예요’ = 건너뛰기. 평소엔 자산 화면에서 고침.
export function W04eInvest() {
  const nav = useNavigate();
  const d = useDetailData();
  const uid = useId();
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (d.skip('w-04e')) return <Navigate to={closePath(d.nextOf('w-04e'))} replace />;
  const next = () => nav(closePath(d.nextOf('w-04e')));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      for (const a of d.invest) {
        const v = values[a.id];
        if (v !== undefined && v !== null && v !== a.amount) await updateAsset(a.id, { amount: v });
      }
      await d.refreshDetail();
      setSaving(false);
      next();
    } catch {
      setSaving(false);
      toast(copy.saveFailed);
    }
  };

  return (
    <QuestionLayout
      steps={d.progress('w-04e')}
      title={copy.investTitle}
      onBack={() => nav(closePath(d.prevOf('w-04e')))}
      later={{ label: copy.investSame, onClick: next }}
      primary={{ label: copy.next, loading: saving }}
      onSubmit={() => void save()}
    >
      <div className="hg-spend">
        <div className="hg-spend__group" role="group" aria-label={copy.investTitle}>
          {d.invest.map((a) => {
            const id = `${uid}-${a.id}`;
            return (
              <div key={a.id} className="hg-spend__row">
                <label className="hg-spend__name" htmlFor={id}>
                  {a.name}
                </label>
                <AmountCell
                  id={id}
                  value={a.id in values ? (values[a.id] ?? null) : a.amount}
                  onChange={(v) => setValues((x) => ({ ...x, [a.id]: v }))}
                />
              </div>
            );
          })}
        </div>
      </div>
    </QuestionLayout>
  );
}
