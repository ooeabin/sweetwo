import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type V = keyof typeof copy.employments;

// O-16 내 일 형태. 비상금 기준 개월(3 또는 6)(Q1)
export function O16Employment() {
  const s = useStep('o-16');
  if (!s.ready) return null;
  const title = copy.employment(s.state.me?.nickname ?? '');
  return (
    <QuestionLayout chapter={s.chapter} title={title} onBack={s.onBack}>
      <ChoiceCards<V>
        label={title}
        value={s.state.me?.employment ?? null}
        onChange={() => undefined}
        onPick={(v) => void s.done(() => saveMe({ employment: v }))}
        options={(Object.keys(copy.employments) as V[]).map((k) => ({
          value: k,
          label: copy.employments[k],
        }))}
      />
    </QuestionLayout>
  );
}
