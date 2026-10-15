import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useAddStep } from '../add/step';

type Owner = 'together' | 'me' | 'partner';

// G-03e 담당(Q1): 같이 / 나 / {배우자}. 미합류·혼자 쓰기면 이 화면 없음(나)
export function G03eGoalOwner() {
  const s = useAddStep('owner');
  return (
    <QuestionLayout steps={s.steps} title={copy.ownerTitle} onBack={s.onBack}>
      <ChoiceCards<Owner>
        label={copy.ownerTitle}
        value={s.draft.owner}
        onChange={(owner) => s.set({ owner })}
        onPick={(owner) => s.next({ owner })}
        options={[
          { value: 'together', label: copy.together },
          { value: 'me', label: copy.ownerMe },
          { value: 'partner', label: s.data.couple?.partnerName ?? '' },
        ]}
      />
    </QuestionLayout>
  );
}
