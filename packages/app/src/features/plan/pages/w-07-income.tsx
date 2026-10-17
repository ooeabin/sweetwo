import {
  fetchIncomeEvents,
  fetchMe,
  fetchPartner,
  insertIncomeEvent,
  qk,
  trashIncomeEvent,
} from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import {
  AmountInput,
  Button,
  ChoiceCards,
  IconButton,
  ListRow,
  MonthChips,
  PageHeader,
  QuestionLayout,
  SectionHeader,
  ShortText,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { copy } from '../copy';

// W-07 들어오는 돈(docs/spec/21-month-close.md): 상여금·연말정산 환급 등 들어오는 돈만(나가는 돈은 매년 목표).
// 목록 = 월별로 묶음, 추가 = 이름 → 금액 → 몇 월에(매년 반복 여부). 진입: W-01 특이사항, F-05.
// 들어오는 달 W-01 ‘추가 소득 나누기’ 카드(목표 / 용돈 비율)는 다음 단계.
export function W07Income() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const events = useQuery({ queryKey: qk.incomeEvents, queryFn: fetchIncomeEvents });
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const list = events.data ?? [];
  const months = [...new Set(list.map((e) => e.month))].sort((a, b) => a - b);
  const who = (id: string) =>
    id === me.data?.id ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? '');

  const remove = async (id: string) => {
    try {
      await trashIncomeEvent(id);
      await qc.invalidateQueries({ queryKey: qk.incomeEvents });
      toast(copy.incomeDeleted, {
        label: copy.undo,
        onClick: () =>
          void trashIncomeEvent(id, true).then(() =>
            qc.invalidateQueries({ queryKey: qk.incomeEvents }),
          ),
      });
    } catch {
      toast(copy.loadFailed);
    }
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.incomeTitle} backLabel={copy.back} onBack={() => nav(-1)} />
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.incomeHelp}
      </p>
      {!events.isLoading && !list.length && (
        <p className="hg-card__meta" style={{ margin: 0 }}>
          {copy.incomeEmpty}
        </p>
      )}
      {months.map((mm) => (
        <section key={mm} className="hg-stack" aria-label={copy.incomeMonth(mm)}>
          <SectionHeader title={copy.incomeMonth(mm)} />
          <div className="hg-list">
            {list
              .filter((e) => e.month === mm)
              .map((e) => (
                <div key={e.id} className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  <div style={{ flex: 1 }}>
                    <ListRow
                      label={e.name}
                      sub={`${who(e.owner_user_id)}, ${e.yearly ? copy.incomeYearly : copy.incomeOnce}`}
                      value={m(e.amount)}
                    />
                  </div>
                  {e.owner_user_id === me.data?.id && (
                    <IconButton
                      icon="trash-2"
                      label={copy.incomeDelete(e.name)}
                      ghost
                      onClick={() => void remove(e.id)}
                    />
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
      <Button
        variant="secondary"
        onClick={() => nav('/plan/income/new/name')}
        style={{ alignSelf: 'flex-start' }}
      >
        {copy.incomeAdd}
      </Button>
    </div>
  );
  return <MainFrame current="month" columns={[body]} />;
}

type Step = 'name' | 'amount' | 'when';
const STEPS: Step[] = ['name', 'amount', 'when'];
interface Draft {
  name: string;
  amount: number | null;
  month: number | null;
  yearly: boolean;
}
const empty: Draft = { name: '', amount: null, month: null, yearly: true };
/** 추가 중인 값(이번 실행에서만) */
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void; reset: () => void }>(
  (set, get) => ({
    d: empty,
    set: (p) => set({ d: { ...get().d, ...p } }),
    reset: () => set({ d: empty }),
  }),
);

/** W-07 추가: 이름 → 금액 → 몇 월에(매년 반복 여부) */
export function W07IncomeAdd() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const param = useParams().step;
  const step = STEPS.find((x) => x === param);
  const { d: draft, set, reset } = useDraft();
  const [saving, setSaving] = useState(false);
  if (!step) return <Navigate to="/plan/income/new/name" replace />;
  const i = STEPS.indexOf(step);
  const steps = { total: STEPS.length, now: i };
  const back = () => (i > 0 ? nav(`/plan/income/new/${STEPS[i - 1]}`) : nav('/plan/income'));
  const go = () => nav(`/plan/income/new/${STEPS[i + 1]}`);

  if (step === 'name')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.incomeName}
        onBack={back}
        primary={{ label: copy.next, disabled: !draft.name.trim() }}
        onSubmit={() => draft.name.trim() && go()}
      >
        <ShortText
          label={copy.incomeName}
          value={draft.name}
          onChange={(name) => set({ name })}
          max={20}
        />
      </QuestionLayout>
    );
  if (step === 'amount')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.incomeAmount}
        onBack={back}
        primary={{ label: copy.next, disabled: !draft.amount }}
        onSubmit={() => draft.amount && go()}
      >
        <AmountInput
          label={copy.incomeAmount}
          value={draft.amount}
          onChange={(amount) => set({ amount })}
          quick={quickChips.small}
        />
      </QuestionLayout>
    );

  const save = async () => {
    if (saving || !draft.name.trim() || !draft.amount || draft.month === null) return;
    setSaving(true);
    try {
      await insertIncomeEvent({
        name: draft.name.trim(),
        amount: draft.amount,
        month: draft.month,
        yearly: draft.yearly,
      });
      await qc.invalidateQueries({ queryKey: qk.incomeEvents });
      reset();
      toast(copy.incomeSaved);
      nav('/plan/income', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout
      steps={steps}
      title={copy.incomeWhen}
      onBack={back}
      primary={{ label: copy.editSave, disabled: draft.month === null, loading: saving }}
      onSubmit={() => void save()}
    >
      <MonthChips
        label={copy.incomeWhen}
        value={draft.month}
        onChange={(month) => set({ month })}
      />
      <ChoiceCards<'yes' | 'no'>
        label={copy.incomeRepeat}
        value={draft.yearly ? 'yes' : 'no'}
        onChange={(x) => set({ yearly: x === 'yes' })}
        autoAdvance={false}
        autoFocus={false}
        shortcuts={false}
        options={[
          { value: 'yes', label: copy.incomeYearly },
          { value: 'no', label: copy.incomeOnce },
        ]}
      />
    </QuestionLayout>
  );
}
