import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type V = keyof typeof copy.housings;

// O-15 사는 집. 자가 외 → ‘내 집 마련’ 추천(Q1)
export function O15Housing() {
  const s = useStep('o-15');
  if (!s.ready) return null;
  const title = copy.housing;
  return (
    <QuestionLayout chapter={s.chapter} title={title} onBack={s.onBack}>
      <ChoiceCards<V>
        label={title}
        value={s.state.space?.housing ?? null}
        onChange={() => undefined}
        onPick={(v) => void s.done(() => saveSpace({ housing: v }))}
        options={(Object.keys(copy.housings) as V[]).map((k) => ({
          value: k,
          label: copy.housings[k],
        }))}
      />
    </QuestionLayout>
  );
}
