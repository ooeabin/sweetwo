import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { paths } from '../../auth';
import { copy } from '../copy';
import { useOnboardingLocal } from '../data';
import { useStep } from '../step';

type Choice = keyof typeof copy.inviteChoices;
export const inviteIcons = { now: 'users-three', later: 'calendar' } as const;

// O-06 파트너 초대 여부(Q1). 지금 초대할게요 → O-07 시트 / 나중에 할게요 → O-11(홈 할 일 ‘초대하기’).
// 파트너가 이미 합류했으면 이 화면은 없음(flow.ts, 2026-11-10 S2-11).
// 2026-11-11 D4: 이미 초대를 받은 사람은 아래 ‘받은 초대 코드가 있어요 ›’ → P-01 코드 입력(뒤로 = 이 화면)
export function O06InviteNow() {
  const s = useStep('o-06');
  const nav = useNavigate();
  const { inviteNow, setInviteNow } = useOnboardingLocal();
  if (!s.ready)
    return (
      <QuestionSkeleton title={copy.inviteNow} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.inviteNow}
      help={copy.inviteNowHelp}
      onBack={s.onBack}
      later={{
        label: copy.haveCode,
        onClick: () => nav(paths.joinCode, { state: { from: '/onboarding/o-06' } }),
      }}
    >
      <ChoiceCards<Choice>
        label={copy.inviteNow}
        value={inviteNow}
        onChange={() => undefined}
        onPick={(v) => {
          setInviteNow(v);
          if (v === 'later') track('onboarding_step_skipped', { screen_id: 'O-06' });
          void s.done(undefined, () => (v === 'now' ? 'o-07' : 'o-11'), {
            answer: v === 'now' ? 'input' : 'none',
          });
        }}
        options={(Object.keys(copy.inviteChoices) as Choice[]).map((k) => ({
          value: k,
          label: copy.inviteChoices[k],
          icon: inviteIcons[k],
        }))}
      />
    </QuestionLayout>
  );
}
