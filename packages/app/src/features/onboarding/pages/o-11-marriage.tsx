import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type Status = keyof typeof copy.marriedChoices;

// O-11 결혼 상태(Q1) → O-30. 2026-11-10 QA 2구간: 결혼한 날·예정일(O-12)은 온보딩에서 묻지 않음(설정 S-11h, 캘린더 결혼기념일).
// 상태를 바꾸면 전에 적은 날짜는 지움(결혼했어요가 아니게 되면 서버가 자동 결혼기념일도 지움)
export function O11Marriage() {
  const s = useStep('o-11');
  if (!s.ready)
    return <QuestionSkeleton title={copy.married} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const sp = s.state.space;
  return (
    <QuestionLayout chapter={s.chapter} title={copy.married} onBack={s.onBack}>
      <ChoiceCards<Status>
        label={copy.married}
        value={
          // v2.2 새 값(dating, living_together)은 이 화면 선택지에 아직 없음(v2.2 온보딩 PR에서 4지선다)
          sp?.marriage_status === 'married' ||
          sp?.marriage_status === 'engaged' ||
          sp?.marriage_status === 'undecided'
            ? sp.marriage_status
            : null
        }
        onChange={() => undefined}
        onPick={(v) =>
          void s.done(() =>
            // 상태가 바뀌면 날짜는 다시 받음(했어요는 지난 날, 준비 중은 앞날)
            saveSpace(
              v === sp?.marriage_status && v !== 'undecided'
                ? { marriage_status: v }
                : { marriage_status: v, wedding_date: null, wedding_month: null },
            ),
          )
        }
        options={[
          { value: 'married', label: copy.marriedChoices.married, icon: 'heart' },
          { value: 'engaged', label: copy.marriedChoices.engaged, icon: 'diamond' },
          { value: 'undecided', label: copy.marriedChoices.undecided, icon: 'ellipsis' },
        ]}
      />
    </QuestionLayout>
  );
}
