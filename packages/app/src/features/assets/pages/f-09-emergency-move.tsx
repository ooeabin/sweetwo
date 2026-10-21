import { moveEmergency, qk, undoEmergencyMove, type EmergencyReason } from '@sweetwo/api';
import { quickChips, readWon } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useDiagnosis } from '../diagnosis';

const REASONS: EmergencyReason[] = ['hospital', 'repair', 'family_event', 'living_short', 'etc'];

// F-09 비상금 넣기·꺼내기(23 F-09). 금액(Q3) → 꺼내기면 사유(Q1, 건너뛰기 가능) → 바로 반영 + 토스트 ‘되돌리기’.
// 꺼내기는 지금 잔액까지만. 제안이 아니라 바로 반영(배우자에게는 활동으로 보임).
export function F09EmergencyMove() {
  const { kind: k = 'in' } = useParams();
  const kind: 'in' | 'out' = k === 'out' ? 'out' : 'in';
  const nav = useNavigate();
  const qc = useQueryClient();
  const diag = useDiagnosis();
  const [amount, setAmount] = useState<number | null>(null);
  const [step, setStep] = useState<'amount' | 'why'>('amount');
  const [saving, setSaving] = useState(false);
  if (!diag.result) return null;
  const balance = diag.result.emergency.balance;
  const over = kind === 'out' && amount !== null && amount > balance;
  const back = () => nav(-1);

  const save = async (reason: EmergencyReason | null) => {
    if (!amount || saving) return;
    setSaving(true);
    try {
      const id = await moveEmergency(kind, amount, reason);
      await qc.invalidateQueries({ queryKey: qk.emergencyMoves });
      await qc.invalidateQueries({ queryKey: ['asset'] });
      toast(copy.emergencyMoved(kind, readWon(amount)), {
        label: copy.undo,
        onClick: () =>
          void undoEmergencyMove(id).then(() =>
            qc.invalidateQueries({ queryKey: qk.emergencyMoves }),
          ),
      });
      back();
    } catch {
      setSaving(false);
      toast(copy.loadFailed);
    }
  };

  if (step === 'why')
    return (
      <QuestionLayout
        title={copy.emergencyWhy}
        onBack={() => setStep('amount')}
        later={{ label: copy.emergencySkipWhy, onClick: () => void save(null) }}
      >
        <ChoiceCards<EmergencyReason>
          label={copy.emergencyWhy}
          options={REASONS.map((r) => ({ value: r, label: copy.emergencyReasons[r] }))}
          value={null}
          onChange={() => undefined}
          onPick={(r) => void save(r)}
          autoAdvance
          autoFocus
          shortcuts
        />
      </QuestionLayout>
    );

  const title = kind === 'in' ? copy.emergencyInQ : copy.emergencyOutQ;
  return (
    <QuestionLayout
      title={title}
      help={kind === 'out' ? copy.emergencyOver(readWon(balance)) : undefined}
      onBack={back}
      primary={{
        label: kind === 'in' ? copy.emergencyInBtn : copy.next,
        disabled: !amount || over,
        loading: saving,
      }}
      onSubmit={() => (kind === 'out' ? setStep('why') : void save(null))}
    >
      <AmountInput label={title} value={amount} onChange={setAmount} quick={quickChips.small} />
    </QuestionLayout>
  );
}
