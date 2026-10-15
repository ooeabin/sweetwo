import { formatYm, readWon } from '@sweetwo/core';
import { ListRow, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

// P-10 목표·바뀐 것 확인(G-08 형식 목록). 시작한 사람이 정한 목표를 순서대로 보여 주고 ‘모두 좋아요’.
// 항목마다 ‘좋아요’ / ‘다르게 해볼래요’(목표 제안)와 합류 전 바로 적용된 변경 목록은 목표 제안과 함께.
export function P10Changes() {
  const s = useJoinStep('p-10');
  const d = s.d;
  if (!d.ready || !d.couple) return null;
  const goals = d.goals.filter((g) => g.status !== 'achieved' && g.status !== 'used');
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.changes}
      onBack={s.onBack}
      primary={{ label: goals.length ? copy.allGood : copy.next, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      {goals.length ? (
        <div className="hg-list" role="list" aria-label={copy.changes}>
          {goals.map((g) => (
            <div role="listitem" key={g.id}>
              <ListRow
                label={g.name}
                sub={g.deadline ? formatYm(g.deadline) : undefined}
                value={g.target_amount === null ? undefined : readWon(g.target_amount)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="hg-q__help">{copy.noGoals(d.couple.partnerName)}</p>
      )}
    </QuestionLayout>
  );
}
