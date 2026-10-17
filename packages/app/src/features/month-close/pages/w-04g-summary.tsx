import {
  ensureMonthClose,
  fetchRecentCloses,
  propose,
  qk,
  updateMonthClose,
  updateSpace,
} from '@sweetwo/api';
import {
  formatManWon,
  livingBudgetFix,
  livingSaved,
  planGap,
  proposalApplyOn,
  readPlanSnapshot,
  readWon,
  spaceBaseDay,
  spendChanges,
  spreadMonthly,
  type PlanRow,
} from '@sweetwo/core';
import { ChoiceCards, MonthSummary, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, closeProgress, useCloseData } from '../data';
import { closeSummaryProps } from '../summary';

type GapChoice = 'spread_3m' | 'extend' | 'skip_this_month';

// W-04g 정산 요약(docs/spec/21-month-close.md, MonthSummary). 계산은 core monthSummary·close-review.
// 순서: MonthSummary(지난달보다 칩, 생활비 예산 보정 제안 카드) → 잘한 점 1개 → 계획 대비 표 → 미달·초과 처리
// → ‘더 꼼꼼히 정리하기’. 미달: 3개월에 나눠 채우기 / 기한 늘리기 / 이번 달만 넘어가기, 초과: 더 넣을 목표.
export function W04gSummary() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useCloseData();
  const closes = useQuery({ queryKey: qk.recentCloses, queryFn: () => fetchRecentCloses(3) });
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  if (d.loading || !d.close || closes.isLoading) return null;

  const c = d.close;
  const before = (closes.data ?? []).filter((x) => x.id !== c.id);
  const variable = c.spends.reduce((t, x) => t + x.amount, 0);

  // 지난달보다: 변동 항목별, 최대 4개
  const names = new Map(d.cats.map((x) => [x.id, x.name]));
  const prev = before[0];
  const changes = prev
    ? spendChanges(c.spends, prev.spends).flatMap((x) => {
        const name = names.get(x.category_id);
        return name ? [{ name, diff: Math.round(x.diff / 10_000) * 10_000 }] : [];
      })
    : undefined;

  // 생활비 예산 보정 제안(이번 달 + 지난 정리 2개)
  const budget = d.space?.living_budget ?? 0;
  const fix = !c.budget_fix
    ? livingBudgetFix(budget, [
        variable,
        ...before.slice(0, 2).map((x) => x.spends.reduce((t, s) => t + s.amount, 0)),
      ])
    : null;
  const space = d.space;
  const proposal = d.joined && !d.solo;
  const answerFix = async (apply: boolean) => {
    if (!fix || !space || !d.me) return;
    try {
      if (apply) {
        const base = d.couple ? spaceBaseDay(space, d.couple) : null;
        if (proposal && base !== null)
          await propose('living_budget', { living_budget: fix.avg }, proposalApplyOn(base));
        else await updateSpace({ living_budget: fix.avg, living_budget_estimated: false });
      }
      await updateMonthClose(c.id, { budget_fix: apply ? 'applied' : 'kept' });
      await Promise.all([
        d.refreshClose(),
        qc.invalidateQueries({ queryKey: qk.space }),
        qc.invalidateQueries({ queryKey: qk.proposals }),
      ]);
      if (apply) toast(proposal ? copy.fixProposed(d.partnerName) : copy.fixApplied);
    } catch {
      toast(copy.saveFailed);
    }
  };

  // 계획 대비 표: 목표마다 월급 플랜 계획 배분액, W-04k 넣은 돈, 차이
  const lines = d.plan?.lines ?? [];
  const goalRows: PlanRow[] = d.goals
    .filter((g) => !g.after_marriage)
    .map((g) => ({
      key: g.id,
      name: g.name,
      planned: lines
        .filter((l) => l.target === 'goal' && l.goal_id === g.id)
        .reduce((t, l) => t + l.amount, 0),
      saved: c.deposits.filter((x) => x.goal_id === g.id).reduce((t, x) => t + x.amount, 0),
    }));
  const other = c.deposits.filter((x) => !x.goal_id).reduce((t, x) => t + x.amount, 0);
  const rows = [
    ...goalRows,
    ...(other > 0 ? [{ key: 'etc', name: copy.otherSaving, planned: 0, saved: other }] : []),
  ].filter((r) => r.planned > 0 || r.saved > 0);
  const gap = planGap(rows);
  const saved = c.deposits.reduce((t, x) => t + x.amount, 0);
  // 머리 문장의 계획 = 이번 플랜의 목표자금 + 비상금
  const parts = readPlanSnapshot(d.plan?.snapshot).parts;
  const planSaving = parts ? parts.goalFund + parts.emergency : gap.planned;
  const good = livingSaved(budget, variable);
  const picked = choice ?? c.gap_choice ?? (gap.kind === 'over' ? c.gap_goal_id : null);
  const overGoals = d.goals.filter((g) => !g.after_marriage && g.status !== 'paused');
  const needPick = gap.kind === 'short' || (gap.kind === 'over' && overGoals.length > 0);

  const finish = async () => {
    if (!d.planId || !d.me || saving) return;
    setSaving(true);
    try {
      const id = await ensureMonthClose(d.planId);
      await updateMonthClose(id, {
        status: 'done',
        closed_by: d.me.id,
        closed_at: new Date().toISOString(),
        gap_kind: gap.kind,
        gap_amount: gap.kind ? gap.amount : null,
        gap_choice:
          gap.kind === 'short'
            ? ((picked as GapChoice | null) ?? null)
            : gap.kind === 'over' && picked
              ? 'extra_goal'
              : null,
        gap_goal_id: gap.kind === 'over' ? picked : null,
      });
      await d.refreshClose();
      setSaving(false);
      nav(closePath('w-04-end'), { replace: true });
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void finish() });
    }
  };

  return (
    <QuestionLayout
      steps={closeProgress('w-04g')}
      title={
        planSaving > 0
          ? copy.saved(readWon(saved), Math.round((saved * 100) / planSaving))
          : copy.summary(d.month)
      }
      onBack={() => nav(closePath('w-04k'))}
      primary={{ label: copy.finish, loading: saving, disabled: needPick && !picked }}
      onSubmit={() => void finish()}
    >
      <MonthSummary
        {...closeSummaryProps(c, d, d.month)}
        changes={changes}
        fix={
          fix
            ? {
                text: copy.fixText(formatManWon(fix.avg)),
                onApply: () => void answerFix(true),
                onKeep: () => void answerFix(false),
              }
            : undefined
        }
      />
      {good !== null && (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.good(readWon(good))}
        </p>
      )}
      {rows.length > 0 && (
        <table className="hg-table" aria-label={copy.planTable}>
          <thead>
            <tr>
              <th scope="col">{copy.planCol.name}</th>
              <th scope="col" className="is-num">
                {copy.planCol.planned}
              </th>
              <th scope="col" className="is-num">
                {copy.planCol.saved}
              </th>
              <th scope="col" className="is-num">
                {copy.planCol.diff}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" style={{ background: 'none', fontWeight: 400 }}>
                  {r.name}
                </th>
                <td className="is-num">{formatManWon(r.planned)}</td>
                <td className="is-num">{formatManWon(r.saved)}</td>
                <td className="is-num">{signedMan(r.saved - r.planned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {gap.kind === 'short' && (
        <ChoiceCards<GapChoice>
          label={copy.shortTitle(readWon(gap.amount))}
          options={[
            {
              value: 'spread_3m',
              label: copy.short.spread_3m,
              sub: copy.spreadSub(readWon(spreadMonthly(gap.amount))),
            },
            { value: 'extend', label: copy.short.extend },
            { value: 'skip_this_month', label: copy.short.skip_this_month },
          ]}
          value={(picked as GapChoice | null) ?? null}
          onChange={setChoice}
        />
      )}
      {gap.kind === 'over' && overGoals.length > 0 && (
        <ChoiceCards<string>
          label={copy.overTitle(readWon(gap.amount))}
          options={overGoals.map((g) => ({ value: g.id, label: g.name }))}
          value={picked}
          onChange={setChoice}
        />
      )}
    </QuestionLayout>
  );
}

const signedMan = (n: number) =>
  n === 0 ? '0' : `${n > 0 ? '+' : '−'}${formatManWon(Math.abs(n))}`;
