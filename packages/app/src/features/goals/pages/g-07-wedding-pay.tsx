import { changeWeddingBudget, recordWeddingPayment } from '@sweetwo/api';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useWedding, weddingPath } from '../wedding/data';

type From = keyof typeof copy.payFromOptions;
type Over = keyof typeof copy.payOverOptions;

// G-07 결제 기록(22 G-07 결제 기록): “예물 잔금, 실제로 얼마 냈어요?”(예산 채움) → “550만 원, 어디서 냈어요?”
// 결혼 준비 통장 → 결혼 비용 보유액에서만 뺌 / 각자 돈·양가 지원 → 기록만. 실제 > 예산이면 “예물이 예산보다 50만 원 넘었어요”
// + ‘다른 항목에서 줄이기’(고른 항목 예산 − 넘은 금액, 이 항목 + 넘은 금액) / ‘총예산 늘리기’(제안). 예산 바꾸기는 연결된 부부면 제안.
export function G07WeddingPay() {
  const { id = '', part: p = 'deposit' } = useParams();
  const part = p === 'balance' ? 'balance' : 'deposit';
  const nav = useNavigate();
  const w = useWedding();
  const { masked } = useMask();
  const [step, setStep] = useState<'amount' | 'from' | 'over' | 'cut'>('amount');
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [from, setFrom] = useState<From | null>(null);
  const [over, setOver] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [choice, setChoice] = useState<Over | null>(null);
  const [saving, setSaving] = useState(false);
  if (w.loading) return null;
  const it = w.items.find((i) => i.id === id);
  if (!it) return <Navigate to={weddingPath} replace />;
  const m = (v: number) => money(v, masked);
  const planned = (part === 'deposit' ? it.deposit_amount : it.balance_amount) ?? it.budget;
  const value = amount === undefined ? planned : amount;
  const partName = copy.weddingCols[part];
  const done = async (msg: string) => {
    await w.refresh();
    toast(msg);
    nav(weddingPath, { replace: true });
  };
  const proposedOr = (r: 'applied' | 'proposed') =>
    r === 'proposed' ? copy.proposed(w.d.couple?.partnerName ?? '') : copy.applied;

  const record = async (f: From) => {
    if (saving || value === null) return;
    setSaving(true);
    try {
      const o = await recordWeddingPayment(it.id, part, value, f);
      if (o > 0) {
        setOver(o);
        setStep('over');
        await w.refresh();
      } else await done(copy.payDone);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  const fix = async (x: Over, other?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      let r: 'applied' | 'proposed';
      if (x === 'raise') {
        r = await changeWeddingBudget(null, w.budget + over, w.applyOn);
      } else {
        const o = w.items.find((i) => i.id === other);
        if (!o) return;
        r = await changeWeddingBudget(o.id, Math.max(o.budget - over, 0), w.applyOn);
      }
      await changeWeddingBudget(it.id, it.budget + over, w.applyOn);
      await done(proposedOr(r));
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'cut') {
    const others = w.items.filter((i) => i.id !== it.id && i.budget > 0);
    return (
      <QuestionLayout title={copy.payCutWhich} onBack={() => setStep('over')}>
        <ChoiceCards<string>
          label={copy.payCutWhich}
          value={pick}
          onChange={setPick}
          onPick={(o) => void fix('cut', o)}
          options={others.map((i) => ({ value: i.id, label: i.name, sub: m(i.budget) }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'over') {
    const title = copy.payOver(it.name, m(over));
    return (
      <QuestionLayout title={title} onBack={() => nav(weddingPath)}>
        <ChoiceCards<Over>
          label={title}
          value={choice}
          onChange={setChoice}
          onPick={(x) => (x === 'cut' ? setStep('cut') : void fix('raise'))}
          options={(Object.keys(copy.payOverOptions) as Over[]).map((k) => ({
            value: k,
            label: copy.payOverOptions[k],
          }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'from') {
    const title = copy.payFrom(m(value ?? 0));
    return (
      <QuestionLayout title={title} onBack={() => setStep('amount')}>
        <ChoiceCards<From>
          label={title}
          value={from}
          onChange={setFrom}
          onPick={(f) => void record(f)}
          options={(Object.keys(copy.payFromOptions) as From[]).map((k) => ({
            value: k,
            label: copy.payFromOptions[k],
          }))}
        />
      </QuestionLayout>
    );
  }

  const title = copy.payAsk(it.name, partName);
  return (
    <QuestionLayout
      title={title}
      help={copy.payBudget(m(planned))}
      onBack={() => nav(weddingPath)}
      primary={{ label: copy.next, disabled: value === null }}
      onSubmit={() => value !== null && setStep('from')}
    >
      <AmountInput label={title} value={value} onChange={setAmount} allowZero />
    </QuestionLayout>
  );
}
