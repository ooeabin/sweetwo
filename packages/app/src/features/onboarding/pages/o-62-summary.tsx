import { readWon } from '@sweetwo/core';
import { QuestionLayout, ResultCard } from '@sweetwo/ui';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useRefresh } from '../data';
import { partnerJoined } from '../flow';
import { result, syncEmergency } from '../result';
import { EstTag, TempNote } from '../result-parts';
import { onboardingPath, useStep } from '../step';

const pctOf = (v: number, total: number) => (total > 0 ? Math.round((v * 1000) / total) / 10 : 0);

// O-62 요약(결과 첫 화면). 왼쪽 결론과 숫자 카드, 오른쪽 돈 흐름 막대와 계산 근거(줄을 누르면 그 질문 → 다시 여기로).
export function O62Summary() {
  const s = useStep('o-62');
  const nav = useNavigate();
  const refresh = useRefresh();
  // 답을 고치고 왔으면 O-61 없이 비상금 기준만 다시 맞춤
  useEffect(() => {
    if (s.ready)
      void syncEmergency(s.state).then(async (changed) => {
        if (changed) await refresh.goals();
      });
  }, [s.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.ready || !s.state.space) return null;

  const sp = s.state.space;
  const me = s.state.me?.nickname ?? '';
  const partner = sp.partner_nickname ?? '';
  const r = result(s.state);
  const { plan, alloc } = r;
  const edit = (id: string) => nav(`${onboardingPath(id)}?return=o-62`);

  // 각자 관리 예비부부: 결혼 비용 하나
  if (r.separate) {
    const wedding = alloc.lines.find((l) => l.goal.template === 'wedding');
    const need = wedding?.need ?? 0;
    return (
      <QuestionLayout
        wide
        chapter={s.chapter}
        title={copy.weddingSave(readWon(need))}
        onBack={s.onBack}
        primary={{ label: copy.next, loading: s.saving }}
        onSubmit={() => void s.done()}
      >
        <TempNote reason={r.temp} />
        <div className="hg-cards">
          <IncomeCard s={s.state} r={r} me={me} />
          <div className="hg-card">
            <span className="hg-card__label">{copy.weddingCard}</span>
            <p className="hg-card__value">{readWon(need)}</p>
          </div>
        </div>
      </QuestionLayout>
    );
  }

  const saving = plan.saveable > 0;
  const amount = readWon(Math.max(plan.saveable, 0));
  const title = !saving
    ? copy.noSaving
    : sp.couple_state === 'solo'
      ? copy.canSaveSolo(amount)
      : plan.basis === 'mine'
        ? copy.canSaveMine(me, amount)
        : copy.canSave(amount);

  // 내 몫 기준이면 공동 지출도 내 몫만 보여 준다(합계가 맞게)
  const pct =
    plan.basis === 'mine' ? (sp.split_mode === 'custom' ? (sp.split_ratio ?? 50) : 50) : 100;
  const sharedShare = Math.round((plan.sharedLiving * pct) / 100);
  const fixedShare = Math.round((r.fixed * pct) / 100);
  const livingShare = sharedShare - fixedShare;
  const flow = [
    {
      key: 'allowance',
      name: copy.flowAllowance,
      value: plan.allowances,
      color: 'var(--chart-goal)',
    },
    { key: 'shared', name: copy.flowShared, value: sharedShare, color: 'var(--chart-together)' },
    {
      key: 'save',
      name: copy.flowSave,
      value: Math.max(plan.saveable, 0),
      color: 'var(--chart-safety)',
    },
  ];
  const basis = [
    { id: 'o-31', name: copy.basisIncome, value: plan.income, sign: '' },
    { id: 'o-51', name: copy.basisAllowance, value: plan.allowances, sign: '−' },
    { id: 'o-36', name: copy.basisFixed, value: fixedShare, sign: '−' },
    { id: 'o-38', name: copy.basisLiving, value: livingShare, sign: '−' },
  ];

  return (
    <QuestionLayout
      wide
      chapter={s.chapter}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <TempNote reason={r.temp} />
      {(sp.living_budget ?? 0) > plan.income && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{copy.livingOverIncome}</span>
        </p>
      )}
      <div className="hg-q__cols">
        <section className="hg-stack">
          {saving ? (
            <ResultCard
              label={copy.saveCard}
              value={readWon(plan.saveable)}
              tag={<EstTag show={r.estimated} />}
              meta={copy.resultMeta(
                plan.basis === 'mine' || sp.couple_state === 'solo'
                  ? copy.whoMine(me)
                  : copy.whoBoth,
                readWon(plan.income),
              )}
              items={[
                { label: copy.saveGoal, value: readWon(alloc.goals) },
                { label: copy.saveEmergency, value: readWon(alloc.emergency) },
              ]}
            />
          ) : (
            <div className="hg-cards">
              <IncomeCard s={s.state} r={r} me={me} />
              <div className="hg-card">
                <span className="hg-card__label">{copy.checkSpending}</span>
                <div className="hg-row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="hg-btn hg-btn--link"
                    onClick={() => edit('o-36')}
                  >
                    {copy.checkFixed}
                  </button>
                  <button
                    type="button"
                    className="hg-btn hg-btn--link"
                    onClick={() => edit('o-38')}
                  >
                    {copy.checkLiving}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!partnerJoined(s.state) && sp.couple_state !== 'solo' && (
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.joinPreview(partner)}
            </p>
          )}
        </section>

        <section className="hg-stack">
          <h2 className="hg-card__label" style={{ margin: 0 }}>
            {copy.flowTitle(readWon(plan.income))}
          </h2>
          <div
            className="hg-stackbar"
            role="img"
            aria-label={flow.map((f) => `${f.name} ${readWon(f.value)}`).join(', ')}
          >
            {flow
              .filter((f) => f.value > 0)
              .map((f) => (
                <span
                  key={f.key}
                  title={`${f.name} ${readWon(f.value)}, ${pctOf(f.value, plan.income)}%`}
                  style={{ flex: f.value, background: f.color }}
                />
              ))}
          </div>
          <div className="hg-breakdown">
            {flow.map((f) => (
              <div key={f.key} className="hg-breakdown__row">
                <span className="hg-breakdown__name">
                  <i style={{ background: f.color }} />
                  {f.name}
                </span>
                <span className="hg-breakdown__val">
                  {readWon(f.value)}
                  <em>{pctOf(f.value, plan.income)}%</em>
                </span>
              </div>
            ))}
          </div>

          <h2 className="hg-card__label" style={{ margin: 'var(--space-4) 0 0' }}>
            {copy.basisTitle}
          </h2>
          <div className="hg-list">
            {basis.map((b) => (
              <button
                key={b.id}
                type="button"
                className="hg-listrow"
                style={{ gridTemplateColumns: '1fr auto' }}
                onClick={() => edit(b.id)}
              >
                <span className="hg-listrow__label">{b.name}</span>
                <span className="hg-listrow__value">
                  {b.sign}
                  {readWon(b.value)}
                </span>
              </button>
            ))}
            <div className="hg-listrow" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="hg-listrow__label">{copy.basisSave}</span>
              <span className="hg-listrow__value">{readWon(plan.saveable)}</span>
            </div>
          </div>
        </section>
      </div>
    </QuestionLayout>
  );
}

function IncomeCard({
  s,
  r,
  me,
}: {
  s: Parameters<typeof result>[0];
  r: ReturnType<typeof result>;
  me: string;
}) {
  const sp = s.space;
  return (
    <div className="hg-card">
      <div className="hg-card__top">
        <span className="hg-card__label">{copy.incomeCard}</span>
        <EstTag show={!!sp?.partner_income_estimated && r.plan.basis === 'couple'} />
      </div>
      <p className="hg-card__value">{readWon(r.plan.income)}</p>
      <p className="hg-card__meta">
        {r.plan.basis === 'mine' || sp?.couple_state === 'solo'
          ? copy.incomeMine(me)
          : copy.incomeBoth}
      </p>
    </div>
  );
}
