import { propose, qk, updateGoal, updateMe, updateSpace } from '@sweetwo/api';
import {
  cutSpending,
  extendDeadlines,
  formatManWon,
  formatMonthDay,
  formatYm,
  lowerTargets,
  proposalApplyOn,
  readWon,
  ymToDate,
} from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { useGoalsData } from '../data';

type Plan = 'deadline' | 'amount' | 'spend';

// G-04 충돌 조정: “목표가 저축 가능 금액보다 월 n 많아요”. 안 1 기한 늘리기 / 안 2 금액 줄이기 / 안 3 지출 줄이기(생활비 예산, 내 용돈만).
// 안마다 바뀌는 값 전 → 후. 연결된 부부 = 바뀌는 값마다 제안(목표 기한·금액, 생활비 예산, 내 용돈), 아니면 바로 적용.
// 직접 조정(목표별 월 배분 고정값)은 배분 고정값을 만들 때. 닫기 = 배너 유지.
export function G04GoalAdjust() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const [pick, setPick] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.view || !d.space || !d.me || !d.couple) return null;
  const v = d.view;
  if (v.shortfall <= 0) return <Navigate to="/goals" replace />;

  const c = d.couple;
  const deadlines = extendDeadlines(v.alloc);
  const targets = lowerTargets(v.alloc);
  const cut = cutSpending({
    shortfall: v.alloc.shortfall,
    livingBudget: d.space.living_budget ?? 0,
    myAllowance: c.myAllowance ?? 0,
    // 합류 전 배우자 용돈 = 내 용돈 가정이면 내 용돈 1만 원이 2만 원을 만든다
    allowanceFactor: !c.joined && v.sum.basis === 'couple' ? 2 : 1,
  });
  const goalName = (id: string) => d.goals.find((g) => g.id === id)?.name ?? '';
  const goalRow = (id: string) => d.goals.find((g) => g.id === id);

  const lines: Record<Plan, string[] | null> = {
    deadline: deadlines
      ? deadlines.map((x) =>
          copy.adjustLine(
            goalName(x.goal.id),
            x.goal.deadline ? formatYm(x.goal.deadline) : copy.planUnknown,
            formatYm(x.deadline),
          ),
        )
      : null,
    amount: targets
      ? targets.map((x) =>
          copy.adjustLine(goalName(x.goal.id), readWon(x.goal.target ?? 0), readWon(x.target)),
        )
      : null,
    spend: cut
      ? [
          ...(cut.livingCut > 0
            ? [copy.adjustLiving(readWon(d.space.living_budget ?? 0), readWon(cut.livingBudget))]
            : []),
          ...(cut.allowanceCut > 0
            ? [copy.adjustAllowance(readWon(c.myAllowance ?? 0), readWon(cut.myAllowance))]
            : []),
        ]
      : null,
  };
  const options = (['deadline', 'amount', 'spend'] as Plan[])
    .filter((k) => lines[k])
    .map((k) => ({
      value: k,
      label:
        k === 'deadline'
          ? copy.adjustDeadline
          : k === 'amount'
            ? copy.adjustAmount
            : copy.adjustSpend,
      detail: (
        <span className="hg-stack" style={{ gap: 0 }}>
          {(lines[k] ?? []).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </span>
      ),
    }));

  const apply = async () => {
    if (!pick || saving) return;
    setSaving(true);
    try {
      const on = d.connected && d.base !== null ? proposalApplyOn(d.base) : null;
      if (pick === 'deadline' && deadlines)
        for (const x of deadlines) {
          const g = goalRow(x.goal.id);
          if (!g) continue;
          if (on) await propose('goal_deadline', { deadline: ymToDate(x.deadline) }, on, g.id);
          else
            await updateGoal(g.id, { deadline: ymToDate(x.deadline), deadline_estimated: false });
        }
      if (pick === 'amount' && targets)
        for (const x of targets) {
          const g = goalRow(x.goal.id);
          if (!g) continue;
          if (on) await propose('goal_amount', { target_amount: x.target }, on, g.id);
          else await updateGoal(g.id, { target_amount: x.target, amount_estimated: false });
        }
      if (pick === 'spend' && cut) {
        if (cut.livingCut > 0) {
          if (on) await propose('living_budget', { living_budget: cut.livingBudget }, on);
          else
            await updateSpace({ living_budget: cut.livingBudget, living_budget_estimated: false });
        }
        if (cut.allowanceCut > 0) {
          if (on) await propose('allowance', { allowance: cut.myAllowance }, on);
          else await updateMe({ allowance: cut.myAllowance });
        }
      }
      toast(on ? copy.proposed(c.partnerName) : copy.adjustDone);
      await Promise.all(
        [qk.goals, qk.proposals, qk.space, qk.me].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      nav('/goals');
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  const title = copy.adjustTitle(`${formatManWon(v.shortfall)} 원`);
  return (
    <QuestionLayout
      title={title}
      help={
        d.connected && pick && d.base !== null
          ? proposalCopy.applyNote(formatMonthDay(proposalApplyOn(d.base)))
          : undefined
      }
      onBack={() => nav('/goals')}
      primary={
        options.length
          ? {
              label: d.connected ? copy.proposeTo(c.partnerName) : copy.adjustApply,
              disabled: !pick,
              loading: saving,
            }
          : { label: copy.close }
      }
      onSubmit={options.length ? () => void apply() : () => nav('/goals')}
    >
      {options.length ? (
        <ChoiceCards<Plan>
          label={copy.adjustLabel}
          value={pick}
          onChange={setPick}
          autoAdvance={false}
          options={options}
        />
      ) : (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.adjustNone}
        </p>
      )}
    </QuestionLayout>
  );
}
