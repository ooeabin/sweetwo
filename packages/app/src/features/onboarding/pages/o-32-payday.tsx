import { DayWheel, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { saveRecommendedSplit } from '../auto-split';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type Day = number | 'last';

// O-32 월급날(17 온보딩 ②, 2026-11-02 O-31에서 나눔). 온보딩 마지막 질문 → O-60 준비 끝
// 2026-11-03 달력 판 → 1열 휠(카카오페이처럼). 처음 값 25일, 맨 아래 ‘말일’.
// ‘다음’마다 추천 월급 계획과 첫 체크리스트를 다시 만듦(2026-11-10 S2-01, 뒤로 와서 바꿔도 맞게)
export function O32Payday() {
  const s = useStep('o-32');
  const me = s.state.me;
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  if (!s.ready)
    return <QuestionSkeleton title={copy.payday} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const saved: Day | null = me?.payday_last ? 'last' : (me?.payday ?? null);
  const payday = day === undefined ? saved : day;
  // 저장 → 추천 월급 계획(저금 줄 없음, ADR 0007), 첫 체크리스트 → O-60 준비 끝
  const save = (d: Day) =>
    s.done(async () => {
      await saveMe({ payday: typeof d === 'number' ? d : null, payday_last: d === 'last' });
      await saveRecommendedSplit();
    });
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.payday}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: payday === null, loading: s.saving }}
      onSubmit={() => payday !== null && void save(payday)}
    >
      <DayWheel
        label={copy.payday}
        value={payday}
        onChange={setDay}
        lastLabel={copy.paydayLast}
        // 29~31일은 없는 달이 있어 ‘말일’과 같아질 수 있음(2026-11-10 S2-24, 12 Q4 예외)
        hint={
          typeof payday === 'number' && payday >= 29 ? copy.paydayShortMonth : copy.paydayLastHint
        }
      />
    </QuestionLayout>
  );
}
