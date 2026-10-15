import { ensureMonthClose, updateMonthClose } from '@sweetwo/api';
import { formatManWon, readPlanSnapshot, readWon } from '@sweetwo/core';
import { MonthSummary, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, closeProgress, useCloseData } from '../data';

// W-04g 정산 요약(docs/spec/21-month-close.md, MonthSummary). 계산은 core monthSummary.
// 지난달보다 칩, 생활비 예산 보정 제안, 미달·초과 처리는 정리한 달이 쌓인 뒤(두 번째 정리부터).
export function W04gSummary() {
  const nav = useNavigate();
  const d = useCloseData();
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.close) return null;

  const c = d.close;
  const fixed = (d.space?.fixed_total ?? 0) + (d.space?.loan_repayment ?? 0);
  const variable = c.spends.reduce((t, x) => t + x.amount, 0);
  const big = c.bigs.reduce((t, x) => t + x.amount, 0);
  const saved = c.deposits.reduce((t, x) => t + x.amount, 0);
  // 계획 = 이번 플랜의 목표자금 + 비상금
  const parts = readPlanSnapshot(d.plan?.snapshot).parts;
  const planSaving = parts ? parts.goalFund + parts.emergency : 0;
  const me = d.me?.nickname ?? '';

  const finish = async () => {
    if (!d.planId || !d.me || saving) return;
    setSaving(true);
    try {
      const id = await ensureMonthClose(d.planId);
      await updateMonthClose(id, {
        status: 'done',
        closed_by: d.me.id,
        closed_at: new Date().toISOString(),
      });
      await d.refreshClose();
      setSaving(false);
      nav(closePath('w-04-end'), { replace: true });
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void finish() });
    }
  };

  return (
    <QuestionLayout
      steps={closeProgress('w-04g')}
      title={
        planSaving > 0
          ? copy.saved(readWon(saved), Math.round((saved * 100) / planSaving))
          : copy.summary(d.month)
      }
      onBack={() => nav(closePath('w-04k'))}
      primary={{ label: copy.finish, loading: saving }}
      onSubmit={() => void finish()}
    >
      <MonthSummary
        monthLabel={copy.summary(d.month)}
        income={c.income ?? 0}
        fixed={fixed}
        variable={variable}
        allowance={d.allowance}
        allowanceNote={d.joined ? undefined : copy.allowanceNote(me, formatManWon(d.myAllowance))}
        bigExpense={big}
        bigExpenseNote={c.bigs.map((b) => b.name).join(', ') || undefined}
        saved={saved}
        note={
          d.joined || d.space?.couple_state === 'solo'
            ? undefined
            : copy.myMoneyOnly(d.space?.partner_nickname ?? '', me)
        }
      />
    </QuestionLayout>
  );
}
