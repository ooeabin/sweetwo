import { formatManWon, formatYm } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { onboardingCopy as oc, TempNote } from '../../onboarding';
import { useJoinStep } from '../join-step';
import { revisit } from '../revisit';
import { Was } from '../was';

// O-64 목표 다시 보기(합류 뒤). 목표 줄 = 순서, 이름, 월 배분(바뀌면 이전 값 취소선), 달성 예상.
// 부족해도 조정 안은 없음(목표를 바꾸는 건 제안, 목표 제안과 함께).
export function O64Revisit() {
  const s = useJoinStep('o-64');
  const d = s.d;
  if (!d.ready) return null;
  const r = revisit(d);
  if (!r) return null;
  const { alloc, plan } = r.now;
  const lines =
    plan.saveable > 0 ? alloc.lines : alloc.lines.filter((l) => l.goal.template === 'emergency');
  const beforeOf = (id: string) => r.before.alloc.lines.find((l) => l.goal.id === id);
  const firstShort = alloc.lines.find((l) => l.short);
  const perMonth = (v: number) => oc.perMonth(formatManWon(v));

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={oc.goalsResult}
      onBack={s.onBack}
      primary={{ label: oc.next, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <TempNote reason={r.temp} />
      {firstShort && plan.saveable > 0 && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{oc.goalShort(firstShort.goal.name)}</span>
        </p>
      )}
      <ol className="hg-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {lines.map((l, i) => {
          const b = beforeOf(l.goal.id);
          return (
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
                    ? oc.goalNoAmount
                    : l.goal.kind === 'monthly'
                      ? ''
                      : l.expected
                        ? oc.expected(formatYm(l.expected))
                        : oc.expectedUnknown}
                </span>
              </span>
              <span className="hg-listrow__value">
                {l.need === null ? (
                  ''
                ) : (
                  <Was now={perMonth(l.alloc)} before={perMonth(b?.alloc ?? 0)} />
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </QuestionLayout>
  );
}
