import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useOnboardingLocal } from '../data';
import { useStep } from '../step';

type Choice = keyof typeof copy.inviteChoices;

// O-06 배우자 초대 여부(Q1). 지금 초대 → O-07 / 나 먼저 → O-11(결과 뒤 할 일 ‘배우자 초대하기’)
export function O06InviteNow() {
  const s = useStep('o-06');
  const { inviteNow, setInviteNow } = useOnboardingLocal();
  if (!s.ready) return null;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.inviteNow} onBack={s.onBack}>
      <ChoiceCards<Choice>
        label={copy.inviteNow}
        value={inviteNow}
        onChange={() => undefined}
        onPick={(v) => {
          setInviteNow(v);
          void s.done(undefined, () => (v === 'now' ? 'o-07' : 'o-11'));
        }}
        options={(Object.keys(copy.inviteChoices) as Choice[]).map((k) => ({
          value: k,
          label: copy.inviteChoices[k],
        }))}
      />
    </QuestionLayout>
  );
}
