import { fetchIncomeEvents, qk, saveIncomeEvents } from '@sweetwo/api';
import {
  ListInput,
  QuestionLayout,
  isCompleteRow,
  listReady,
  type ListRowValue,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { weekPath } from '../week/week';

// O-35 상여금 월·금액(Q6, 행 = 이름 + 금액 + 월, 합계 “1년에 {금액} 받아요”). 행마다 연간 이벤트(들어오는 돈, W-07에서 나눔)
export function O35BonusList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const events = useQuery({ queryKey: qk.incomeEvents, queryFn: fetchIncomeEvents });
  const [rows, setRows] = useState<ListRowValue[] | null>(null);
  const [saving, setSaving] = useState(false);
  if (events.isLoading || d.loading) return null;
  const mine = (events.data ?? []).filter((e) => e.owner_user_id === d.me?.id);
  const cur =
    rows ??
    (mine.length
      ? mine.map((e) => ({ name: e.name, amount: e.amount, month: e.month }))
      : [{ name: copy.weekBonusName, amount: null, month: null }]);

  const submit = async () => {
    if (saving || !listReady(cur)) return;
    setSaving(true);
    try {
      await saveIncomeEvents(
        cur.filter(isCompleteRow).map((r) => ({
          name: r.name.trim(),
          amount: r.amount ?? 0,
          month: r.month ?? 1,
        })),
      );
      await qc.invalidateQueries({ queryKey: qk.incomeEvents });
      nav(weekPath.income);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={{ total: 3, now: 1 }}
      title={copy.weekBonusList}
      onBack={() => nav(weekPath.bonus)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
      primary={{ label: copy.next, disabled: !listReady(cur), loading: saving }}
      onSubmit={() => void submit()}
    >
      <ListInput
        label={copy.weekBonusList}
        rows={cur}
        onChange={setRows}
        totalLabel={copy.weekBonusTotal}
      />
    </QuestionLayout>
  );
}
