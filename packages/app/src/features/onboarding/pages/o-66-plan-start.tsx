import { startFirstPlan, type FirstPlanLine } from '@sweetwo/api';
import {
  adjustParts,
  formatManWon,
  parseYm,
  prorate,
  quickChips,
  readWon,
  splitLines,
  type PlanParts,
} from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { useRefresh } from '../data';
import { partnerJoined } from '../flow';
import {
  baseDayOf,
  cycleOf,
  monthlyParts,
  myPaydayOf,
  result,
  roleOfPart,
  splitOf,
} from '../result';
import { BaseDayEditor, TempNote } from '../result-parts';
import { onboardingPath, useStep } from '../step';
import { saveBaseDay } from './o-63-accounts';

const sum = (p: PlanParts) => p.living + p.goalFund + p.emergency;

// O-66 월급 플랜 시작. 기준일(바꾸면 다시 계산), 이번 달 옮길 수 있는 돈(1회 조정), 나누기 줄(합류 + 역할별 통장만).
// ‘시작하기’ = 첫 월급 플랜(남은 기간) 만들기 → O-67.
export function O66PlanStart() {
  const s = useStep('o-66');
  const nav = useNavigate();
  const refresh = useRefresh();
  const ok = useConfirmOnce(copy.zeroPlan);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  if (!s.ready || !s.state.space) return null;

  const sp = s.state.space;
  const me = s.state.me;
  const r = result(s.state);
  const cycle = cycleOf(s.state);
  const base = baseDayOf(s.state);
  if (!cycle || base === null) return null;

  const monthly = monthlyParts(s.state);
  const monthlyTotal = sum(monthly);
  const prorated: PlanParts = {
    living: prorate(monthly.living, cycle),
    goalFund: prorate(monthly.goalFund, cycle),
    emergency: prorate(monthly.emergency, cycle),
  };
  const defaultTotal = sum(prorated);
  const value = amount === undefined ? defaultTotal : amount;
  const parts = value === null ? prorated : adjustParts(prorated, value);
  const tooMuch = value !== null && value > monthlyTotal;
  const split = splitOf(s.state);
  const lines = splitLines(parts, split);
  const joined = partnerJoined(s.state);
  const showLines = joined && sp.account_mode === 'roles';
  const solo = sp.couple_state === 'solo';
  const month = parseYm(cycle.labelMonth).m;
  const myName = me?.nickname ?? '';
  const partnerName = sp.partner_nickname ?? '';
  const groom = me?.side !== 'bride'; // 나눠 낼 몫을 신랑, 신부 쪽으로 저장

  const start = () =>
    s.done(async () => {
      const total = value ?? defaultTotal;
      const accountLines: FirstPlanLine[] =
        r.separate || sp.account_mode === 'roles'
          ? lines
              .filter((l) => l.amount > 0)
              .map((l) => ({
                target: 'account',
                account_role: roleOfPart(l.key, r.separate),
                amount: l.amount,
                amount_groom: groom ? l.me : l.partner,
                amount_bride: groom ? l.partner : l.me,
              }))
          : [];
      // 목표별 계획액: 월 배분액을 남은 기간과 조정 비율만큼(1만 원 단위)
      const savingNow = parts.goalFund + parts.emergency;
      const savingMonthly = monthly.goalFund + monthly.emergency;
      const goalLines: FirstPlanLine[] = r.alloc.lines
        .filter((l) => l.alloc > 0 && savingMonthly > 0)
        .map((l): FirstPlanLine => ({
          target: 'goal',
          goal_id: l.goal.id,
          amount: Math.round((l.alloc * savingNow) / savingMonthly / 10_000) * 10_000,
        }))
        .filter((l) => l.amount > 0);
      await startFirstPlan({
        labelMonth: `${cycle.labelMonth}-01`,
        cycleStart: cycle.start,
        cycleEnd: cycle.end,
        firstAdjust: total,
        mergedClose: cycle.short,
        isTemp: r.temp !== null,
        snapshot: {
          baseDay: base,
          split: { ...split },
          monthly: { ...monthly },
          parts: { ...parts },
          income: r.plan.income,
          saveable: r.plan.saveable,
          basis: r.plan.basis,
        },
        lines: [...accountLines, ...goalLines],
      });
    });

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={copy.startPlan}
      onBack={s.onBack}
      primary={{ label: copy.start, disabled: value === null || tooMuch, loading: s.saving }}
      onSubmit={() => value !== null && !tooMuch && ok.check(value === 0) && void start()}
    >
      <TempNote reason={r.temp} />
      {!joined && !solo && (
        <button
          type="button"
          className="hg-btn hg-btn--secondary"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav(`${onboardingPath('o-07')}?return=o-66`)}
        >
          {copy.invite(partnerName)}
        </button>
      )}
      <div className="hg-q__cols">
        <section className="hg-stack">
          <div className="hg-card">
            <BaseDayEditor
              value={base}
              line={copy.baseDay}
              sub={base === myPaydayOf(s.state) ? copy.myPayday(myName) : undefined}
              onSave={async (d) => {
                await saveBaseDay(d);
                await refresh.space();
                setAmount(undefined); // 기간이 바뀌면 기본값으로 다시 계산
              }}
            />
          </div>
          <div className="hg-card hg-stack">
            <div className="hg-card__top">
              <span className="hg-card__label">{copy.planName(month)}</span>
              <span className="hg-help">{copy.daysLeft(cycle.daysLeft)}</span>
            </div>
            <AmountInput
              label={copy.planAmountLabel}
              value={value}
              onChange={(v) => {
                setAmount(v);
                ok.reset();
              }}
              quick={quickChips.small}
              allowZero
            />
            {tooMuch && (
              <p className="hg-help is-error" role="alert" style={{ margin: 0 }}>
                {copy.planTooMuch(readWon(monthlyTotal))}
              </p>
            )}
            {cycle.short && (
              <p className="hg-help" style={{ margin: 0 }}>
                {copy.shortCycle}
              </p>
            )}
          </div>
          {ok.banner}
        </section>

        <section className="hg-stack">
          {showLines ? (
            <>
              <h2 className="hg-card__label" style={{ margin: 0 }}>
                {copy.linesTitle}
              </h2>
              <table className="hg-table">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">{myName}</th>
                    <th scope="col">{partnerName}</th>
                    <th scope="col">{copy.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key}>
                      <th scope="row">{copy.roles[roleOfPart(l.key, r.separate)]}</th>
                      <td>{formatManWon(l.me)}</td>
                      <td>{formatManWon(l.partner)}</td>
                      <td>{formatManWon(l.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{copy.total}</th>
                    <td>{formatManWon(lines.reduce((t, l) => t + l.me, 0))}</td>
                    <td>{formatManWon(lines.reduce((t, l) => t + l.partner, 0))}</td>
                    <td>{formatManWon(sum(parts))}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            !solo &&
            !joined && (
              <p className="hg-help" style={{ margin: 0 }}>
                {copy.joinPreview(partnerName)}
              </p>
            )
          )}
        </section>
      </div>
    </QuestionLayout>
  );
}
