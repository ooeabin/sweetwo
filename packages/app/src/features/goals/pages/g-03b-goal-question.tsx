import type { Answers } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { autoAdvances, currentAnswer, GoalQuestionInput, submitValue } from '../../onboarding';
import { copy } from '../copy';
import { addPath, templateOf } from '../add/flow';
import { useAddStep } from '../add/step';

// G-03b 템플릿별 질문(O-23 그대로, 질문마다 화면 하나). 답은 추가 초안에 쌓는다.
export function G03bGoalQuestion({ index }: { index: number }) {
  const s = useAddStep(`q${index}`);
  const [val, setVal] = useState<Answers[string]>(undefined);
  const t = templateOf(s.draft);
  const q = t?.questions[index - 1];
  if (!t || !q) return <Navigate to={addPath()} replace />;
  const v = currentAnswer(q, val, s.draft.answers);
  const out = submitValue(q, v);
  const save = (x: Answers[string], est: boolean) =>
    s.next({ answers: { ...s.draft.answers, [q.id]: x, [`${q.id}_estimated`]: est } });
  return (
    <QuestionLayout
      steps={s.steps}
      title={q.title}
      onBack={s.onBack}
      primary={autoAdvances(q) ? undefined : { label: copy.next, disabled: out === null }}
      onSubmit={autoAdvances(q) ? undefined : () => out !== null && save(out, false)}
    >
      <GoalQuestionInput
        q={q}
        t={t}
        value={v}
        details={s.draft.answers}
        onChange={setVal}
        onAnswer={save}
      />
    </QuestionLayout>
  );
}
