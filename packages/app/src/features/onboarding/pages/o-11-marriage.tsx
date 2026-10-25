import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type Status = keyof typeof copy.marriedChoices;

// O-11 결혼 상태(Q1) → O-12(했어요 / 준비 중에 따라 질문이 다름). 준비 중 → O-21 ‘결혼 비용’ 추천 배지 + 맨 앞
export function O11Marriage() {
  const s = useStep('o-11');
  if (!s.ready) return null;
  const sp = s.state.space;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.married} onBack={s.onBack}>
      <ChoiceCards<Status>
        label={copy.married}
        value={sp?.marriage_status ?? null}
        onChange={() => undefined}
        onPick={(v) =>
          void s.done(() =>
            // 상태가 바뀌면 날짜는 다시 받음(했어요는 지난 날, 준비 중은 앞날)
            saveSpace(
              v === sp?.marriage_status
                ? { marriage_status: v }
                : { marriage_status: v, wedding_date: null, wedding_month: null },
            ),
          )
        }
        options={[
          { value: 'married', label: copy.marriedChoices.married },
          { value: 'engaged', label: copy.marriedChoices.engaged },
        ]}
      />
    </QuestionLayout>
  );
}
