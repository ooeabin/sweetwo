import { updateGoal } from '@sweetwo/api';
import { templateByKey, ymToDate, type Answers, type GoalQuestion } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip, useConfirmOnce } from '../confirm';
import {
  autoAdvances,
  currentAnswer,
  GoalQuestionInput,
  submitValue,
} from '../goal-question-input';
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
  const v = currentAnswer(q, val, details);
  const out = submitValue(q, v);
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={q.title}
      onBack={s.onBack}
      primary={
        autoAdvances(q)
          ? undefined
          : { label: copy.next, disabled: out === null, loading: s.saving }
      }
      onSubmit={
        autoAdvances(q)
          ? undefined
          : () => {
              if (out === null) return;
              // 20억 원 이상이면 한 번 확인(금액만)
              if (q.type === 'amount' && !ok.check((out as number) >= 2_000_000_000)) return;
              void save(out, q.type === 'amount' ? estimated : false);
            }
      }
    >
      {head}
      <GoalQuestionInput
        q={q}
        t={t}
        value={v}
        details={details}
        onChange={(x) => {
          setVal(x);
          setEstimated(false);
          ok.reset();
        }}
        onAnswer={(x, est) => void save(x, est)}
      />
      {q.type === 'amount' && ok.banner}
    </QuestionLayout>
  );
}
