import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { passed } from '../flow';
import { managerAnswerOf, saveManage } from '../manage';
import { useStep } from '../step';

type YesNo = 'yes' | 'no';

// O-30 같이 쓰는 생활비(Q1, 17 v2.2, 08 2장) → O-30b. 미리 고른 값 없음(‘기본 각자’ 없앰).
// 화면마다 저장: 지금 저금·관리 답은 그대로 두고(처음이면 저금 없음, 생활비 ‘네’면 관리는 O-30c 전까지 ‘둘이 같이’) 서버에 맞춤.
// 바꾸면 O-32에서 월급 계획을 다시 만들게 이어하기 기록을 되돌림(2026-11-10 S2-01)
export function O30SharedLiving() {
  const s = useStep('o-30');
  if (!s.ready)
    return (
      <QuestionSkeleton title={copy.sharedLiving} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  const sp = s.state.space;
  const me = s.state.me;
  const saved = sp?.shared_living;
  const value: YesNo | null =
    passed('o-30', me?.onboarding_step) && saved != null ? (saved ? 'yes' : 'no') : null;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.sharedLiving}
      help={copy.sharedLivingHelp}
      onBack={s.onBack}
    >
      <ChoiceCards<YesNo>
        label={copy.sharedLiving}
        value={value}
        onChange={() => undefined}
        onPick={(v) => {
          const living = v === 'yes';
          void s.done(
            () =>
              saveManage({
                living,
                saving: sp?.shared_saving ?? null,
                manager: sp ? managerAnswerOf(sp, me?.id) : null,
                screenId: 'O-30',
                final: false,
              }),
            undefined,
            { replan: living !== saved },
          );
        }}
        options={(['yes', 'no'] as const).map((k) => ({
          value: k,
          label: copy.sharedLivingChoices[k],
          icon: k === 'yes' ? 'users-three' : 'user',
        }))}
      />
    </QuestionLayout>
  );
}
