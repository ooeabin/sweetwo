import { sellAsset } from '@sweetwo/api';
import { hasPrincipal } from '@sweetwo/core';
import { AmountInput, ChoiceCards, DoneMark, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { canEdit, useAssetsData, useRefreshAssets } from '../data';

// F-04b~d 팔았어요(23): 투자·부동산만.
// b 먼저 “얼마나 팔았어요?”(전부 / 일부만, 2026-11-03) → “받은 금액은 얼마예요?”(Q3, 통장에 실제 들어온 금액)
//   → 일부만이면 “남은 평가금액은 얼마예요?”. 화면마다 금액 칸과 키패드 하나
// c 받은 통장(내 통장·공동 통장, Q1, 고르면 바로 저장) → d 결과 “입출금 통장 +1,130만 원” / “실현 손익 +150만 원”(원금 없으면 없음)
// ‘확인’ → F-02. 다 팔면 ‘매도 완료’로 보관(목록에서 빠짐, 과거 순자산 기록 유지). 저장 즉시 반영 + 상대 알림(서버)
export function F04bSold() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [step, setStep] = useState<'how' | 'amount' | 'remain' | 'to' | 'done'>('how');
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
        // 2026-11-03 끝난 걸 알 수 있게 완료 표시(O-60과 같음) + ‘목록으로 가기’
        hero={<DoneMark />}
        center
        title={copy.soldDone}
        primary={{ label: copy.toList }}
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

  // 2026-11-04 진행 막대(F-04a 만기 정리와 같음): 얼마나 → 받은 금액 → (남은 평가금액) → 받은 통장
  const order = part ? ['how', 'amount', 'remain', 'to'] : ['how', 'amount', 'to'];
  const now = Math.max(order.indexOf(step), 0);
  const progress = { total: order.length, now, fill: 50 };

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
      <QuestionLayout
        steps={progress}
        title={copy.soldTo_q}
        onBack={() => setStep(part ? 'remain' : 'amount')}
      >
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

  if (step === 'how') {
    return (
      <QuestionLayout steps={progress} title={copy.soldHow} onBack={back}>
        <ChoiceCards<'all' | 'part'>
          label={copy.soldHow}
          value={null}
          onChange={() => undefined}
          go
          onPick={(v) => {
            setPart(v === 'part');
            setStep('amount');
          }}
          options={[
            { value: 'all', label: copy.soldAll },
            { value: 'part', label: copy.soldPart, sub: copy.soldPartSub },
          ]}
        />
      </QuestionLayout>
    );
  }

  if (step === 'remain') {
    const done = remain !== null;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.soldRemain}
        onBack={() => setStep('amount')}
        primary={{ label: copy.next, disabled: !done }}
        onSubmit={() => done && setStep('to')}
      >
        <AmountInput label={copy.soldRemain} value={remain} onChange={setRemain} allowZero />
      </QuestionLayout>
    );
  }

  const ok = received !== null && received > 0;
  return (
    <QuestionLayout
      steps={progress}
      title={copy.soldAmount}
      onBack={() => setStep('how')}
      primary={{ label: copy.next, disabled: !ok }}
      onSubmit={() => ok && setStep(part ? 'remain' : 'to')}
    >
      <AmountInput label={copy.soldAmount} value={received} onChange={setReceived} />
    </QuestionLayout>
  );
}
