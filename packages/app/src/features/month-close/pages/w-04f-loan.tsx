import { updateAsset } from '@sweetwo/api';
import { formatManWon, loanAfter } from '@sweetwo/core';
import { AmountCell, QuestionLayout } from '@sweetwo/ui';
import { useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

// W-04f 대출(꼼꼼 모드, 월 상환액이 있는 대출이 있을 때): 월 상환액만큼 차감한 값을 채워 두고 ‘맞아요’,
// 칸을 고치면 그 값(수정 → Q3).
export function W04fLoan() {
  const nav = useNavigate();
  const d = useDetailData();
  const uid = useId();
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (d.skip('w-04f')) return <Navigate to={closePath(d.nextOf('w-04f'))} replace />;
  const value = (a: (typeof d.loans)[number]) =>
    a.id in values ? (values[a.id] ?? null) : loanAfter(a.amount, a.monthly_payment);
  const ready = d.loans.every((a) => value(a) !== null);

  const save = async () => {
    if (saving || !ready) return;
    setSaving(true);
    try {
      for (const a of d.loans) {
        const v = value(a) ?? a.amount;
        if (v !== a.amount) await updateAsset(a.id, { amount: v });
      }
      await d.refreshDetail();
      setSaving(false);
      nav(closePath(d.nextOf('w-04f')));
    } catch {
      setSaving(false);
      toast(copy.saveFailed);
    }
  };

  return (
    <QuestionLayout
      steps={d.progress('w-04f')}
      title={copy.loanTitle}
      onBack={() => nav(closePath(d.prevOf('w-04f')))}
      primary={{ label: copy.usesRight, disabled: !ready, loading: saving }}
      onSubmit={() => void save()}
    >
      <div className="hg-spend">
        <div className="hg-spend__group" role="group" aria-label={copy.loanTitle}>
          {d.loans.map((a) => {
            const id = `${uid}-${a.id}`;
            return (
              <div key={a.id} className="hg-spend__row">
                <label className="hg-spend__name" htmlFor={id}>
                  {a.name}
                  <small>{copy.loanHelp(formatManWon(a.monthly_payment ?? 0))}</small>
                </label>
                <AmountCell
                  id={id}
                  value={value(a)}
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
