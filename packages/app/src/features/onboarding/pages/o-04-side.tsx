import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type Side = keyof typeof copy.sides;

// O-04 신랑·신부(Q1). 양가 구분에 사용.
export function O04Side() {
  const s = useStep('o-04');
  if (!s.ready) return null;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.side} onBack={s.onBack}>
      <ChoiceCards<Side>
        label={copy.side}
        value={s.state.me?.side ?? null}
        onChange={() => undefined}
        onPick={(v) => void s.done(() => saveMe({ side: v }))}
        options={(Object.keys(copy.sides) as Side[]).map((k) => ({
          value: k,
          label: copy.sides[k],
        }))}
      />
    </QuestionLayout>
  );
}
