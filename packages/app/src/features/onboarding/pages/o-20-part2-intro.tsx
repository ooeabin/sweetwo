import { readWon } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { onboardingPath, useStep } from '../step';

const fmtDate = (d: string) =>
  `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const fmtMonth = (d: string) => `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월`;

// O-20 파트 2 시작 안내(Q7) + 지금까지 답. ‘수정’ → 해당 질문 → 다시 여기로.
export function O20Part2Intro() {
  const s = useStep('o-20');
  const nav = useNavigate();
  if (!s.ready) return null;
  const sp = s.state.space;
  const me = s.state.me;
  const engaged = sp?.marriage_status === 'engaged';
  const rows: { label: string; value: string; to: string; estimated?: boolean }[] = [];
  if (sp?.marriage_status) {
    const when = sp.wedding_date
      ? fmtDate(sp.wedding_date)
      : sp.wedding_month
        ? fmtMonth(sp.wedding_month)
        : '';
    rows.push({
      label: '결혼',
      value: `${copy.marriedChoices[sp.marriage_status]} ${when}`.trim(),
      to: 'o-11',
      estimated: sp.wedding_date_estimated,
    });
  }
  if (sp?.housing) rows.push({ label: '집', value: copy.housings[sp.housing], to: 'o-15' });
  if (me?.employment)
    rows.push({ label: '일', value: copy.employments[me.employment], to: 'o-16' });
  if (sp?.child_plan)
    rows.push({ label: '아이 계획', value: copy.childPlans[sp.child_plan], to: 'o-18' });
  if (engaged && sp?.wedding_budget !== null && sp?.wedding_budget !== undefined) {
    rows.push({
      label: '결혼 준비 총예산',
      value: readWon(sp.wedding_budget),
      to: 'o-19a',
      estimated: sp.wedding_budget_estimated,
    });
  }
  if (engaged && sp?.prep_money_mode)
    rows.push({ label: '돈 관리', value: copy.prepModes[sp.prep_money_mode].label, to: 'o-19e' });

  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.part2Title}
      help={copy.part2Help}
      onBack={s.onBack}
      primary={{ label: copy.part2Cta }}
      onSubmit={() => void s.done()}
    >
      <section
        className="hg-stack"
        aria-label={copy.summaryTitle}
        style={{ gap: 'var(--space-2)' }}
      >
        <h2 className="hg-field__label" style={{ margin: 0 }}>
          {copy.summaryTitle}
        </h2>
        <div className="hg-list">
          {rows.map((r) => (
            <div key={r.label} className="hg-listrow" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="hg-stack" style={{ gap: 0 }}>
                <span className="hg-help">{r.label}</span>
                <span>
                  {r.value}
                  {r.estimated && (
                    <span className="hg-tag" style={{ marginLeft: 'var(--space-2)' }}>
                      {copy.estimated}
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                className="hg-btn hg-btn--link"
                aria-label={`${r.label} ${copy.edit}`}
                onClick={() => nav(`${onboardingPath(r.to)}?return=o-20`)}
              >
                {copy.edit}
              </button>
            </div>
          ))}
        </div>
      </section>
    </QuestionLayout>
  );
}
