import type { ManagerAnswer } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { passed } from '../flow';
import { managerAnswerOf, saveManage } from '../manage';
import { useStep } from '../step';

const ANSWERS = ['me', 'partner', 'together', 'each'] as const;

// O-30c 누가 주로 관리(Q1, 17 v2.2, O-30 ‘네’일 때만) → O-31. 미리 고른 값 없음. v2의 O-30a 번호는 쓰지 않음.
// 합류 전이면 ‘파트너가 주로 해요’, 합류 뒤 다시 물으면 “{파트너}가 주로 해요”.
// 엔진 값: 제가·파트너가 = 한 사람 관리형(합쳐서 + 관리하는 사람), 둘이 같이 = 합쳐서, 각자 = 각자(08 2장 표)
export function O30cManager() {
  const s = useStep('o-30c');
  if (!s.ready)
    return <QuestionSkeleton title={copy.manager} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const sp = s.state.space;
  const me = s.state.me;
  const saved = sp ? managerAnswerOf(sp, me?.id) : null;
  const value = passed('o-30c', me?.onboarding_step) ? saved : null;
  const partner = s.state.partner?.nickname ?? '';
  const label = (k: ManagerAnswer) => {
    const c = copy.managerChoices[k];
    return typeof c === 'function' ? c(partner) : c;
  };
  return (
    <QuestionLayout chapter={s.chapter} title={copy.manager} onBack={s.onBack}>
      <ChoiceCards<ManagerAnswer>
        label={copy.manager}
        value={value}
        onChange={() => undefined}
        onPick={(v) =>
          void s.done(
            () =>
              saveManage({
                living: true,
                saving: sp?.shared_saving ?? null,
                manager: v,
                screenId: 'O-30C',
                final: true,
              }),
            undefined,
            { replan: v !== saved },
          )
        }
        options={ANSWERS.map((k) => ({
          value: k,
          label: label(k),
          icon:
            k === 'me'
              ? 'user'
              : k === 'partner'
                ? 'user-plus'
                : k === 'together'
                  ? 'users-three'
                  : 'wallet',
        }))}
      />
    </QuestionLayout>
  );
}
