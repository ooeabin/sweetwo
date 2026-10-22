import { updateGoal } from '@sweetwo/api';
import {
  cutSpending,
  extendDeadlines,
  formatManWon,
  formatYm,
  lowerTargets,
  readWon,
  ymToDate,
} from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe, saveSpace, useRefresh } from '../data';
import { partnerJoined } from '../flow';
import { result } from '../result';
import { TempNote } from '../result-parts';
import { useStep } from '../step';

type Adjust = 'deadline' | 'amount' | 'spend';

// O-64 목표(Q7 결과 목록). 줄 = 순서, 이름, “{n}만 원/월”, “{연}년 {월}월 달성 예상”.
// 부족하면 조정 안 3개(기한 / 목표 금액 / 지출 줄이기: 내 용돈·생활비만), 고르면 바로 저장하고 다시 계산.
export function O64Goals() {
  const s = useStep('o-64');
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (!s.ready || !s.state.space) return null;

  const sp = s.state.space;
  const r = result(s.state);
  const { alloc, plan } = r;
  // 모을 돈이 없으면 비상금만 남김(O-62 예외)
  const lines =
    plan.saveable > 0 ? alloc.lines : alloc.lines.filter((l) => l.goal.template === 'emergency');
  const firstShort = alloc.lines.find((l) => l.short);

  const deadlines = extendDeadlines(alloc);
  const targets = lowerTargets(alloc);
  const cut = cutSpending({
    shortfall: alloc.shortfall,
    livingBudget: sp.living_budget ?? 0,
    myAllowance: s.state.me?.allowance ?? 0,
    // 합류 전 배우자 용돈 = 내 용돈 가정(배우자 수입을 모르면 내 몫만)
    allowanceFactor: !partnerJoined(s.state) && plan.basis === 'couple' ? 2 : 1,
  });

  const options: { value: Adjust; label: string; sub: string }[] = [];
  if (deadlines)
    options.push({
      value: 'deadline',
      label: copy.adjustDeadline,
      sub: deadlines
        .map((d) => copy.adjustDeadlineSub(d.goal.name, formatYm(d.deadline)))
        .join(', '),
    });
  if (targets)
    options.push({
      value: 'amount',
      label: copy.adjustAmount,
      sub: targets.map((t) => copy.adjustAmountSub(t.goal.name, readWon(t.target))).join(', '),
    });
  if (cut)
    options.push({
      value: 'spend',
      label: copy.adjustSpend,
      sub: [
        cut.livingCut > 0 ? copy.adjustSpendLiving(readWon(cut.livingCut)) : '',
        cut.allowanceCut > 0 ? copy.adjustSpendAllowance(readWon(cut.allowanceCut)) : '',
      ]
        .filter(Boolean)
        .join(', '),
    });

  const apply = async (a: Adjust) => {
    if (busy) return;
    setBusy(true);
    try {
      if (a === 'deadline' && deadlines)
        for (const d of deadlines)
          await updateGoal(d.goal.id, {
            deadline: ymToDate(d.deadline),
            deadline_estimated: false,
          });
      if (a === 'amount' && targets)
        for (const t of targets) await updateGoal(t.goal.id, { target_amount: t.target });
      if (a === 'spend' && cut) {
        await saveSpace({ living_budget: cut.livingBudget });
        if (cut.allowanceCut > 0) await saveMe({ allowance: cut.myAllowance });
      }
      await Promise.all([refresh.goals(), refresh.space(), refresh.me()]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <QuestionLayout
      wide
      chapter={s.chapter}
      title={copy.goalsResult}
      onBack={s.onBack}
      primary={{ label: copy.next, loading: s.saving || busy }}
      onSubmit={() => void s.done()}
    >
      <TempNote reason={r.temp} />
      <div className="hg-q__cols">
        <section className="hg-stack">
          {firstShort && plan.saveable > 0 && (
            <>
              <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
                <span>{copy.goalShort(firstShort.goal.name)}</span>
              </p>
              {options.length > 0 && (
                <ChoiceCards<Adjust>
                  key={alloc.shortfall}
                  label={copy.adjustLabel}
                  value={null}
                  onChange={(v) => void apply(v)}
                  autoAdvance={false}
                  options={options}
                />
              )}
            </>
          )}
        </section>
        <section>
          <ol className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {lines.map((l, i) => (
              <li
                key={l.goal.id}
                className="hg-listrow"
                style={{ gridTemplateColumns: 'auto 1fr auto' }}
              >
                <span className="hg-chip__order" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="hg-listrow__text">
                  <span className="hg-listrow__label">{l.goal.name}</span>
                  <span className="hg-listrow__sub">
                    {l.need === null
                      ? copy.goalNoAmount
                      : l.goal.kind === 'monthly'
                        ? ''
                        : l.expected
                          ? copy.expected(formatYm(l.expected))
                          : copy.expectedUnknown}
                  </span>
                </span>
                <span className="hg-listrow__value">
                  {l.need === null ? '' : copy.perMonth(formatManWon(l.alloc))}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </QuestionLayout>
  );
}
