import { ensureMonthClose, restMissedMonths, saveDeposits, updateMonthClose } from '@sweetwo/api';
import { formatManWon, readWon } from '@sweetwo/core';
import { AmountCell, QuestionLayout } from '@sweetwo/ui';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, closeProgress, useCloseData } from '../data';

// W-04k 저축 확인(docs/spec/21-month-close.md). 목표마다 이번 달 넣은 돈, 월급 플랜 계획액을 채워 둠 + ‘기타 저축’.
// 저축 상품(청약, 적금 등 연결 자산)은 우리 자산을 만든 뒤 상품별로.
export function W04kSavings() {
  const nav = useNavigate();
  const d = useCloseData();
  const uid = useId();
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;

  const planned = (goalId: string) =>
    (d.plan?.lines ?? [])
      .filter((l) => l.target === 'goal' && l.goal_id === goalId)
      .reduce((t, l) => t + l.amount, 0);
  const rows = [
    ...d.goals
      .filter((g) => !g.after_marriage && g.status !== 'paused')
      .map((g) => ({
        key: g.id,
        goalId: g.id as string | null,
        name: g.name,
        planned: planned(g.id),
      })),
    { key: 'etc', goalId: null, name: copy.otherSaving, planned: 0 },
  ];
  const saved = Object.fromEntries((d.close?.deposits ?? []).map((x) => [x.name, x.amount]));
  const value = (r: (typeof rows)[number]) =>
    r.key in amounts ? (amounts[r.key] ?? null) : (saved[r.name] ?? (r.planned || null));
  const total = rows.reduce((t, r) => t + (value(r) ?? 0), 0);

  const next = async () => {
    if (!d.planId || saving) return;
    setSaving(true);
    try {
      const closeId = await ensureMonthClose(d.planId);
      await saveDeposits(
        closeId,
        rows
          .filter((r) => (value(r) ?? 0) > 0 || r.name in saved)
          .map((r) => ({ name: r.name, goal_id: r.goalId, amount: value(r) ?? 0 })),
      );
      if (d.rest && d.me) {
        // 쉬어가기: 그달 합계만 적고 끝(정산 요약·미달 처리 없음)
        await updateMonthClose(closeId, {
          status: 'done',
          closed_by: d.me.id,
          closed_at: new Date().toISOString(),
          late: true,
          rested: true,
        });
        await restMissedMonths(d.restPlans);
        await d.refreshClose();
        setSaving(false);
        return nav(closePath('w-04-end'), { replace: true });
      }
      await d.refreshClose();
      setSaving(false);
      nav(closePath(d.adjust ? 'w-04h' : 'w-04g'));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void next() });
    }
  };

  return (
    <QuestionLayout
      steps={closeProgress('w-04k', d.adjust)}
      title={copy.savingsTitle}
      help={copy.savingsHelp}
      onBack={() => nav(closePath('w-04j'))}
      primary={{ label: copy.next, loading: saving }}
      onSubmit={() => void next()}
    >
      <div className="hg-spend">
        <div className="hg-spend__group" role="group" aria-label={copy.savingsTitle}>
          {rows.map((r) => {
            const id = `${uid}-${r.key}`;
            return (
              <div key={r.key} className="hg-spend__row">
                <label className="hg-spend__name" htmlFor={id}>
                  {r.name}
                  {r.planned > 0 && <small>{copy.planned(formatManWon(r.planned))}</small>}
                </label>
                <AmountCell
                  id={id}
                  value={value(r)}
                  onChange={(a) => setAmounts((x) => ({ ...x, [r.key]: a }))}
                />
              </div>
            );
          })}
        </div>
        <div className="hg-spend__total" aria-live="polite">
          <span>{copy.savingsTotal}</span>
          <b>{readWon(total)}</b>
        </div>
      </div>
    </QuestionLayout>
  );
}
