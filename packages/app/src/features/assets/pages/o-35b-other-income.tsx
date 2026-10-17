import {
  completeTodoKind,
  fetchIncomeItems,
  keepIncomeKinds,
  qk,
  saveIncomeItem,
  type IncomeKind,
} from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import { AmountInput, Chip, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { INCOME_KINDS, useIncomeDraft } from '../week/income';
import { weekPath } from '../week/week';

const NONE = 'none';

// O-35b 다른 수입(Q2 → 항목별 Q3): 부업·N잡 / 월세·임대 수입 / 정부 지원금 / 없어요(단독). 항목마다 월 금액(변동은 적게 벌 때 기준).
// 넘길 때마다 저장, 합계는 서버가 월 수입에 더함 → 안 나눈 돈 다시 셈 → 할 일 ‘나머지 목표·상여금·다른 수입’ 끝
export function O35bOtherIncome() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const step = useParams().n;
  const d = useAssetsData();
  const items = useQuery({ queryKey: qk.incomeItems, queryFn: fetchIncomeItems });
  const draft = useIncomeDraft();
  const [picks, setPicks] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  if (items.isLoading || d.loading || !d.me) return null;
  const meId = d.me.id;
  const mine = (items.data ?? []).filter((r) => r.owner_user_id === meId);
  const close = { label: copy.weekClose, onClick: () => nav('/') };

  const finish = async () => {
    await recalcPendingShares();
    await completeTodoKind('rest', meId);
    await Promise.all(
      [qk.me, qk.partner, qk.incomeItems, qk.todos, qk.proposals].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
    toast(copy.weekRestDone);
    nav('/', { replace: true });
  };
  const run = async (f: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try {
      await f();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!step) {
    const cur = picks ?? (draft.picks.length ? draft.picks : mine.map((r) => r.kind));
    const none = cur.includes(NONE);
    const flip = (k: string) =>
      setPicks(
        k === NONE
          ? none
            ? []
            : [NONE]
          : cur.includes(k)
            ? cur.filter((x) => x !== k)
            : [...cur.filter((x) => x !== NONE), k],
      );
    const kinds = INCOME_KINDS.filter((k) => cur.includes(k));
    return (
      <QuestionLayout
        steps={{ total: 3 + kinds.length, now: 2 }}
        title={copy.weekIncome}
        onBack={() => nav(weekPath.bonus)}
        later={close}
        primary={{ label: copy.next, disabled: !cur.length, loading: saving }}
        onSubmit={() =>
          void run(async () => {
            await keepIncomeKinds(kinds);
            draft.setPicks(kinds);
            if (kinds.length) {
              for (const r of mine) draft.setAmount(r.kind, r.monthly_amount);
              nav(weekPath.incomeAmount(1));
            } else await finish();
          })
        }
      >
        <div
          role="group"
          aria-label={copy.weekIncome}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}
        >
          {[
            ...INCOME_KINDS.map((k) => ({ key: k as string, name: copy.weekIncomeKinds[k] })),
            { key: NONE, name: copy.weekNoLoan },
          ].map((q) => (
            <Chip
              key={q.key}
              selected={cur.includes(q.key)}
              onClick={() => flip(q.key)}
              style={{ justifyContent: 'center' }}
            >
              {q.name}
            </Chip>
          ))}
        </div>
      </QuestionLayout>
    );
  }

  const n = Number(step);
  const kind: IncomeKind | undefined = draft.picks[n - 1];
  if (!kind) return <Navigate to={weekPath.income} replace />;
  const name = copy.weekIncomeKinds[kind];
  const title = copy.weekIncomeAmount(name);
  const value = draft.amounts[kind] ?? null;
  return (
    <QuestionLayout
      steps={{ total: 3 + draft.picks.length, now: 2 + n }}
      title={title}
      help={kind === 'side_job' ? copy.weekIncomeLow : copy.weekCount(name, n, draft.picks.length)}
      onBack={() => nav(n > 1 ? weekPath.incomeAmount(n - 1) : weekPath.income)}
      later={close}
      primary={{ label: copy.next, disabled: value === null, loading: saving }}
      onSubmit={() =>
        value !== null &&
        void run(async () => {
          await saveIncomeItem(kind, value);
          if (n < draft.picks.length) nav(weekPath.incomeAmount(n + 1));
          else await finish();
        })
      }
    >
      <AmountInput
        key={kind}
        label={title}
        value={value}
        onChange={(v) => draft.setAmount(kind, v)}
        quick={quickChips.small}
        monthly
      />
    </QuestionLayout>
  );
}
