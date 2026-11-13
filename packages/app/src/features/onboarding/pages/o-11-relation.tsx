import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { passed } from '../flow';
import { useStep } from '../step';

type Relation = keyof typeof copy.relationChoices;
const RELATIONS = ['married', 'engaged', 'dating', 'living_together'] as const;

// O-11 두 사람 사이(Q1, 16, 2026-11-13 4지선다) → O-30. 미리 고른 값 없음.
// 예전 ‘아직 안 정했어요’(undecided)는 고른 값으로 보이지 않음(연애 중이에요로 옮김, Q8).
// 상태를 바꾸면 전에 적은 날짜는 지움(결혼했어요가 아니게 되면 서버가 자동 결혼기념일도 지움)
export function O11Relation() {
  const s = useStep('o-11');
  if (!s.ready)
    return <QuestionSkeleton title={copy.relation} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const sp = s.state.space;
  const saved = sp?.marriage_status;
  const value =
    passed('o-11', s.state.me?.onboarding_step) &&
    (RELATIONS as readonly string[]).includes(saved ?? '')
      ? (saved as Relation)
      : null;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.relation} onBack={s.onBack}>
      <ChoiceCards<Relation>
        label={copy.relation}
        value={value}
        onChange={() => undefined}
        onPick={(v) =>
          void s.done(() =>
            saveSpace(
              v === saved
                ? { marriage_status: v }
                : { marriage_status: v, wedding_date: null, wedding_month: null },
            ),
          )
        }
        options={RELATIONS.map((k) => ({
          value: k,
          label: copy.relationChoices[k],
          icon:
            k === 'married'
              ? 'heart'
              : k === 'engaged'
                ? 'diamond'
                : k === 'dating'
                  ? 'chat-circle-text'
                  : 'house',
        }))}
      />
    </QuestionLayout>
  );
}
