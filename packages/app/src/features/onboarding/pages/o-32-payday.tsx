import { Checkbox, DayWheel, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { saveRecommendedSplit } from '../auto-split';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type Day = number | 'last';

// O-32 월급날(17 온보딩 ② v2.2) → 추천 월급 계획 저장 → O-55 알림 허용. 1열 휠, 처음 값 25일, 맨 아래 ‘말일’.
// ‘매달 금액이 달라요’(O-31)를 켰을 때만 휠 아래 선택지 ‘날짜가 정해져 있지 않아요’ = payday_none(확인 목록 없음, 07 6장).
// ‘다음’마다 추천 월급 계획을 다시 만듦(2026-11-10 S2-01). 첫 확인 목록은 만들지 않음(소급 없음, 다음 월급날)
export function O32Payday() {
  const s = useStep('o-32');
  const me = s.state.me;
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [none, setNone] = useState<boolean | undefined>(undefined);
  if (!s.ready)
    return <QuestionSkeleton title={copy.payday} chapter={s.chapter} onBack={s.onBack ?? null} />;
  const saved: Day | null = me?.payday_last ? 'last' : (me?.payday ?? null);
  const payday = day === undefined ? saved : day;
  const variable = !!me?.income_variable;
  const noDate = variable && (none ?? !!me?.payday_none);
  const save = () =>
    s.done(async () => {
      await saveMe(
        noDate
          ? { payday: null, payday_last: false, payday_none: true }
          : {
              payday: typeof payday === 'number' ? payday : null,
              payday_last: payday === 'last',
              payday_none: false,
            },
      );
      await saveRecommendedSplit();
    });
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.payday}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !noDate && payday === null, loading: s.saving }}
      onSubmit={() => (noDate || payday !== null) && void save()}
    >
      <DayWheel
        label={copy.payday}
        value={payday}
        onChange={(d) => {
          setDay(d);
          setNone(false);
        }}
        lastLabel={copy.paydayLast}
        // 29~31일은 없는 달이 있어 ‘말일’과 같아질 수 있음(2026-11-10 S2-24, 12 Q4 예외)
        hint={
          typeof payday === 'number' && payday >= 29 ? copy.paydayShortMonth : copy.paydayLastHint
        }
      />
      {variable && <Checkbox label={copy.paydayNone} checked={noDate} onChange={setNone} />}
    </QuestionLayout>
  );
}
