import { AssetForbiddenError, sellAsset } from '@sweetwo/api';
import { hasPrincipal } from '@sweetwo/core';
import {
  Chip,
  DoneMark,
  FormAmount,
  FormHero,
  FormScreen,
  FormSection,
  QuestionLayout,
  QuestionSkeleton,
  SegChoice,
} from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { canEdit, useAssetsData, useRefreshAssets } from '../data';
import { soldFormReady, soldHero } from '../form-logic';

// F-04b~d 팔았어요(23, 2026-11-24 한 화면 입력 FormScreen): 투자·부동산만.
// 입력(F-04b·c)은 한 화면: 맨 위 요약 문장(“미국 ETF를 팔고 / 840만 원 받았어요”) + “얼마나 팔았어요?”(전부 / 일부, 일부면 남은 평가금액 섹션)
//   + “받은 금액”(보조 “지금 금액 n원”) + “어느 통장에 들어왔어요?”(통장 칩 + ‘입력하지 않을게요’, 고르면 “{통장} n원 > m원” 한 줄) + 아래 “입력하기”.
// 결과(F-04d)는 예전 그대로 “입출금 통장 +1,130만 원” / “판 수익 +150만 원”(원금 없으면 없음) + ‘목록으로 가기’ → F-02.
// 다 팔면 ‘매도 완료’로 보관(목록에서 빠짐, 과거 순자산 기록 유지). 저장 즉시 반영 + 상대 알림(서버). ‘입력하지 않을게요’는 통장을 건드리지 않고 판 것만 기록(sell_asset p_to null)
export function F04bSold() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [received, setReceived] = useState<number | null>(null);
  const [part, setPart] = useState(false);
  const [remain, setRemain] = useState<number | null>(null);
  // 받은 통장: 통장 id, ‘none’ = 입력하지 않을게요, null = 아직(첫 통장이 미리 골라져 있음)
  const [toSel, setToSel] = useState<string | null>(null);
  const [result, setResult] = useState<{ to: string | null; gain: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading) return <QuestionSkeleton />;

  // 결과(F-04d)는 확인 전에 그림: 전부 팔면 항목이 ‘매도 완료’로 목록에서 빠져 아래 확인에 걸리기 때문(2026-11-12 S8-01)
  if (result && received !== null) {
    const to = result.to ? d.items.find((x) => x.id === result.to) : undefined;
    return (
      <QuestionLayout
        // 2026-11-03 끝난 걸 알 수 있게 완료 표시(O-60과 같음) + ‘목록으로 가기’
        hero={<DoneMark art="done-sold" />}
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

  const a = d.items.find((x) => x.id === id);
  // 전·월세 보증금은 팔기 흐름이 없음(F-04 8번, 서버 sell_asset도 거절, 2026-11-12 S8-15)
  if (
    !a ||
    !canEdit(a, d.me?.id) ||
    a.side !== 'asset' ||
    !hasPrincipal(a.grp) ||
    a.kind === 'deposit_money'
  )
    return <Navigate to="/assets" replace />;
  const back = () => nav(`/assets/${a.id}`);
  const targets = d.items.filter(
    (x) =>
      x.id !== a.id &&
      x.side === 'asset' &&
      (x.grp === 'cash' || x.grp === 'deposit') &&
      canEdit(x, d.me?.id),
  );
  const sel = toSel ?? targets[0]?.id ?? 'none';
  const target = targets.find((x) => x.id === sel);
  const ready = soldFormReady({ received, part, remain });

  const save = async () => {
    if (busy || !ready || received === null) return;
    setBusy(true);
    try {
      const to = sel === 'none' ? null : sel;
      const gain = await sellAsset(a.id, { received, to, remain: part ? remain : null });
      // 결과 먼저, 그다음 새로 읽기(다 팔면 항목이 목록에서 빠짐, 2026-11-12 S8-01)
      setResult({ to, gain });
      await refresh();
    } catch (e) {
      // 13 공통 상태 10번·8번(2026-11-12 S8-16)
      toast(
        e instanceof AssetForbiddenError
          ? copy.readOnly(d.couple?.partnerName ?? '')
          : copy.saveFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={copy.sold}
      onBack={back}
      hero={
        <FormHero
          lines={soldHero({
            name: a.name,
            received,
            money: m,
            ask: copy.soldHeroAsk,
            verb: copy.soldHeroVerb,
            sellTail: copy.soldHeroTail,
          })}
        />
      }
      primary={{ label: copy.soldDo, disabled: !ready, loading: busy }}
      onSubmit={() => void save()}
    >
      <FormSection title={copy.soldHowQ}>
        <SegChoice<'all' | 'part'>
          label={copy.soldHowQ}
          items={[
            { value: 'all', label: copy.soldAllShort },
            { value: 'part', label: copy.soldPartShort },
          ]}
          value={part ? 'part' : 'all'}
          onChange={(v) => setPart(v === 'part')}
        />
      </FormSection>
      <FormSection title={copy.soldReceivedQ} aside={copy.soldNow(m(a.amount))}>
        <FormAmount
          label={copy.soldReceivedQ}
          sheetTitle={copy.soldAmount}
          closeLabel={copy.close}
          confirmLabel={copy.ok}
          value={received}
          onChange={setReceived}
          allowZero={false}
          monthly={false}
        />
      </FormSection>
      {part && (
        <FormSection title={copy.soldRemainQ}>
          <FormAmount
            label={copy.soldRemainQ}
            sheetTitle={copy.soldRemain}
            closeLabel={copy.close}
            confirmLabel={copy.ok}
            value={remain}
            onChange={setRemain}
            monthly={false}
          />
        </FormSection>
      )}
      <FormSection title={copy.soldToQ}>
        <div className="hg-form__chips" role="group" aria-label={copy.soldToQ}>
          {targets.map((x) => (
            <Chip key={x.id} small selected={sel === x.id} onClick={() => setToSel(x.id)}>
              {x.name}
            </Chip>
          ))}
          <Chip small selected={sel === 'none'} onClick={() => setToSel('none')}>
            {copy.soldNoTo}
          </Chip>
        </div>
        {target && (
          <p className="hg-form__hint">
            {copy.soldToLine(target.name, m(target.amount), m(target.amount + (received ?? 0)))}
          </p>
        )}
      </FormSection>
    </FormScreen>
  );
}
