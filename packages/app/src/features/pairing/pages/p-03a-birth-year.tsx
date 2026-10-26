import { birthYearRange } from '@sweetwo/core';
import { DateWheel, QuestionLayout, type YMD } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

// P-03a 출생연도(Q4 연도 휠, O-13과 같음). 1950 ~ (올해 − 18)년, 처음 위치 올해 − 30. 비슷한 부부 비교의 연령대에만 씀.
export function P03aBirthYear() {
  const s = useJoinStep('p-03a');
  const d = s.d;
  const [b, setB] = useState<YMD | null>(null);
  if (!d.ready || !d.me) return null;
  const range = birthYearRange();
  const title = copy.birthYear(d.me.nickname ?? '');
  const initial: YMD = { y: d.me.birth_year ?? range.max - 12, m: 1, d: 1 };
  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !b && !d.me.birth_year, loading: s.saving }}
      onSubmit={() => {
        const y = b?.y ?? d.me?.birth_year;
        if (y) void s.done(() => saveMe({ birth_year: y }));
      }}
    >
      <DateWheel
        label={title}
        value={b}
        onChange={setB}
        minYear={range.min}
        maxYear={range.max}
        initial={initial}
        yearOnly
      />
    </QuestionLayout>
  );
}
