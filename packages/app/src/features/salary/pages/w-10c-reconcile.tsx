import { qk, reconcileSavings } from '@sweetwo/api';
import { amountBand } from '@sweetwo/core';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, toast } from '../../../shared/toast';
import { MoneyField } from '../bundle-parts';
import { copy } from '../copy';
import { salaryPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { refreshSaving } from '../together';

/**
 * W-10c 실제 잔액 맞추기(20 v2.2, G7): 내가 고칠 수 있는 저금(묶음은 내 줄만)마다 지금 모은 금액 + 칸 “실제로 모인 금액”(비우면 그대로)
 * → ‘맞추기’ = reconcile_savings(차이만큼 바로잡기, 사유 ‘잔액 맞추기’, 상대에게는 W-10b와 같은 한 줄). 칸이 다 비었으면
 * 맞춘 것 없이 날짜만 갱신(홈 띠 12번 사라짐). 홈 띠 12번, W-13 ⋯에서 열림
 */
export function W10cReconcile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const { masked } = useMask();
  const [actual, setActual] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState(false);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  if (!d.ready && d.failed) return <SavingQuestionError onBack={back} onRetry={d.retry} />;
  if (!d.ready) return <QuestionSkeleton title={copy.reconcileQ} />;
  const items = d.live.filter((i) => i.canEdit);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    const filled = items.filter((i) => actual[i.goal.id] != null);
    try {
      const n = await reconcileSavings(
        filled.map((i) => ({ goalId: i.goal.id, actual: actual[i.goal.id] ?? 0 })),
      );
      const diff = filled.reduce((t, i) => t + ((actual[i.goal.id] ?? 0) - i.saved), 0);
      track('savings_reconciled', {
        count: n,
        diff_sign: diff > 0 ? 'plus' : diff < 0 ? 'minus' : 'zero',
        diff_band: diff === 0 ? null : amountBand(Math.abs(diff)),
      });
      await refreshSaving(qc);
      await qc.invalidateQueries({ queryKey: qk.me });
      carryToast(copy.reconciled(n));
      nav(-1);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.reconcileQ}
      help={items.length ? copy.reconcileHelp : copy.reconcileEmpty}
      onBack={back}
      primary={{ label: copy.reconcileSave, loading: busy, disabled: !items.length }}
      onSubmit={() => void save()}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
        {items.map((i) => (
          <MoneyField
            key={i.goal.id}
            label={i.goal.name}
            help={copy.reconcileNow(money(i.saved, masked))}
            placeholder={copy.reconcileActual}
            value={actual[i.goal.id] ?? null}
            onChange={(v) => setActual((a) => ({ ...a, [i.goal.id]: v }))}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}
