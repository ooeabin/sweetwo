import {
  ensureMonthClose,
  insertSpendCategories,
  saveBigExpenses,
  saveMonthSpend,
  updateMonthClose,
} from '@sweetwo/api';
import { defaultSpendCategories, readWon } from '@sweetwo/core';
import {
  AmountInput,
  BigExpense,
  Button,
  QuestionLayout,
  ShortText,
  SpendItems,
  type BigItem,
  type FixedItem,
} from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, closeProgress, useCloseData } from '../data';

// W-04j 지출 입력(docs/spec/21-month-close.md W-04j).
// early = 이번 달 ‘지출 적기’로 앞당겨 연 모습(고정 확인 + 변동 항목, 칸을 벗어날 때 초안에 자동 저장).
// close = 월말 정리 단계(위 + 소득 확인 + 큰 지출, ‘다음’에 모두 저장 → W-04k).
// ‘이번 달만 고치기’(고정지출 줄 고치기)는 항목별 고정지출 금액(O-37)을 받은 뒤에.
export function W04jSpendEntry({ mode = 'early' }: { mode?: 'early' | 'close' }) {
  const nav = useNavigate();
  const d = useCloseData(mode === 'close');
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [income, setIncome] = useState<number | null | undefined>(undefined);
  const [editIncome, setEditIncome] = useState(false);
  const [bigs, setBigs] = useState<BigItem[] | undefined>(undefined);
  const [bigNone, setBigNone] = useState<boolean | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // 처음 열면 기본 항목(09 6-3)을 넣는다
  const seeded = useRef(false);
  useEffect(() => {
    if (d.loading || seeded.current || d.cats.length) return;
    seeded.current = true;
    void insertSpendCategories(
      defaultSpendCategories.map((c, i) => ({ default_key: c.key, name: c.name, sort: i })),
    )
      .then(d.refreshCats)
      .catch(() => toast(copy.saveFailed));
  }, [d.loading, d.cats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading) return null;
  const sp = d.space;
  const planId = d.planId;
  const saved = Object.fromEntries((d.close?.spends ?? []).map((x) => [x.category_id, x.amount]));
  const value = (id: string) => (id in amounts ? (amounts[id] ?? null) : (saved[id] ?? null));

  const fixed: FixedItem[] = [
    { id: 'fixed', name: copy.fixedShared, group: copy.fixedGroup, amount: sp?.fixed_total ?? 0 },
    ...((sp?.loan_repayment ?? 0) > 0
      ? [{ id: 'loan', name: copy.loan, group: copy.fixedGroup, amount: sp?.loan_repayment ?? 0 }]
      : []),
  ];
  const variable = d.cats
    .filter((c) => c.enabled)
    .map((c) => ({ id: c.id, name: c.name, amount: value(c.id) }));

  // 큰 지출: 저장된 줄을 처음 값으로
  const curBigs: BigItem[] =
    bigs ??
    (d.close?.bigs ?? []).map((b) => ({ key: b.kind, name: b.name, amount: b.amount, how: b.how }));
  const curNone = bigNone ?? d.close?.big_none ?? false;
  const curIncome = income === undefined ? (d.close?.income ?? d.incomeDefault) : income;

  const commit = async (id: string) => {
    if (!planId || !(id in amounts)) return;
    try {
      const closeId = await ensureMonthClose(planId);
      await saveMonthSpend(closeId, id, amounts[id] ?? 0);
    } catch {
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void commit(id) });
    }
  };

  const addItem = async () => {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (!name || d.cats.some((c) => c.name === name)) return;
    try {
      await insertSpendCategories([
        { default_key: null, name, sort: Math.max(0, ...d.cats.map((c) => c.sort)) + 1 },
      ]);
      await d.refreshCats();
    } catch {
      toast(copy.saveFailed);
    }
  };

  const leave = async () => {
    await d.refreshClose();
    nav('/');
  };

  /** 월말 정리 ‘다음’: 소득, 큰 지출, 아직 안 저장한 칸을 모두 저장 */
  const next = async () => {
    if (!planId || saving) return;
    setSaving(true);
    try {
      const closeId = await ensureMonthClose(planId);
      for (const id of Object.keys(amounts)) await saveMonthSpend(closeId, id, amounts[id] ?? 0);
      await updateMonthClose(closeId, { income: curIncome ?? 0, big_none: curNone });
      const kept = curBigs.filter((b) => (b.amount ?? 0) > 0);
      const removed = (d.close?.bigs ?? [])
        .map((b) => b.kind)
        .filter((k) => !kept.some((b) => b.key === k));
      await saveBigExpenses(
        closeId,
        kept.map((b) => ({ kind: b.key, name: b.name, amount: b.amount ?? 0, how: b.how })),
        removed,
      );
      await d.refreshClose();
      setSaving(false);
      nav(closePath('w-04k'));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void next() });
    }
  };

  const close = mode === 'close';
  return (
    <QuestionLayout
      steps={close ? closeProgress('w-04j', d.adjust) : undefined}
      title={copy.spendTitle}
      help={planId ? copy.spendHelp : copy.noPlan}
      onBack={close ? () => nav(closePath('w-04a')) : () => void leave()}
      primary={{
        label: close ? copy.next : copy.done,
        disabled: !planId || (close && curIncome === null),
        loading: saving,
      }}
      onSubmit={close ? () => void next() : () => void leave()}
    >
      {close && (
        <section className="hg-card hg-stack" aria-label={copy.incomeTitle}>
          <div className="hg-card__top">
            <span className="hg-card__label">{copy.incomeTitle}</span>
            {!editIncome && (
              <Button variant="secondary" size="sm" onClick={() => setEditIncome(true)}>
                {copy.edit}
              </Button>
            )}
          </div>
          {editIncome ? (
            <AmountInput
              label={copy.incomeLabel}
              value={curIncome}
              onChange={setIncome}
              allowZero
              embedded
            />
          ) : (
            <>
              <p className="hg-card__value">{readWon(curIncome ?? 0)}</p>
              <p className="hg-card__meta">{copy.incomeSub}</p>
            </>
          )}
        </section>
      )}
      {planId && (
        <SpendItems
          fixed={fixed}
          variable={variable}
          onChangeVariable={(id, a) => setAmounts((x) => ({ ...x, [id]: a }))}
          onCommitVariable={(id) => void commit(id)}
          onAddItem={() => setAdding(true)}
        />
      )}
      {adding && (
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault(); // 폼 제출 대신 추가
            void addItem();
          }}
        >
          <div style={{ flex: 1 }}>
            <ShortText label={copy.addItem} value={draft} onChange={setDraft} max={20} />
          </div>
          <button
            type="button"
            className="hg-btn hg-btn--secondary"
            disabled={!draft.trim()}
            onClick={() => void addItem()}
          >
            {copy.add}
          </button>
        </div>
      )}
      {close && planId && (
        <BigExpense
          // 연결된 매년 목표가 없으면 ‘모아 둔 돈에서 냈어요’ 숨김(goalName 없음)
          options={copy.bigOptions}
          items={curBigs}
          none={curNone}
          onToggle={(key) => {
            setBigNone(false);
            const has = curBigs.some((b) => b.key === key);
            const name = copy.bigOptions.find((o) => o.key === key)?.name ?? key;
            setBigs(
              has
                ? curBigs.filter((b) => b.key !== key)
                : [...curBigs, { key, name, amount: null, how: 'exception' }],
            );
          }}
          onNone={() => {
            setBigNone(!curNone);
            if (!curNone) setBigs([]);
          }}
          onChange={(key, patch) =>
            setBigs(curBigs.map((b) => (b.key === key ? { ...b, ...patch } : b)))
          }
        />
      )}
    </QuestionLayout>
  );
}
