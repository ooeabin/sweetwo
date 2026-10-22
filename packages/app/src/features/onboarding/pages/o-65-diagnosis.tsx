import { needsLook, type IndicatorKey, type Signal } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { result } from '../result';
import { TempNote } from '../result-parts';
import { useStep } from '../step';

type Action = keyof typeof copy.firstWeek;
/** 지표 → 값을 넣거나 고치는 첫 주 할 일(O-67 첫 주 할 일 표) */
const ACTION: Record<IndicatorKey, Action> = {
  savingRate: 'fixed',
  emergency: 'assets',
  loanBurden: 'loans',
  fixedRatio: 'fixed',
  investPrinciple: 'invest',
};

const tagClass = (sig: Signal) => (sig === 'unknown' ? 'hg-badge hg-badge--temp' : 'hg-tag');

// O-65 재정 진단(Q7 결과 목록). 지표 5개 + 신호. ‘아직 몰라요’는 회색, 판단에서 빼고 값을 넣는 할 일로.
// 개선 액션 최대 3개 + 할 일 날짜 배지.
export function O65Diagnosis() {
  const s = useStep('o-65');
  if (!s.ready) return null;
  const r = result(s.state);
  const look = needsLook(r.diag);
  const title = look.length
    ? copy.lookAt(look.map((x) => copy.indicators[x.key]).join(', '))
    : copy.allGood;
  const actions = [
    ...new Set(
      [...look, ...r.diag.filter((x) => x.signal === 'unknown')].map((x) => ACTION[x.key]),
    ),
  ].slice(0, 3);

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
      <div className="hg-q__cols">
        <section className="hg-stack">
          <h2 className="hg-card__label" style={{ margin: 0 }}>
            {copy.actionsTitle}
          </h2>
          <ul className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {actions.map((a) => (
              <li key={a} className="hg-listrow" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="hg-listrow__label">{copy.firstWeek[a].label}</span>
                <span className="hg-tag">{copy.firstWeek[a].day}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <ul className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {r.diag.map((x) => (
              <li
                key={x.key}
                className="hg-listrow"
                style={{ gridTemplateColumns: '1fr auto auto' }}
              >
                <span
                  className="hg-listrow__label"
                  style={x.signal === 'unknown' ? { color: 'var(--stone)' } : undefined}
                >
                  {copy.indicators[x.key]}
                </span>
                <span className="hg-listrow__value is-soft">
                  {x.pct === null ? '' : `${x.pct}%`}
                </span>
                <span className={tagClass(x.signal)}>{copy.signals[x.signal]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </QuestionLayout>
  );
}
