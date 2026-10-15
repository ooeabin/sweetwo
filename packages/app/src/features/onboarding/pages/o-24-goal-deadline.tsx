import { updateGoal } from '@sweetwo/api';
import {
  monthlyNeed,
  readWon,
  templateByKey,
  thisMonth,
  unsureDeadline,
  ymToDate,
  type Answers,
  type YearMonth,
} from '@sweetwo/core';
import { QuestionLayout, YearInput, YearMonthInput } from '@sweetwo/ui';
import { useState } from 'react';
import { GoalChip } from '../confirm';
import { copy } from '../copy';
import { topGoal } from '../flow';
import { useStep } from '../step';

// O-24 1순위 목표 기한(Q4 연도, 양가 큰 행사는 연·월). 기본 기한 미리 채움, 올해 이전 불가.
// 월 필요액 = (목표 금액 − 보유액) ÷ 남은 개월, 1만 원 단위 올림(docs/spec/06-calc-allocation.md 5-3)
export function O24GoalDeadline() {
  const s = useStep('o-24');
  const goal = topGoal(s.state.goals);
  const t = goal ? templateByKey(goal.template) : undefined;
  const now = thisMonth();
  const nowYear = Number(now.slice(0, 4));
  const [picked, setPicked] = useState<YearMonth | null | undefined>(undefined);
  if (!s.ready || !goal || !t) return null;

  const details = (goal.details ?? {}) as Answers;
  const def = t.defaultDeadline(details, {
    childPlan: s.state.space?.child_plan,
    weddingDate: s.state.space?.wedding_date ?? null,
  });
  const saved = goal.deadline ? (goal.deadline.slice(0, 7) as YearMonth) : null;
  const value = picked === undefined ? (saved ?? def.value) : picked;
  const year = value ? Number(value.slice(0, 4)) : null;
  const error = year !== null && year < nowYear ? copy.notBeforeThisYear(nowYear) : undefined;
  const need =
    value && !error
      ? monthlyNeed({ target: goal.target_amount ?? 0, held: goal.other_held, deadline: value })
      : null;

  const save = (ym: YearMonth, estimated: boolean) =>
    s.done(() => updateGoal(goal.id, { deadline: ymToDate(ym), deadline_estimated: estimated }));
  const yearToYm = (y: number) => `${y}-${now.slice(5, 7)}` as YearMonth; // 연도만 고르면 이번 달과 같은 달

  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.goalDeadline}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || !!error, loading: s.saving }}
      onSubmit={() => value && void save(value, false)}
    >
      <GoalChip tag={copy.first} name={goal.name} />
      {t.deadlineYearMonth ? (
        <YearMonthInput
          label={copy.goalDeadline}
          value={value}
          onChange={(v) => setPicked((v as YearMonth | null) ?? null)}
          error={error}
        />
      ) : (
        <YearInput
          label={copy.goalDeadline}
          value={year}
          onChange={(y) => setPicked(y ? yearToYm(y) : null)}
          error={error}
          suffix={year && year > nowYear ? copy.yearsLater(year - nowYear) : undefined}
          onComplete={(y) => y >= nowYear && void save(yearToYm(y), false)}
        />
      )}
      {need && (
        <div className="hg-stack" style={{ gap: 'var(--space-1)' }} aria-live="polite">
          <b>{copy.monthlyNeed(readWon(need.need))}</b>
          <span className="hg-help">
            {copy.needFormula(
              readWon(Math.max((goal.target_amount ?? 0) - goal.other_held, 0)),
              need.months,
            )}
          </span>
        </div>
      )}
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          const d = def.value ? def : unsureDeadline();
          if (d.value) void save(d.value, d.estimated || !def.value);
        }}
      >
        {copy.unsure}
      </button>
    </QuestionLayout>
  );
}
