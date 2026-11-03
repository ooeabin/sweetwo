import { DayWheel, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { saveRecommendedSplit } from '../auto-split';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type Day = number | 'last';

// O-32 월급날(17 온보딩 ②, 2026-11-02 O-31에서 나눔). 온보딩 마지막 질문 → O-60 준비 끝
// 2026-11-03 달력 판 → 1열 휠(카카오페이처럼). 처음 값 25일, 맨 아래 ‘말일’
export function O32Payday() {
  const s = useStep('o-32');
  const me = s.state.me;
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  if (!s.ready) return null;
  const saved: Day | null = me?.payday_last ? 'last' : (me?.payday ?? null);
  const payday = day === undefined ? saved : day;
  // 저장 → 추천 분배표, 비상금 금액, 첫 체크리스트 → O-60 준비 끝
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
        hint={copy.paydayLastHint}
      />
    </QuestionLayout>
  );
}
