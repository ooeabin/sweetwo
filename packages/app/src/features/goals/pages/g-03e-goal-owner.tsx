import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useAddStep } from '../add/step';

type Owner = 'together' | 'me';

// G-03e 누구 목표(Q1, 22 ‘목표 종류’): 우리 둘 → 우리 목표, 나 → 내 목표(주인 = 만든 사람). 기본 없음.
// 배우자 미합류여도 물음, 혼자 쓰기면 이 화면 없이 내 목표.
export function G03eGoalOwner() {
  const s = useAddStep('owner');
  const value = s.draft.owner === 'together' || s.draft.owner === 'me' ? s.draft.owner : null;
  return (
    <QuestionLayout steps={s.steps} title={copy.whoTitle} onBack={s.onBack}>
      <ChoiceCards<Owner>
        label={copy.whoTitle}
        value={value}
        onChange={(owner) => s.set({ owner })}
        onPick={(owner) => s.next({ owner })}
        options={[
          { value: 'together', label: copy.whoOurs },
          { value: 'me', label: copy.whoMine },
        ]}
      />
    </QuestionLayout>
  );
}
