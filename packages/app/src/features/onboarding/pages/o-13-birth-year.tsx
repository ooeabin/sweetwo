import { birthYearRange } from '@sweetwo/core';
import { DateWheel, QuestionLayout, type YMD } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

// O-13 출생연도(Q4 연도 휠). 1950 ~ (올해 − 18)년, 처음 위치 올해 − 30. 비슷한 부부 비교의 연령대에만 씀.
// 나이 확인은 A-05 “만 18세 이상이에요” 체크(이 화면은 확인용이 아님). 월·일은 받지 않음.
export function O13BirthYear() {
  const s = useStep('o-13');
  const [b, setB] = useState<YMD | null>(null);
  const me = s.state.me;
  if (!s.ready) return null;
  const range = birthYearRange();
  const title = copy.birthYear(me?.nickname ?? '');
  const initial: YMD = { y: me?.birth_year ?? range.max - 12, m: 1, d: 1 };
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !b, loading: s.saving }}
      onSubmit={() => b && void s.done(() => saveMe({ birth_year: b.y }))}
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
