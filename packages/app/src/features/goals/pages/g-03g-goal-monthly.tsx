import { qk, saveSplit } from '@sweetwo/api';
import { goalNeed, leftover, readWon, type SplitLineDraft } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { toAllocGoal, toDraft, useSplits } from '../../salary';
import { copy } from '../copy';
import { useGoalsData } from '../data';

// G-03g 매달 넣는 돈(2026-11-03, 금액 정하기 G-03b → G-03c 다음). 목표 금액을 정해도 분배표 저금 줄이 그대로라
// “매달 넣는 돈 0원, 예상 미정”이 되던 문제. 추천값 = min(월 필요액, 지금 줄 + 남는 돈). 저장 = 내 분배표(합쳐서면 공동)의 그 목표 저금 줄.
// 분배표가 없으면(월급 없음) 이 화면 없이 목표 상세로.
export function G03gGoalMonthly() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const data = useGoalsData();
  const splits = useSplits();
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  if (data.loading || splits.isLoading) return null;
  const me = data.me;
  const g = data.goals.find((x) => x.id === id);
  const joint = data.space?.salary_mode === 'joint';
  const split = (splits.data ?? []).find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === me?.id,
  );
  const detail = `/goals/${id}`;
  if (!me || !g || !split) return <Navigate to={detail} replace />;

  const income = joint
    ? (me.monthly_income ?? 0) + (data.couple?.partnerIncome ?? 0)
    : (me.monthly_income ?? 0);
  const lines = toDraft(split.split_line);
  const at = lines.findIndex((l) => l.kind === 'saving' && l.goalId === id);
  const current = at >= 0 ? (lines[at]?.amount ?? 0) : 0;
  const left = leftover(income, lines);
  const need = goalNeed(toAllocGoal(g));
  const recommended = need === null ? current : Math.min(need, current + Math.max(left, 0));
  const amount = value === undefined ? recommended : value;

  const save = async () => {
    if (amount === null || busy) return;
    setBusy(true);
    const line: SplitLineDraft = { kind: 'saving', amount, goalId: id };
    const next =
      at >= 0 ? lines.map((l, i) => (i === at ? { ...l, amount } : l)) : [line, ...lines];
    try {
      await saveSplit(next, joint ? undefined : me.id);
      await Promise.all([qk.splits, qk.goals].map((k) => qc.invalidateQueries({ queryKey: k })));
      // 남는 돈이 모자라면 분배표로(줄이는 건 사용자가)
      if (leftover(income, next) < 0) {
        toast(copy.monthlyShort);
        nav('/salary/split', { replace: true });
      } else {
        toast(copy.saved);
        nav(detail, { replace: true });
      }
    } catch {
      toast(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.monthlyTitle}
      help={need !== null ? copy.monthlyNeed(readWon(need)) : undefined}
      onBack={() => nav(detail, { replace: true })}
      primary={{ label: copy.next, disabled: amount === null, loading: busy }}
      later={{ label: copy.monthlyLater, onClick: () => nav(detail, { replace: true }) }}
      onSubmit={() => void save()}
    >
      <AmountInput
        label={copy.monthlyTitle}
        value={amount}
        onChange={setValue}
        monthly
        embedded
        allowZero
      />
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.monthlyLeft(readWon(left))}
      </p>
    </QuestionLayout>
  );
}
