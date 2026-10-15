import { insertGoals, updateGoal } from '@sweetwo/api';
import { quickChips, weddingGoal } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip } from '../confirm';
import { copy } from '../copy';
import { saveSpace, type Goal, type Space } from '../data';
import { useStep } from '../step';

/** 결혼 비용 목표 만들기·고치기: 목표 = 총예산 − 양가 지원, 보유액 = 모아둔 돈, 기한 = 예식일(미정이면 예정 월, 추정) */
export async function upsertWeddingGoal(sp: Space, saved: number, goals: Goal[]) {
  const g = weddingGoal({ budget: sp.wedding_budget ?? 0, support: sp.family_support ?? 0, saved });
  const deadline = sp.wedding_date ? `${sp.wedding_date.slice(0, 7)}-01` : sp.wedding_month;
  const row = {
    target_amount: g.target,
    other_held: g.held,
    amount_estimated: sp.wedding_budget_estimated || sp.family_support_estimated,
    deadline,
    deadline_estimated: !sp.wedding_date,
  };
  const cur = goals.find((x) => x.template === 'wedding');
  if (cur) await updateGoal(cur.id, row);
  else
    await insertGoals([
      { template: 'wedding', name: '결혼 비용', kind: 'once', priority: 0, ...row },
    ]);
}

// O-19c 모아둔 결혼 준비 돈(Q3, ‘없어요’ = 0). → 결혼 비용 목표 생성
export function O19cWeddingSaved() {
  const s = useStep('o-19c');
  const sp = s.state.space;
  const [v, setV] = useState<number | null | undefined>(undefined);
  if (!s.ready || !sp) return null;
  const value = v === undefined ? sp.wedding_saved : v;
  const save = (amount: number) =>
    s.done(async () => {
      await saveSpace({ wedding_saved: amount });
      await upsertWeddingGoal({ ...sp, wedding_saved: amount }, amount, s.state.goals ?? []);
    });
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.weddingSaved}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || value <= 0, loading: s.saving }}
      onSubmit={() => value && void save(value)}
    >
      <GoalChip name={copy.weddingGoalChip} index={3} total={3} />
      <AmountInput
        label={copy.weddingSaved}
        value={value}
        onChange={setV}
        quick={quickChips.small}
        zeroLink={{ label: copy.none, onClick: () => void save(0) }}
      />
    </QuestionLayout>
  );
}
