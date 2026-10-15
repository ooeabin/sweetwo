import { updateGoal } from '@sweetwo/api';
import {
  bands,
  quickChips,
  readWon,
  templateByKey,
  ymToDate,
  type AnnualItem,
  type Answers,
  type GoalQuestion,
} from '@sweetwo/core';
import {
  AmountInput,
  ChoiceCards,
  emptyRow,
  ListInput,
  listReady,
  MonthChips,
  PercentSlider,
  QuestionLayout,
  ShortText,
  YearMonthInput,
  type ListRowValue,
} from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip, useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { topGoal } from '../flow';
import { useStep } from '../step';

// O-23 1순위 목표 금액 질문(목표별 표, docs/spec/16-onboarding-1.md). 질문마다 화면 하나: o-23-1, o-23-2 …
// 답은 goal.details에 쌓고, 목표 금액, 형태, (O-24를 안 묻는 목표는) 기한까지 저장한다.
export function O23GoalQuestion({ index }: { index: number }) {
  const id = `o-23-${index}`;
  const s = useStep(id);
  const goal = topGoal(s.state.goals);
  const t = goal ? templateByKey(goal.template) : undefined;
  const q: GoalQuestion | undefined = t?.questions[index - 1];
  const details = (goal?.details ?? {}) as Answers;
  const [val, setVal] = useState<Answers[string]>(undefined);
  const [estimated, setEstimated] = useState(false);
  const ok = useConfirmOnce();
  if (!s.ready || !goal || !t || !q) return null;

  const total = t.questions.length;
  const current = val ?? details[q.id];

  const save = (answer: Answers[string], est = estimated) =>
    s.done(async () => {
      const next: Answers = { ...details, [q.id]: answer, [`${q.id}_estimated`]: est };
      const last = index === total;
      const target = t.target(next);
      const kind = t.kind(next);
      const patch: Parameters<typeof updateGoal>[1] = {
        details: next as never,
        kind,
        target_amount: target,
        amount_estimated: Object.entries(next).some(
          ([k, v]) => k.endsWith('_estimated') && v === true,
        ),
      };
      if (t.key === 'custom' && q.id === 'name' && typeof answer === 'string') patch.name = answer;
      if (last && !t.asksDeadline(next)) {
        const d = t.defaultDeadline(next, {
          childPlan: s.state.space?.child_plan,
          weddingDate: s.state.space?.wedding_date ?? null,
        });
        patch.deadline = d.value ? ymToDate(d.value) : null;
        patch.deadline_estimated = d.estimated;
      }
      await updateGoal(goal.id, patch);
    });

  const head = <GoalChip tag={copy.first} name={goal.name} index={index} total={total} />;
  const layout = (
    children: React.ReactNode,
    primary?: { disabled: boolean; onSubmit: () => void },
  ) => (
    <QuestionLayout
      steps={s.steps}
      title={q.title}
      onBack={s.onBack}
      primary={
        primary ? { label: copy.next, disabled: primary.disabled, loading: s.saving } : undefined
      }
      onSubmit={primary?.onSubmit}
    >
      {head}
      {children}
    </QuestionLayout>
  );

  switch (q.type) {
    case 'amount': {
      const v = typeof current === 'number' ? current : null;
      return layout(
        <>
          <AmountInput
            label={q.title}
            value={v}
            onChange={(x) => {
              setVal(x ?? undefined);
              setEstimated(false);
              ok.reset();
            }}
            quick={quickChips[q.quick]}
            bands={q.band ? bands[q.band] : undefined}
            unsureLabel={copy.unsure}
            onBand={(b) => void save(b.value, true)}
            monthly={t.kind({}) === 'monthly'}
          />
          {ok.banner}
        </>,
        {
          disabled: !v || v <= 0,
          onSubmit: () => v && ok.check(v >= 2_000_000_000) && void save(v),
        },
      );
    }
    case 'percent': {
      const p = typeof current === 'number' ? current : q.initial;
      const price = typeof details.price === 'number' ? details.price : 0;
      const result = Math.round((price * p) / 100);
      return layout(
        <>
          <PercentSlider label={q.title} value={p} onChange={(x) => setVal(x)} left={`${p}%`} />
          <p className="hg-q__help" aria-live="polite">
            {copy.saveRatio(readWon(result))}
          </p>
        </>,
        { disabled: false, onSubmit: () => void save(p, false) },
      );
    }
    case 'text': {
      const v = typeof current === 'string' ? current : '';
      return layout(
        <ShortText label={q.title} value={v} onChange={(x) => setVal(x)} max={q.max} />,
        {
          disabled: !v.trim(),
          onSubmit: () => void save(v.trim(), false),
        },
      );
    }
    case 'choice':
      return layout(
        <ChoiceCards
          label={q.title}
          value={typeof current === 'string' ? current : null}
          onChange={(x) => setVal(x)}
          onPick={(x) => void save(x, false)}
          options={q.options}
        />,
      );
    case 'yearMonth': {
      const v = typeof current === 'string' ? current : null;
      return layout(
        <YearMonthInput label={q.title} value={v} onChange={(x) => setVal(x ?? undefined)} />,
        {
          disabled: !v,
          onSubmit: () => v && void save(v, false),
        },
      );
    }
    case 'month':
      return layout(
        <MonthChips
          label={q.title}
          value={typeof current === 'number' ? current : null}
          onChange={(m) => {
            setVal(m);
            void save(m, false);
          }}
        />,
      );
    case 'list': {
      const rows: ListRowValue[] = Array.isArray(current)
        ? (current as AnnualItem[]).map((i) => ({ name: i.name, amount: i.amount, month: i.month }))
        : [emptyRow()];
      return layout(
        <ListInput
          label={q.title}
          rows={rows}
          onChange={(r) => setVal(r as unknown as AnnualItem[])}
          totalLabel={(m) => copy.yearTotal(m)}
        />,
        {
          disabled: !listReady(rows),
          onSubmit: () =>
            void save(
              rows
                .filter((r) => r.name.trim() && r.amount && r.month)
                .map((r) => ({ name: r.name.trim(), amount: r.amount ?? 0, month: r.month ?? 1 })),
              false,
            ),
        },
      );
    }
  }
}
