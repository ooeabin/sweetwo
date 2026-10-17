import { qk, updateGoal } from '@sweetwo/api';
import {
  monthlyNeed,
  orderableGoals,
  readWon,
  templateByKey,
  thisMonth,
  unsureDeadline,
  ymToDate,
  type Answers,
  type YearMonth,
} from '@sweetwo/core';
import { QuestionLayout, YearInput, YearMonthInput } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { GoalChip, onboardingCopy as oc } from '../../onboarding';
import { copy } from '../copy';
import { restPath, useRest } from '../week/rest';

// O-24 나머지 목표 기한(첫 주 5일째, Q4 연도, 양가 큰 행사는 연·월). 온보딩 1순위 기한과 같은 규칙:
// 기본 기한 미리 채움, 올해 이전 불가, 월 필요액 미리보기, ‘잘 모르겠어요’ = 기본 기한(없으면 3년 뒤 ‘추정’)
export function O24RestDeadline() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const { d } = useRest();
  const now = thisMonth();
  const nowYear = Number(now.slice(0, 4));
  const [picked, setPicked] = useState<YearMonth | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  const goal = d.goals.find((g) => g.id === id);
  const t = goal ? templateByKey(goal.template) : undefined;
  if (!goal || !t) return <Navigate to={restPath.next} replace />;
  const rank = orderableGoals(d.goals).findIndex((g) => g.id === id) + 1;

  const details = (goal.details ?? {}) as Answers;
  const def = t.defaultDeadline(details, {
    childPlan: d.space?.child_plan,
    weddingDate: d.space?.wedding_date ?? null,
  });
  const saved = goal.deadline ? (goal.deadline.slice(0, 7) as YearMonth) : null;
  const value = picked === undefined ? (saved ?? def.value) : picked;
  const year = value ? Number(value.slice(0, 4)) : null;
  const error = year !== null && year < nowYear ? oc.notBeforeThisYear(nowYear) : undefined;
  const need =
    value && !error
      ? monthlyNeed({ target: goal.target_amount ?? 0, held: goal.other_held, deadline: value })
      : null;
  const yearToYm = (y: number) => `${y}-${now.slice(5, 7)}` as YearMonth;

  const save = async (ym: YearMonth, estimated: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateGoal(goal.id, { deadline: ymToDate(ym), deadline_estimated: estimated });
      await qc.invalidateQueries({ queryKey: qk.goals });
      nav(restPath.next);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={oc.goalDeadline}
      onBack={() => nav(-1)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
      primary={{ label: copy.next, disabled: !value || !!error, loading: saving }}
      onSubmit={() => value && !error && void save(value, false)}
    >
      <GoalChip tag={rank > 0 ? copy.weekRank(rank) : undefined} name={goal.name} />
      {t.deadlineYearMonth ? (
        <YearMonthInput
          label={oc.goalDeadline}
          value={value}
          onChange={(v) => setPicked((v as YearMonth | null) ?? null)}
          error={error}
        />
      ) : (
        <YearInput
          label={oc.goalDeadline}
          value={year}
          onChange={(y) => setPicked(y ? yearToYm(y) : null)}
          error={error}
          suffix={year && year > nowYear ? oc.yearsLater(year - nowYear) : undefined}
        />
      )}
      {need && (
        <div className="hg-stack" style={{ gap: 'var(--space-1)' }} aria-live="polite">
          <b>{oc.monthlyNeed(readWon(need.need))}</b>
          <span className="hg-help">
            {oc.needFormula(
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
          const dl = def.value ? def : unsureDeadline();
          if (dl.value) void save(dl.value, dl.estimated || !def.value);
        }}
      >
        {oc.unsure}
      </button>
    </QuestionLayout>
  );
}
