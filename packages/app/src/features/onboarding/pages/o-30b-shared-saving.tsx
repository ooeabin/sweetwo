import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { passed } from '../flow';
import { managerAnswerOf, saveManage } from '../manage';
import { useStep } from '../step';

type YesNo = 'yes' | 'no';

// O-30b 같이 모으는 저금(Q1, 17 v2.2) → 생활비 ‘네’면 O-30c, ‘아니요’면 O-31. 미리 고른 값 없음.
// 생활비 ‘아니요’면 여기서 세 답이 끝남(분석 manage_answers_saved)
export function O30bSharedSaving() {
  const s = useStep('o-30b');
  if (!s.ready)
    return (
      <QuestionSkeleton title={copy.sharedSaving} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  const sp = s.state.space;
  const me = s.state.me;
  const living = sp?.shared_living === true;
  const saved = sp?.shared_saving;
  const value: YesNo | null =
    passed('o-30b', me?.onboarding_step) && saved != null ? (saved ? 'yes' : 'no') : null;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.sharedSaving} onBack={s.onBack}>
      <ChoiceCards<YesNo>
        label={copy.sharedSaving}
        value={value}
        onChange={() => undefined}
        onPick={(v) => {
          const saving = v === 'yes';
          void s.done(
            () =>
              saveManage({
                living,
                saving,
                manager: sp ? managerAnswerOf(sp, me?.id) : null,
                screenId: 'O-30B',
                final: !living,
              }),
            undefined,
            { replan: saving !== saved },
          );
        }}
        options={(['yes', 'no'] as const).map((k) => ({
          value: k,
          label: copy.sharedSavingChoices[k],
          icon: k === 'yes' ? 'piggy-bank' : 'ellipsis',
        }))}
      />
    </QuestionLayout>
  );
}
