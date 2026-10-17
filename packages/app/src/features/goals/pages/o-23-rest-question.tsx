import { qk, updateGoal } from '@sweetwo/api';
import { orderableGoals, templateByKey, ymToDate, type Answers } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import {
  autoAdvances,
  currentAnswer,
  GoalChip,
  GoalQuestionInput,
  submitValue,
} from '../../onboarding';
import { copy } from '../copy';
import { restPath, useRest } from '../week/rest';

// O-23 나머지 목표 금액 질문(첫 주 5일째, 목표별 표). 온보딩 1순위 질문과 같은 입력과 저장 규칙:
// 답은 goal.details에, 목표 금액·형태, (기한을 안 묻는 목표는) 기본 기한까지. 저장 뒤 남은 다음 화면
export function O23RestQuestion() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '', i = '1' } = useParams();
  const { d } = useRest();
  const [val, setVal] = useState<Answers[string]>(undefined);
  const [estimated, setEstimated] = useState(false);
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  const goal = d.goals.find((g) => g.id === id);
  const t = goal ? templateByKey(goal.template) : undefined;
  const index = Number(i);
  const q = t?.questions[index - 1];
  if (!goal || !t || !q) return <Navigate to={restPath.next} replace />;
  const details = (goal.details ?? {}) as Answers;
  const rank = orderableGoals(d.goals).findIndex((g) => g.id === id) + 1;

  const save = async (answer: Answers[string], est: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const next: Answers = { ...details, [q.id]: answer, [`${q.id}_estimated`]: est };
      const patch: Parameters<typeof updateGoal>[1] = {
        details: next as never,
        kind: t.kind(next),
        target_amount: t.target(next),
        amount_estimated: Object.entries(next).some(
          ([k, v]) => k.endsWith('_estimated') && v === true,
        ),
      };
      if (t.key === 'custom' && q.id === 'name' && typeof answer === 'string') patch.name = answer;
      if (index === t.questions.length && !t.asksDeadline(next)) {
        const dl = t.defaultDeadline(next, {
          childPlan: d.space?.child_plan,
          weddingDate: d.space?.wedding_date ?? null,
        });
        patch.deadline = dl.value ? ymToDate(dl.value) : null;
        patch.deadline_estimated = dl.estimated;
      }
      await updateGoal(goal.id, patch);
      await qc.invalidateQueries({ queryKey: qk.goals });
      setVal(undefined);
      nav(restPath.next);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  const v = currentAnswer(q, val, details);
  const out = submitValue(q, v);
  return (
    <QuestionLayout
      title={q.title}
      onBack={() => nav(-1)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
      primary={
        autoAdvances(q) ? undefined : { label: copy.next, disabled: out === null, loading: saving }
      }
      onSubmit={
        autoAdvances(q)
          ? undefined
          : () => out !== null && void save(out, q.type === 'amount' ? estimated : false)
      }
    >
      <GoalChip
        tag={rank > 0 ? copy.weekRank(rank) : undefined}
        name={goal.name}
        index={index}
        total={t.questions.length}
      />
      <GoalQuestionInput
        key={`${goal.id}-${q.id}`}
        q={q}
        t={t}
        value={v}
        details={details}
        onChange={(x) => {
          setVal(x);
          setEstimated(false);
        }}
        onAnswer={(x, est) => {
          setEstimated(est);
          void save(x, est);
        }}
      />
    </QuestionLayout>
  );
}
