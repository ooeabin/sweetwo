import {
  ensureMonthClose,
  fetchCurrentPlan,
  fetchMonthClose,
  fetchSpace,
  fetchSpendCategories,
  insertSpendCategories,
  qk,
  saveMonthSpend,
} from '@sweetwo/api';
import { defaultSpendCategories, todayKst } from '@sweetwo/core';
import { QuestionLayout, ShortText, SpendItems, type FixedItem } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';

// W-04j 지출 입력, 이번 달 ‘지출 적기’로 앞당겨 연 모습(docs/spec/21-month-close.md W-04j).
// 고정 확인 + 변동 항목별 합계(칸을 벗어날 때 이번 플랜의 월말 정리 초안에 자동 저장) + 합계.
// 소득 확인, ‘이번 달만 고치기’, 큰 지출(BigExpense)은 월말 정리 단계에서.
export function W04jSpendEntry() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = todayKst();
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const plan = useQuery({
    queryKey: qk.currentPlan(today),
    queryFn: () => fetchCurrentPlan(today),
  });
  const cats = useQuery({ queryKey: qk.spendCategories, queryFn: fetchSpendCategories });
  const planId = plan.data?.id;
  const close = useQuery({
    queryKey: qk.monthClose(planId ?? ''),
    queryFn: () => fetchMonthClose(planId ?? ''),
    enabled: !!planId,
  });
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  // 처음 열면 기본 항목(09 6-3)을 넣는다
  const seeded = useRef(false);
  useEffect(() => {
    if (!cats.data || seeded.current || cats.data.length) return;
    seeded.current = true;
    void insertSpendCategories(
      defaultSpendCategories.map((c, i) => ({ default_key: c.key, name: c.name, sort: i })),
    )
      .then(() => qc.invalidateQueries({ queryKey: qk.spendCategories }))
      .catch(() => toast(copy.saveFailed));
  }, [cats.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    void qc.invalidateQueries({ queryKey: qk.monthClose(planId ?? '') });
    nav('/');
  };

  if (space.isLoading || plan.isLoading || cats.isLoading || close.isLoading) return null;
  const sp = space.data;
  const saved = Object.fromEntries(
    (close.data?.spends ?? []).map((x) => [x.category_id, x.amount]),
  );
  const value = (id: string) => (id in amounts ? (amounts[id] ?? null) : (saved[id] ?? null));

  const fixed: FixedItem[] = [
    { id: 'fixed', name: copy.fixedShared, group: copy.fixedGroup, amount: sp?.fixed_total ?? 0 },
    ...((sp?.loan_repayment ?? 0) > 0
      ? [{ id: 'loan', name: copy.loan, group: copy.fixedGroup, amount: sp?.loan_repayment ?? 0 }]
      : []),
  ];
  const variable = (cats.data ?? [])
    .filter((c) => c.enabled)
    .map((c) => ({ id: c.id, name: c.name, amount: value(c.id) }));

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
    if (!name || (cats.data ?? []).some((c) => c.name === name)) return;
    try {
      await insertSpendCategories([
        { default_key: null, name, sort: Math.max(0, ...(cats.data ?? []).map((c) => c.sort)) + 1 },
      ]);
      await qc.invalidateQueries({ queryKey: qk.spendCategories });
    } catch {
      toast(copy.saveFailed);
    }
  };

  return (
    <QuestionLayout
      title={copy.spendTitle}
      help={planId ? copy.spendHelp : copy.noPlan}
      onBack={back}
      primary={{ label: copy.done, disabled: !planId }}
      onSubmit={back}
    >
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
            e.preventDefault(); // 폼 ‘다 적었어요’ 대신 추가
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
    </QuestionLayout>
  );
}
