import { adjustSaving, SavingAdjustBlocked, undoSavingAdjust } from '@sweetwo/api';
import { amountBand } from '@sweetwo/core';
import {
  Checkbox,
  Chip,
  FormAmount,
  FormScreen,
  FormSection,
  QuestionSkeleton,
  SegChoice,
  ShortText,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { savingPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { refreshSaving } from '../together';

type Sign = 'add' | 'sub';
type Reason = 'used' | 'interest' | 'fix' | 'custom';
const REASONS: Reason[] = ['used', 'interest', 'fix', 'custom'];

/**
 * W-10b 모은 금액 바로잡기(20 v2.2, ADR 0009 결정 4, G11): 더할게요/뺄게요 → 금액 → 사유 칩(나만 봄) + (같이 모으는 저금이면)
 * ‘주간 요약에 넣지 않기’ → adjust_saving + Toast ‘되돌리기’(undo_saving_adjust). 상대에게는 서버가 사람·금액·사유 없는 한 줄.
 * 2026-11-24 한 화면 입력(FormScreen): 부호 + 금액 + 사유를 한 화면 세 섹션으로(예전 주소 `/adjust/:step`은 같은 화면)
 */
export function W10bAdjust() {
  const { id = '' } = useParams();
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
  const back = () => (window.history.length > 1 ? nav(-1) : nav(savingPaths.item(id)));
  if (!d.ready && d.failed)
    return <SavingQuestionError onBack={() => nav(savingPaths.item(id))} onRetry={d.retry} />;
  if (!d.ready) return <QuestionSkeleton title={copy.adjustQ} />;
  const i = d.byId(id);
  if (!i || !i.canEdit) return <Navigate to={savingPaths.item(id)} replace />;
  // 같이 모으는 저금(공동, 합쳐서, 묶음): 상대에게 한 줄이 가므로 ‘주간 요약에 넣지 않기’를 보임(20 W-10b 3)
  const together = i.owner === 'ours' || d.joint || !!i.goal.bundle_id;

  const over = sign === 'sub' && amount !== null && amount > i.saved;
  const delta = sign === 'sub' ? -(amount ?? 0) : (amount ?? 0);
  const save = async () => {
    if (busy || !reason || !sign || !amount) return;
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
  const ready =
    !!sign && !!amount && !over && !!reason && (reason !== 'custom' || !!text.trim());
  return (
    <FormScreen
      title={copy.adjustQ}
      onBack={back}
      primary={{ label: copy.adjustSave, disabled: !ready, loading: busy }}
      onSubmit={() => void save()}
    >
      <FormSection title={copy.adjustSignQ}>
        <SegChoice<Sign>
          label={copy.adjustSignQ}
          value={sign}
          onChange={setSign}
          items={[
            { value: 'add', label: copy.adjustAdd },
            { value: 'sub', label: copy.adjustSub },
          ]}
        />
      </FormSection>
      <FormSection
        title={copy.adjustAmountQ(sign ?? 'add')}
        aside={copy.adjustNow(money(i.saved, masked))}
      >
        <FormAmount
          label={copy.adjustAmountQ(sign ?? 'add')}
          sheetTitle={copy.adjustAmountQ(sign ?? 'add')}
          value={amount}
          onChange={setAmount}
          allowZero={false}
          monthly={false}
          invalid={over}
          below={
            over ? (
              <p className="hg-help is-error" role="alert">
                {copy.adjustOver}
              </p>
            ) : undefined
          }
        />
      </FormSection>
      <FormSection title={copy.adjustReasonQ} aside={copy.adjustReasonHelp}>
        <div className="hg-form__chips" role="group" aria-label={copy.adjustReasonLabel}>
          {REASONS.map((r) => (
            <Chip key={r} small selected={reason === r} onClick={() => setReason(r)}>
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
            autoFocus={false}
          />
        )}
        {together && <Checkbox label={copy.adjustHide} checked={hide} onChange={setHide} />}
      </FormSection>
    </FormScreen>
  );
}
