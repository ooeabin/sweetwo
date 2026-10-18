import { changeWeddingBudget, insertWeddingItem, updateWeddingItem } from '@sweetwo/api';
import { WEDDING_ITEMS, type WeddingPayer } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useWedding, weddingItemPath, weddingPath } from '../wedding/data';

type Step = 'a' | 'b' | 'c' | 'd';
type Who = 'us' | 'me' | 'partner' | 'family';
const CUSTOM = 'custom';

// G-07a~d 결혼 비용 항목 추가·수정(22 화면별 정의): a 어떤 항목(숨긴 기본 항목 / 직접 입력) → b 예산 → c 계약금·잔금 날짜(아직이에요 / 정해졌어요)
// → d 누가 내나요(우리 결혼 준비 통장 / 나 / 배우자 / 양가 지원, 계획으로만 씀). 새 항목은 바로 저장.
// 고칠 때 예산이 바뀌면 change_wedding_budget(연결된 부부는 제안, 예식 30일 안이면 바로). 결제일 → 챙길 날 자동 등록은 다음 단계.
export function G07aWeddingItem() {
  const { id = 'new', step = 'a' } = useParams();
  const nav = useNavigate();
  const w = useWedding();
  const cur = id === 'new' ? null : w.items.find((i) => i.id === id);
  const [key, setKey] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null | undefined>(undefined);
  const [dates, setDates] = useState<'later' | 'set' | null>(null);
  const [dep, setDep] = useState<number | null | undefined>(undefined);
  const [depOn, setDepOn] = useState<string | undefined>(undefined);
  const [bal, setBal] = useState<number | null | undefined>(undefined);
  const [balOn, setBalOn] = useState<string | undefined>(undefined);
  const [who, setWho] = useState<Who | null>(null);
  const [saving, setSaving] = useState(false);
  if (w.loading || !w.d.space || !w.d.me) return null;
  if (id !== 'new' && !cur) return <Navigate to={weddingPath} replace />;
  const side = w.d.me.side;
  const go = (s: Step) => nav(weddingItemPath(id, s));
  const k = key ?? cur?.key ?? null;
  const nm = name ?? cur?.name ?? '';
  const b = budget === undefined ? (cur?.budget ?? null) : budget;
  const hasDates = dates ?? (cur && (cur.deposit_on || cur.balance_on) ? 'set' : null);
  const d1 = dep === undefined ? (cur?.deposit_amount ?? null) : dep;
  const d1On = depOn ?? cur?.deposit_on ?? '';
  const b1 = bal === undefined ? (cur?.balance_amount ?? null) : bal;
  const b1On = balOn ?? cur?.balance_on ?? '';
  const whoOf = (p: WeddingPayer): Who =>
    p === 'us' || p === 'family' ? p : p === side ? 'me' : 'partner';
  const payerOf = (x: Who): WeddingPayer =>
    x === 'us' || x === 'family'
      ? x
      : x === 'me'
        ? side === 'bride'
          ? 'bride'
          : 'groom'
        : side === 'bride'
          ? 'groom'
          : 'bride';

  const save = async (x: Who) => {
    if (saving || k === null || b === null || !w.d.space) return;
    setSaving(true);
    const fields = {
      name: k === CUSTOM ? nm.trim() : (WEDDING_ITEMS.find((i) => i.key === k)?.name ?? nm),
      deposit_amount: hasDates === 'set' ? d1 : null,
      deposit_on: hasDates === 'set' && d1On ? d1On : null,
      balance_amount: hasDates === 'set' ? b1 : null,
      balance_on: hasDates === 'set' && b1On ? b1On : null,
      payer: payerOf(x),
    };
    try {
      if (!cur) {
        await insertWeddingItem({
          space_id: w.d.space.id,
          key: k,
          budget: b,
          sort: w.items.length,
          ...fields,
        });
        toast(copy.itemSaved);
      } else {
        await updateWeddingItem(cur.id, fields);
        if (b !== cur.budget) {
          const r = await changeWeddingBudget(cur.id, b, w.applyOn);
          toast(r === 'proposed' ? copy.proposed(w.d.couple?.partnerName ?? '') : copy.applied);
        } else toast(copy.itemSaved);
      }
      await w.refresh();
      nav(weddingPath, { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'b')
    return (
      <QuestionLayout
        title={copy.itemBudget}
        onBack={() => go('a')}
        primary={{ label: copy.next, disabled: b === null }}
        onSubmit={() => b !== null && go('c')}
      >
        <AmountInput label={copy.itemBudget} value={b} onChange={setBudget} />
      </QuestionLayout>
    );

  if (step === 'c')
    return (
      <QuestionLayout
        title={copy.itemDates}
        onBack={() => go('b')}
        primary={{ label: copy.next, disabled: hasDates === null }}
        onSubmit={() => hasDates !== null && go('d')}
        later={{
          label: copy.itemDatesOptions.later,
          onClick: () => {
            setDates('later');
            go('d');
          },
        }}
      >
        <ChoiceCards<'later' | 'set'>
          label={copy.itemDates}
          value={hasDates}
          onChange={setDates}
          autoAdvance={false}
          options={(['later', 'set'] as const).map((v) => ({
            value: v,
            label: copy.itemDatesOptions[v],
          }))}
        />
        {hasDates === 'set' && (
          <div className="hg-stack">
            <AmountInput label={copy.depositAmount} value={d1} onChange={setDep} />
            <label className="hg-field">
              <span className="hg-field__label">{copy.depositOn}</span>
              <input
                className="hg-input"
                type="date"
                value={d1On}
                onChange={(e) => setDepOn(e.target.value)}
              />
            </label>
            <AmountInput label={copy.balanceAmount} value={b1} onChange={setBal} />
            <label className="hg-field">
              <span className="hg-field__label">{copy.balanceOn}</span>
              <input
                className="hg-input"
                type="date"
                value={b1On}
                onChange={(e) => setBalOn(e.target.value)}
              />
            </label>
          </div>
        )}
      </QuestionLayout>
    );

  if (step === 'd') {
    const opts: Who[] = w.d.couple?.joined
      ? ['us', 'me', 'partner', 'family']
      : ['us', 'me', 'family'];
    return (
      <QuestionLayout title={copy.itemPayer} onBack={() => go('c')}>
        <ChoiceCards<Who>
          label={copy.itemPayer}
          value={who ?? (cur ? whoOf(cur.payer) : null)}
          onChange={setWho}
          onPick={(x) => void save(x)}
          options={opts.map((x) => ({
            value: x,
            label:
              x === 'me'
                ? (w.d.couple?.myName ?? '')
                : x === 'partner'
                  ? (w.d.couple?.partnerName ?? '')
                  : copy.payerOptions[x],
          }))}
        />
      </QuestionLayout>
    );
  }

  // a: 어떤 항목. 이미 있는 기본 항목은 빼고(고칠 때는 그 항목 포함)
  const used = new Set(w.items.filter((i) => i.id !== cur?.id).map((i) => i.key));
  const kinds = WEDDING_ITEMS.filter((i) => !used.has(i.key));
  const ready = k !== null && (k !== CUSTOM || nm.trim().length > 0);
  return (
    <QuestionLayout
      title={copy.itemKind}
      onBack={() => nav(weddingPath)}
      primary={{ label: copy.next, disabled: !ready }}
      onSubmit={() => ready && go('b')}
      later={
        cur
          ? {
              label: copy.removeItem,
              onClick: () =>
                void updateWeddingItem(cur.id, { deleted_at: new Date().toISOString() })
                  .then(w.refresh)
                  .then(() => nav(weddingPath, { replace: true }))
                  .catch(() => toast(copy.loadFailed)),
            }
          : undefined
      }
    >
      <ChoiceCards<string>
        label={copy.itemKind}
        value={k}
        onChange={setKey}
        autoAdvance={false}
        options={[
          ...kinds.map((i) => ({ value: i.key, label: i.name })),
          { value: CUSTOM, label: copy.itemCustom },
        ]}
      />
      {k === CUSTOM && (
        <label className="hg-field">
          <span className="hg-field__label">{copy.itemName}</span>
          <input
            className="hg-input"
            value={nm}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
    </QuestionLayout>
  );
}
