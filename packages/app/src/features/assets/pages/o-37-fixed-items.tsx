import {
  fetchFixedExpenses,
  insertFixedExpenses,
  qk,
  trashFixedExpenses,
  updateFixedExpense,
  updateSpace,
  type FixedExpense,
} from '@sweetwo/api';
import { fixedGroupByKey, quickChips } from '@sweetwo/core';
import { AmountInput, Chip, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { weekPath } from '../week/week';

/** 같이 내는 항목만 묻는다(각자 내는 휴대폰 등은 용돈에서 나감, O-36 보조 문구) */
const asked = (rows: FixedExpense[]) => rows.filter((r) => r.burden === 'shared');
/** 그룹만 고르고 세부 항목을 안 고른 줄 */
const groupOnly = (r: FixedExpense) => {
  const g = fixedGroupByKey(r.group_key);
  return !!g && r.name === g.name && g.items.length > 0;
};

// O-37 항목별 고정지출(Q3 반복, 첫 주 4일째 ‘고정지출 나누기·생활비 카드’). O-36에서 그룹만 골랐으면 첫 화면에서 세부 항목을 고름.
// 항목마다 “{항목}에 한 달에 얼마 나가요?”, 넘길 때마다 저장. 끝나면 입력 합계가 O-36 합계를 대신하고 안 나눈 돈을 다시 셈 → O-38b
export function O37FixedItems() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const step = useParams().n ?? 'pick';
  const fixed = useQuery({ queryKey: qk.fixedExpenses, queryFn: fetchFixedExpenses });
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (fixed.isLoading) return null;
  const rows = fixed.data ?? [];
  const groups = rows.filter(groupOnly);
  const list = asked(rows);
  const close = { label: copy.weekClose, onClick: () => nav('/') };
  const total = (groups.length ? 1 : 0) + list.length + 1; // + O-38b

  if (step === 'pick') {
    if (!groups.length)
      return <Navigate to={list.length ? weekPath.fixed(1) : weekPath.card} replace />;
    const flip = (g: string, name: string) => {
      const cur = picks[g] ?? [];
      setPicks({
        ...picks,
        [g]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
      });
    };
    const submit = async () => {
      if (saving) return;
      setSaving(true);
      try {
        // 세부 항목을 고른 그룹은 그룹 줄 대신 항목 줄로
        const chosen = groups.filter((r) => (picks[r.group_key] ?? []).length);
        let sort = Math.max(0, ...rows.map((r) => r.sort)) + 1;
        await insertFixedExpenses(
          chosen.flatMap((r) =>
            (fixedGroupByKey(r.group_key)?.items ?? [])
              .filter((it) => (picks[r.group_key] ?? []).includes(it.name))
              .map((it) => ({
                group_key: r.group_key,
                name: it.name,
                burden: it.burden,
                sort: sort++,
              })),
          ),
        );
        await trashFixedExpenses(chosen.map((r) => r.id));
        const next = await fixed.refetch();
        const n = asked(next.data ?? []).length;
        nav(n ? weekPath.fixed(1) : weekPath.card);
      } catch {
        toast(copy.loadFailed);
      } finally {
        setSaving(false);
      }
    };
    return (
      <QuestionLayout
        steps={{ total, now: 0 }}
        title={copy.weekFixedPick}
        help={copy.weekFixedPickHelp}
        onBack={() => nav('/')}
        later={close}
        primary={{ label: copy.next, loading: saving }}
        onSubmit={() => void submit()}
      >
        {groups.map((r) => (
          <div key={r.id} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <span className="hg-card__label">{r.name}</span>
            <div className="hg-quick" role="group" aria-label={r.name}>
              {(fixedGroupByKey(r.group_key)?.items ?? []).map((it) => (
                <Chip
                  key={it.name}
                  small
                  selected={(picks[r.group_key] ?? []).includes(it.name)}
                  onClick={() => flip(r.group_key, it.name)}
                >
                  {it.name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </QuestionLayout>
    );
  }

  const n = Number(step);
  const row = list[n - 1];
  if (!row) return <Navigate to={weekPath.fixedStart} replace />;
  const value = amount === undefined ? row.monthly_amount : amount;
  const title = copy.weekFixedAmount(row.name);
  const offset = groups.length ? 1 : 0;

  const next = async () => {
    if (saving || value === null) return;
    setSaving(true);
    try {
      await updateFixedExpense(row.id, { monthly_amount: value });
      setAmount(undefined);
      if (n < list.length) {
        await fixed.refetch();
        nav(weekPath.fixed(n + 1));
        return;
      }
      // 입력 합계가 O-36 같이 내는 돈 합계를 대신(사실값) + 안 나눈 돈 재계산
      const all = asked((await fixed.refetch()).data ?? []);
      await updateSpace({
        fixed_total: all.reduce((t, r) => t + (r.monthly_amount ?? 0), 0),
        fixed_total_estimated: false,
      });
      await recalcPendingShares();
      await Promise.all([qk.space, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })));
      nav(weekPath.card);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={{ total, now: offset + n - 1 }}
      title={title}
      help={copy.weekCount(row.name, n, list.length)}
      onBack={() => {
        setAmount(undefined);
        nav(n > 1 ? weekPath.fixed(n - 1) : groups.length ? weekPath.fixedStart : '/');
      }}
      later={close}
      primary={{ label: copy.next, disabled: value === null, loading: saving }}
      onSubmit={() => void next()}
    >
      <AmountInput
        key={row.id}
        label={title}
        value={value}
        onChange={setAmount}
        quick={quickChips.small}
        monthly
        allowZero
      />
    </QuestionLayout>
  );
}
