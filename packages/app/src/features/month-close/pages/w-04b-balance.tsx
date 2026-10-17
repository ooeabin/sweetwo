import { saveCloseBalances, updateAsset, updateMonthClose } from '@sweetwo/api';
import { balanceOdd, readWon } from '@sweetwo/core';
import { AmountCell, QuestionLayout } from '@sweetwo/ui';
import { useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

// W-04b 통장 잔액(꼼꼼 모드, docs/spec/21-month-close.md). 공동 통장 전부(추가·삭제 없음, 예비부부는 결혼 준비 통장 1행).
// ‘계획대로라면’ 누르면 예상 잔액을 채움, 입력 즉시 예상과 비교, 채운 행만 합계, 모든 행을 채워야 다음.
// 이상값(차이가 예상의 50% 이상이면서 100만 원 이상)은 “입력한 값이 맞나요?” 한 번, 막지 않음.
// 입력값은 연결 자산 금액에 바로 반영.
export function W04bBalance() {
  const nav = useNavigate();
  const d = useDetailData();
  const uid = useId();
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [asked, setAsked] = useState(false);
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (!d.planId) return <Navigate to={closePath('w-04a')} replace />;
  if (d.skip('w-04b')) return <Navigate to={closePath(d.nextOf('w-04b'))} replace />;

  const value = (r: (typeof d.rows)[number]) => (r.id in values ? values[r.id] : r.amount) ?? null;
  const filled = d.rows.filter((r) => value(r) !== null);
  const total = filled.reduce((t, r) => t + (value(r) ?? 0), 0);
  const odd = d.rows.some((r) => {
    const v = value(r);
    return v !== null && balanceOdd(v, r.expected);
  });

  const next = async () => {
    if (saving || !d.closeId || filled.length < d.rows.length) return;
    if (odd && !asked) return setAsked(true);
    setSaving(true);
    try {
      await saveCloseBalances(
        d.closeId,
        d.rows.map((r) => ({ account_id: r.id, amount: value(r) ?? 0, expected: r.expected })),
      );
      for (const r of d.rows)
        if (r.assetId) await updateAsset(r.assetId, { amount: value(r) ?? 0 });
      if (!d.close?.detailed_at)
        await updateMonthClose(d.closeId, { detailed_at: new Date().toISOString() });
      await d.refreshDetail();
      setSaving(false);
      nav(closePath(d.nextOf('w-04b')));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void next() });
    }
  };

  return (
    <QuestionLayout
      steps={d.progress('w-04b')}
      title={copy.balanceTitle}
      onBack={() => nav(closePath('w-04g'))}
      primary={{ label: copy.next, disabled: filled.length < d.rows.length, loading: saving }}
      onSubmit={() => void next()}
    >
      <div className="hg-spend">
        <div className="hg-spend__group" role="group" aria-label={copy.balanceTitle}>
          {d.rows.map((r) => {
            const id = `${uid}-${r.id}`;
            const v = value(r);
            const diff = v !== null && r.expected !== null ? v - r.expected : null;
            return (
              <div key={r.id} className="hg-spend__row">
                <label className="hg-spend__name" htmlFor={id}>
                  {r.name}
                  {r.expected !== null && (
                    <small>
                      <button
                        type="button"
                        className="hg-btn hg-btn--link"
                        onClick={() => setValues((x) => ({ ...x, [r.id]: r.expected }))}
                      >
                        {copy.asPlanned(readWon(r.expected))}
                      </button>
                    </small>
                  )}
                  {diff !== null && (
                    <small aria-live="polite">
                      {diff === 0
                        ? copy.balanceSame
                        : diff < 0
                          ? copy.balanceLess(readWon(-diff))
                          : copy.balanceMore(readWon(diff))}
                    </small>
                  )}
                </label>
                <AmountCell
                  id={id}
                  value={v}
                  onChange={(a) => {
                    setAsked(false);
                    setValues((x) => ({ ...x, [r.id]: a }));
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="hg-spend__total" aria-live="polite">
          <span>{copy.balanceTotal(readWon(total))}</span>
        </div>
      </div>
      {asked && (
        <p className="hg-help" role="alert" style={{ margin: 0 }}>
          {copy.balanceOdd}
        </p>
      )}
    </QuestionLayout>
  );
}
