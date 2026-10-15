import { nextOccurrence, thisMonth, type YearMonth } from '@sweetwo/core';
import { MonthChips, QuestionLayout, YearMonthInput } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { copy } from '../copy';
import { addPath, templateOf } from '../add/flow';
import { useAddStep } from '../add/step';

// G-03c 기한(Q4 연·월). 템플릿 추천값 채움, 이번 달 이전 불가. 매년형은 “매년 몇 월에 써요?”(월 칩, 다음 사용 달)
export function G03cGoalDeadline() {
  const s = useAddStep('deadline');
  const [picked, setPicked] = useState<YearMonth | null | undefined>(undefined);
  const t = templateOf(s.draft);
  if (!t) return <Navigate to={addPath()} replace />;
  const yearly = t.kind(s.draft.answers) === 'yearly';
  const def = t.defaultDeadline(s.draft.answers, {});
  const value = picked === undefined ? (s.draft.deadline ?? def.value) : picked;
  const err = value && value < thisMonth() ? copy.notBeforeThisMonth : undefined;

  if (yearly)
    return (
      <QuestionLayout steps={s.steps} title={copy.editYearly} onBack={s.onBack}>
        <MonthChips
          label={copy.editYearly}
          value={value ? Number(value.slice(5, 7)) : null}
          onChange={(m) => s.next({ deadline: nextOccurrence(m), deadlineEstimated: false })}
        />
      </QuestionLayout>
    );
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.editDeadline}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !value || !!err }}
      onSubmit={() =>
        value &&
        !err &&
        s.next({ deadline: value, deadlineEstimated: picked === undefined && def.estimated })
      }
    >
      <YearMonthInput
        label={copy.editDeadline}
        value={value}
        onChange={(v) => setPicked((v as YearMonth | null) ?? null)}
        error={err}
      />
    </QuestionLayout>
  );
}
