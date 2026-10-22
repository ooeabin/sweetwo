import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type V = keyof typeof copy.childPlans;

// O-18 아이 계획. ‘없어요’ 외 → ‘출산 준비’ 추천(Q1)
export function O18ChildPlan() {
  const s = useStep('o-18');
  if (!s.ready) return null;
  const title = copy.childPlan;
  return (
    <QuestionLayout chapter={s.chapter} title={title} onBack={s.onBack}>
      <ChoiceCards<V>
        label={title}
        value={s.state.space?.child_plan ?? null}
        onChange={() => undefined}
        onPick={(v) => void s.done(() => saveSpace({ child_plan: v }))}
        options={(Object.keys(copy.childPlans) as V[]).map((k) => ({
          value: k,
          label: copy.childPlans[k],
        }))}
      />
    </QuestionLayout>
  );
}
