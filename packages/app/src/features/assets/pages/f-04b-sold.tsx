import { sellAsset } from '@sweetwo/api';
import { hasPrincipal } from '@sweetwo/core';
import { AmountInput, Button, ChoiceCards, QuestionLayout, Toggle } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { canEdit, useAssetsData, useRefreshAssets } from '../data';

// F-04b~d 팔았어요(23): 투자·부동산만.
// b “받은 금액은 얼마예요?”(Q3, 통장에 실제 들어온 금액) + ‘일부만 팔았어요’ → “남은 평가금액은요?”
// c 받은 통장(내 통장·공동 통장, Q1, 고르면 바로 저장) → d 결과 “입출금 통장 +1,130만 원” / “실현 손익 +150만 원”(원금 없으면 없음)
// ‘확인’ → F-02. 다 팔면 ‘매도 완료’로 보관(목록에서 빠짐, 과거 순자산 기록 유지). 저장 즉시 반영 + 상대 알림(서버)
export function F04bSold() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [step, setStep] = useState<'amount' | 'to' | 'done'>('amount');
  const [received, setReceived] = useState<number | null>(null);
  const [part, setPart] = useState(false);
  const [remain, setRemain] = useState<number | null>(null);
  const [result, setResult] = useState<{ to: string; gain: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading) return null;
  const a = d.items.find((x) => x.id === id);
  if (!a || !canEdit(a, d.me?.id) || a.side !== 'asset' || !hasPrincipal(a.grp))
    return <Navigate to="/assets" replace />;
  const back = () => nav(`/assets/${a.id}`);

  if (step === 'done' && result && received !== null) {
    const to = d.items.find((x) => x.id === result.to);
    return (
      <QuestionLayout
        title={copy.soldDone}
        primary={{ label: copy.ok }}
        onSubmit={() => nav(`/assets/items?side=asset`, { replace: true })}
      >
        <section className="hg-card hg-stack">
          <b>{copy.soldTo(to?.name ?? '', m(received))}</b>
          {result.gain !== null && (
            <span className="hg-card__meta">
              {copy.soldGain(`${result.gain >= 0 ? '+' : '−'}${m(Math.abs(result.gain))}`)}
            </span>
          )}
        </section>
      </QuestionLayout>
    );
  }

  if (step === 'to') {
    const targets = d.items.filter(
      (x) =>
        x.id !== a.id &&
        x.side === 'asset' &&
        (x.grp === 'cash' || x.grp === 'deposit') &&
        canEdit(x, d.me?.id),
    );
    const save = async (to: string) => {
      if (busy || received === null) return;
      setBusy(true);
      try {
        const gain = await sellAsset(a.id, { received, to, remain: part ? remain : null });
        await refresh();
        setResult({ to, gain });
        setStep('done');
      } catch {
        toast(copy.loadFailed);
      } finally {
        setBusy(false);
      }
    };
    return (
      <QuestionLayout title={copy.soldTo_q} onBack={() => setStep('amount')}>
        {targets.length ? (
          <ChoiceCards<string>
            label={copy.soldTo_q}
            value={null}
            onChange={() => undefined}
            onPick={(to) => void save(to)}
            options={targets.map((x) => ({
              value: x.id,
              label: x.name,
              sub: `${m(x.amount)} → ${m(x.amount + (received ?? 0))}`,
            }))}
          />
        ) : (
          <p className="hg-help">{copy.maturedNoAccount}</p>
        )}
      </QuestionLayout>
    );
  }

  const ok = received !== null && received > 0 && (!part || remain !== null);
  return (
    <QuestionLayout
      title={copy.soldAmount}
      onBack={back}
      primary={{ label: copy.next, disabled: !ok }}
      onSubmit={() => ok && setStep('to')}
    >
      <AmountInput label={copy.soldAmount} value={received} onChange={setReceived} />
      <Toggle label={copy.soldPart} checked={part} onChange={setPart} />
      {part && (
        <AmountInput label={copy.soldRemain} value={remain} onChange={setRemain} allowZero />
      )}
      <Button variant="ghost" onClick={back}>
        {copy.cancel}
      </Button>
    </QuestionLayout>
  );
}
