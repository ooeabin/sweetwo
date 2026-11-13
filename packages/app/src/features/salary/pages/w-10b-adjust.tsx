import { adjustSaving, SavingAdjustBlocked, undoSavingAdjust } from '@sweetwo/api';
import { amountBand } from '@sweetwo/core';
import {
  AmountInput,
  Checkbox,
  Chip,
  ChoiceCards,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { savingPaths, togetherPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { refreshSaving } from '../together';

type Sign = 'add' | 'sub';
type Reason = 'used' | 'interest' | 'fix' | 'custom';
const REASONS: Reason[] = ['used', 'interest', 'fix', 'custom'];

/**
 * W-10b 모은 금액 바로잡기(20 v2.2, ADR 0009 결정 4, G11): 더할게요/뺄게요 → 금액 → 사유 칩(나만 봄) + (같이 모으는 저금이면)
 * ‘주간 요약에 넣지 않기’ → adjust_saving + Toast ‘되돌리기’(undo_saving_adjust). 상대에게는 서버가 사람·금액·사유 없는 한 줄.
 * 단계는 주소(`/adjust/:step`): 1 부호, 2 금액, 3 사유
 */
export function W10bAdjust() {
  const { id = '', step = '1' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const { masked } = useMask();
  const [sign, setSign] = useState<Sign | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [text, setText] = useState('');
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = togetherPaths.adjust(id);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(savingPaths.item(id)));
  if (!d.ready && d.failed)
    return <SavingQuestionError onBack={() => nav(savingPaths.item(id))} onRetry={d.retry} />;
  if (!d.ready) return <QuestionSkeleton title={copy.adjustQ} />;
  const i = d.byId(id);
  if (!i || !i.canEdit) return <Navigate to={savingPaths.item(id)} replace />;
  const steps = { total: 3, now: Number(step) - 1 };
  // 1단계를 건너뛰고 들어오면 처음으로
  if (step !== '1' && !sign) return <Navigate to={`${base}/1`} replace />;
  // 같이 모으는 저금(공동, 합쳐서, 묶음): 상대에게 한 줄이 가므로 ‘주간 요약에 넣지 않기’를 보임(20 W-10b 3)
  const together = i.owner === 'ours' || d.joint || !!i.goal.bundle_id;

  if (step === '1')
    return (
      <QuestionLayout steps={steps} title={copy.adjustQ} onBack={back}>
        <ChoiceCards<Sign>
          label={copy.adjustQ}
          value={sign}
          onChange={setSign}
          onPick={() => nav(`${base}/2`)}
          options={[
            { value: 'add', label: copy.adjustAdd },
            { value: 'sub', label: copy.adjustSub },
          ]}
        />
      </QuestionLayout>
    );
  const over = sign === 'sub' && amount !== null && amount > i.saved;
  if (step === '2')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.adjustAmountQ(sign ?? 'add')}
        help={copy.adjustNow(money(i.saved, masked))}
        onBack={back}
        primary={{ label: copy.next, disabled: !amount || over }}
        onSubmit={() => nav(`${base}/3`)}
      >
        <AmountInput
          label={copy.adjustAmountQ(sign ?? 'add')}
          value={amount}
          onChange={setAmount}
        />
        {over && (
          <p className="hg-help is-error" role="alert">
            {copy.adjustOver}
          </p>
        )}
      </QuestionLayout>
    );
  if (!amount || over) return <Navigate to={`${base}/2`} replace />;
  const delta = sign === 'sub' ? -amount : amount;
  const save = async () => {
    if (busy || !reason) return;
    setBusy(true);
    try {
      const move = await adjustSaving({
        goalId: id,
        delta,
        reasonCode: reason,
        reason: reason === 'custom' ? text.trim() : copy.adjustReasons[reason],
        hideFromSummary: together && hide,
      });
      track('saving_adjusted', {
        sign: delta > 0 ? 'plus' : 'minus',
        amount_band: amountBand(amount),
        reason_code: reason,
        from: 'w10b',
      });
      if (together) track('adjust_summary_hidden', { on: hide });
      await refreshSaving(qc);
      carryToast(copy.adjusted, {
        label: copy.undo,
        onClick: () => quietly(undoSavingAdjust(move).then(() => refreshSaving(qc))),
      });
      nav(savingPaths.item(id), { replace: true });
    } catch (e) {
      toast(
        e instanceof SavingAdjustBlocked && e.reason === 'below_zero'
          ? copy.adjustOver
          : e instanceof SavingAdjustBlocked && e.reason === 'unlink_pending'
            ? copy.itemPending
            : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      steps={steps}
      title={copy.adjustReasonQ}
      help={copy.adjustReasonHelp}
      onBack={back}
      primary={{
        label: copy.adjustSave,
        disabled: !reason || (reason === 'custom' && !text.trim()),
        loading: busy,
      }}
      onSubmit={() => void save()}
    >
      <div
        className="hg-row"
        role="group"
        aria-label={copy.adjustReasonLabel}
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        {REASONS.map((r) => (
          <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
            {copy.adjustReasons[r]}
          </Chip>
        ))}
      </div>
      {reason === 'custom' && (
        <ShortText
          label={copy.adjustReasons.custom}
          value={text}
          onChange={setText}
          max={40}
          placeholder={copy.adjustCustomPlaceholder}
        />
      )}
      {together && <Checkbox label={copy.adjustHide} checked={hide} onChange={setHide} />}
    </QuestionLayout>
  );
}
