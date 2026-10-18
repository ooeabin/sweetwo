import {
  IncomePeriodOverlap,
  propose,
  qk,
  setIncomePeriod,
  updateMe,
  updateSpace,
} from '@sweetwo/api';
import {
  addDays,
  formatYm,
  incomeRatio,
  periodSupplement,
  proposalApplyOn,
  spaceBaseDay,
  todayKst,
} from '@sweetwo/core';
import { Badge, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { useGoalsData } from '../../goals';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { moneyPlan } from '../money';
import { replanPath, useReplan } from '../replan/draft';

interface Row {
  key: string;
  label: string;
  now: string;
  after: string;
  tag?: 'now' | 'propose';
}

// F-07c 바뀌는 점 비교·적용(23 F-05f·F-07c, F-07a·b). 지금 / 변경 후(기간이면 그 기간) 나란히.
// 기간: 월 수입, 비상금에서 보충(바로 반영), 저축 가능 금액, 비상금 잔액, 분담 ‘버는 만큼’(제안, 연결된 부부·수입이 줄 때만).
//   적용하기 → 기간 수입 + 보충 줄 + 분담 제안 → F-05, “적용했어요. 분담은 예빈님에게 제안했어요”.
// 일반: 저축 가능 금액, 목표 달성 시기(앞 3개), 용돈. 사실값(수입, 고정지출)은 바로, 생활비 예산은 연결된 부부면 제안.
export function F07cReplanCompare() {
  const { mode = 'period' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const g = useGoalsData();
  const r = useReplan();
  const { masked } = useMask();
  const [saving, setSaving] = useState(false);
  if (d.loading || g.loading || !d.me || !d.space || !d.couple) return null;
  const me = d.me;
  const sp = d.space;
  const c = d.couple;
  const m = (v: number) => money(v, masked);
  const connected = sp.couple_state === 'connected';
  const base = spaceBaseDay(sp, c);
  const applyOn = base !== null ? proposalApplyOn(base) : addDays(todayKst(), 3);
  const now = moneyPlan(me, sp, d.partnerProfile);
  const other = me.other_income ?? 0;
  const rows: Row[] = [];
  let note: ReactNode = null;
  let apply: () => Promise<void>;

  if (mode === 'period') {
    const p = r.period;
    if (!p.start || !p.end || p.amount === null)
      return <Navigate to={replanPath.period('start')} replace />;
    const start = p.start;
    const end = p.end;
    const amount = p.amount;
    const emergency = g.view?.lines.find((l) => l.template === 'emergency')?.held ?? 0;
    const sup = periodSupplement({
      base: me.monthly_income ?? 0,
      amount,
      start,
      end,
      emergencyHeld: emergency,
    });
    const after = moneyPlan(me, sp, d.partnerProfile, { myIncome: amount + other });
    const down = sup.decrease > 0;
    rows.push(
      {
        key: 'income',
        label: copy.compareRows.income,
        now: m(now.sum.income),
        after: m(after.sum.income),
      },
      ...(down
        ? [
            {
              key: 'supplement',
              label: copy.compareRows.supplement,
              now: m(0),
              after: copy.perMonth(m(sup.monthly)),
              tag: 'now' as const,
            },
          ]
        : []),
      {
        key: 'saveable',
        label: copy.compareRows.saveable,
        now: m(now.sum.saveable),
        after: m(after.sum.saveable),
      },
      {
        key: 'emergency',
        label: copy.compareRows.emergency,
        now: m(emergency),
        after: m(Math.max(emergency - sup.monthly * sup.months, 0)),
      },
    );
    const splitProposal = connected && down && sp.split_mode !== 'income';
    if (splitProposal) {
      const partnerIncome = c.partnerIncome ?? 0;
      const starterPct = c.starter
        ? incomeRatio(amount + other, partnerIncome)
        : incomeRatio(partnerIncome, amount + other);
      const nowPct = sp.split_mode === 'custom' ? (sp.split_ratio ?? 50) : 50;
      rows.push({
        key: 'split',
        label: copy.compareRows.split,
        now: `${nowPct}:${100 - nowPct}`,
        after: copy.splitIncome(starterPct, 100 - starterPct),
        tag: 'propose',
      });
    }
    if (sup.short > 0) note = <p className="hg-q__help">{copy.emergencyShort(m(sup.short))}</p>;
    apply = async () => {
      const startDay = `${start}-01`;
      await setIncomePeriod({
        start: startDay,
        end: `${end}-01`,
        amount,
        supplement: down ? sup.monthly : 0,
        splitApplyOn: splitProposal ? (applyOn > startDay ? applyOn : startDay) : null,
      });
      toast(splitProposal ? copy.appliedSplit(c.partnerName) : copy.applied);
      nav('/assets/money', { replace: true });
    };
  } else {
    const income = r.income;
    const fixed = r.fixed;
    const living = r.living;
    const patch = {
      ...(income !== null ? { myIncome: income + other } : {}),
      ...(fixed !== null ? { fixedTotal: fixed } : {}),
      ...(living !== null ? { livingBudget: living } : {}),
    };
    const after = moneyPlan(me, sp, d.partnerProfile, patch);
    rows.push({
      key: 'saveable',
      label: copy.compareRows.saveable,
      now: m(now.sum.saveable),
      after: m(after.sum.saveable),
    });
    const before = g.view?.lines ?? [];
    const next =
      g.viewFor({
        me: { ...me, ...(income !== null ? { monthly_income: income } : {}) },
        space: {
          ...sp,
          ...(fixed !== null ? { fixed_total: fixed } : {}),
          ...(living !== null ? { living_budget: living } : {}),
        },
      })?.lines ?? [];
    for (const l of before
      .filter(
        (x) =>
          x.kind === 'once' &&
          x.target !== null &&
          (x.status === 'active' || x.status === 'delayed'),
      )
      .slice(0, 3)) {
      const a = next.find((x) => x.id === l.id);
      rows.push({
        key: `goal-${l.id}`,
        label: copy.goalWhen(l.name),
        now: l.expected ? formatYm(l.expected) : copy.unknown,
        after: a?.expected ? formatYm(a.expected) : copy.unknown,
      });
    }
    rows.push({
      key: 'allowance',
      label: copy.compareRows.allowance,
      now: m(now.myAllowance ?? 0),
      after: m(after.myAllowance ?? 0),
    });
    const livingProposal = connected && living !== null && living !== sp.living_budget;
    apply = async () => {
      if (income !== null && income !== me.monthly_income)
        await updateMe({ monthly_income: income });
      if (fixed !== null && fixed !== sp.fixed_total)
        await updateSpace({ fixed_total: fixed, fixed_total_estimated: false });
      if (living !== null && living !== sp.living_budget) {
        if (livingProposal) await propose('living_budget', { living_budget: living }, applyOn);
        else await updateSpace({ living_budget: living, living_budget_estimated: false });
      }
      await recalcPendingShares();
      toast(livingProposal ? copy.proposed(c.partnerName) : copy.applied);
      nav(r.kinds.includes('goals') ? '/goals' : '/assets/money', { replace: true });
    };
    if (livingProposal)
      rows.push({
        key: 'living',
        label: copy.living,
        now: m(sp.living_budget ?? 0),
        after: m(living ?? 0),
        tag: 'propose',
      });
  }

  const run = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await apply();
      await Promise.all(
        [qk.me, qk.space, qk.proposals, qk.incomePeriods, qk.lastPlanEnd].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      await qc.invalidateQueries({ queryKey: ['monthly_plan'] });
      r.reset();
    } catch (e) {
      toast(e instanceof IncomePeriodOverlap ? copy.overlap : copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  const afterHead =
    mode === 'period' && r.period.start && r.period.end
      ? `${formatYm(r.period.start)} ~ ${formatYm(r.period.end)}`
      : copy.compareAfter;
  return (
    <QuestionLayout
      wide
      title={copy.compareTitle}
      onBack={() => nav(-1)}
      primary={{ label: copy.apply, loading: saving }}
      onSubmit={() => void run()}
    >
      <table className="hg-table" aria-label={copy.compareTitle}>
        <thead>
          <tr>
            <td />
            <th scope="col">{copy.compareNow}</th>
            <th scope="col">{afterHead}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.key}>
              <th scope="row">
                {x.label}{' '}
                {x.tag && (
                  <Badge kind={x.tag === 'now' ? 'goal' : 'warn'}>
                    {x.tag === 'now' ? copy.tagNow : copy.tagPropose}
                  </Badge>
                )}
              </th>
              <td>{x.now}</td>
              <td>
                <b>{x.after}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note}
    </QuestionLayout>
  );
}
