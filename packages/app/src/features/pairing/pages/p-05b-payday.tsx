import { DayWheel, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

type Day = number | 'last';

// P-05b 월급날(18, O-32와 같음, 2026-11-03 P-05에서 나눔). 합류 마지막 질문: 저장 → 추천 월급 계획으로 합류 완료 → 홈(할 일 ‘월급 계획 확인’).
// 시작한 사람이 아직 온보딩 중이면 합류만(홈 대기).
export function P05bPayday() {
  const s = useJoinStep('p-05b');
  const me = s.d.me;
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  if (!s.d.ready || !me)
    return (
      <QuestionSkeleton title={copy.paydayTitle} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  const saved: Day | null = me.payday_last ? 'last' : (me.payday ?? null);
  const payday = day === undefined ? saved : day;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.paydayTitle}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: payday === null, loading: s.saving }}
      onSubmit={() =>
        payday !== null &&
        void s.done(() =>
          saveMe({
            payday: typeof payday === 'number' ? payday : null,
            payday_last: payday === 'last',
          }),
        )
      }
    >
      <DayWheel
        label={copy.paydayTitle}
        value={payday}
        onChange={setDay}
        lastLabel={copy.paydayLast}
        hint={copy.paydayLastHint}
      />
    </QuestionLayout>
  );
}
